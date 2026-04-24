import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Called by the parser service when it finds a new property or receives photos
export async function POST(req: Request) {
  const secret = req.headers.get('x-parser-secret')
  if (secret !== process.env.PARSER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = createServiceClient()

  if (body.type === 'new_property') {
    const { error } = await supabase.from('properties').insert({
      title: body.title,
      address: body.address,
      district: body.district,
      price: body.price,
      deposit: body.deposit,
      type: body.propertyType,
      rooms: body.rooms,
      area: body.area,
      floor: body.floor,
      total_floors: body.totalFloors,
      description: body.description,
      status: 'waiting_photos',
      photos: [],
      source_chat_id: body.chatId,
      source_chat_name: body.chatName,
      source_account: body.account,
      sender_phone: body.senderPhone,
      raw_message: body.rawMessage,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.type === 'photos') {
    // Append photos to existing property matched by sender_phone
    const { data: props } = await supabase
      .from('properties')
      .select('id, photos')
      .eq('sender_phone', body.senderPhone)
      .eq('status', 'waiting_photos')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!props?.length) return NextResponse.json({ skipped: true })

    const existing = props[0]
    const updated = [...(existing.photos || []), ...body.photos]

    await supabase
      .from('properties')
      .update({ photos: updated, status: updated.length > 0 ? 'draft' : 'waiting_photos' })
      .eq('id', existing.id)

    return NextResponse.json({ success: true })
  }

  if (body.type === 'account_status') {
    await supabase
      .from('wa_accounts')
      .update({ status: body.status, last_seen: new Date().toISOString() })
      .eq('id', body.accountId)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ skipped: true })
}
