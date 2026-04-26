import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = new Set(['room', 'studio', '1k', '2k', '3k', '4k+', 'house', 'other'])

function normalizeType(t: string | null | undefined): string {
  if (!t) return 'other'
  const lower = String(t).toLowerCase().trim()
  if (ALLOWED_TYPES.has(lower)) return lower
  const m = lower.match(/^(\d+)\s*[kк]\+?$/)
  if (m) {
    const n = parseInt(m[1], 10)
    if (n >= 4) return '4k+'
    if (n >= 1 && n <= 3) return `${n}k`
  }
  return 'other'
}

// Called by the parser service when it finds a new property or receives photos
export async function POST(req: Request) {
  const secret = req.headers.get('x-parser-secret')
  if (secret !== process.env.PARSER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = createServiceClient()

  if (body.type === 'new_property') {
    let normalizedAddress = body.address || null
    if (body.address && process.env.DADATA_TOKEN) {
      try {
        const dadataRes = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${process.env.DADATA_TOKEN}` },
          body: JSON.stringify({ query: `Казань ${body.address}`, count: 1, locations: [{ city: 'Казань' }], restrict_value: true }),
        })
        const dadataData = await dadataRes.json()
        if (dadataData.suggestions?.[0]?.value) {
          normalizedAddress = dadataData.suggestions[0].value
        }
      } catch { /* оставляем как есть */ }
    }

    const { data: inserted, error } = await supabase.from('properties').insert({
      title: body.title,
      address: normalizedAddress,
      district: body.district,
      price: body.price,
      deposit: body.deposit,
      type: normalizeType(body.propertyType),
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
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, id: inserted.id })
  }

  if (body.type === 'photos') {
    if (!body.propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 })

    const { data: prop } = await supabase
      .from('properties')
      .select('id, photos')
      .eq('id', body.propertyId)
      .single()

    if (!prop) return NextResponse.json({ skipped: true })

    const updated = [...(prop.photos || []), ...body.photos]

    await supabase
      .from('properties')
      .update({ photos: updated, status: updated.length > 0 ? 'draft' : 'waiting_photos' })
      .eq('id', prop.id)

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
