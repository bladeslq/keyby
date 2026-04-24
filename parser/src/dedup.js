const { createClient } = require('./db')

// Returns true if a similar property already exists (added in last 24h)
async function isDuplicate(property) {
  const supabase = createClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('properties')
    .select('id')
    .gte('created_at', since)

  if (property.price) query = query.eq('price', property.price)
  if (property.district) query = query.eq('district', property.district)
  if (property.address) query = query.ilike('address', `%${property.address.slice(0, 15)}%`)

  const { data } = await query.limit(1)
  return (data?.length ?? 0) > 0
}

module.exports = { isDuplicate }
