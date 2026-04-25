import { createClient } from './db.js'

export async function isDuplicate(property) {
  const supabase = createClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Need at least 2 matching fields to consider duplicate
  const checks = []

  if (property.price && property.address) {
    checks.push(
      supabase.from('properties').select('id').gte('created_at', since)
        .eq('price', property.price)
        .ilike('address', `%${property.address.slice(0, 20)}%`)
        .limit(1)
    )
  }

  if (property.price && property.type) {
    checks.push(
      supabase.from('properties').select('id').gte('created_at', since)
        .eq('price', property.price)
        .eq('type', property.type)
        .limit(1)
    )
  }

  if (!checks.length) return false

  const results = await Promise.all(checks)
  return results.some(({ data }) => (data?.length ?? 0) > 0)
}
