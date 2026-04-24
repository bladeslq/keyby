import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Params) {
  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('properties')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
