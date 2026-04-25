import { createClient } from './db.js'

export async function isDuplicate(property) {
  const supabase = createClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Exact same raw message = definitely duplicate (two workers, same group)
  if (property.raw) {
    const { data } = await supabase.from('properties').select('id')
      .gte('created_at', since)
      .eq('raw_message', property.raw)
      .limit(1)
    if ((data?.length ?? 0) > 0) return true
  }

  return false
}
