import { createClient } from './db.js'

export async function isDuplicate(property, senderPhone) {
  const supabase = createClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1. Точно одно сообщение (два воркера получили одно WA-сообщение)
  if (property.raw) {
    const { data } = await supabase.from('properties').select('id')
      .gte('created_at', since)
      .eq('raw_message', property.raw)
      .limit(1)
    if ((data?.length ?? 0) > 0) return true
  }

  // 2. Тот же продавец + тот же тип + та же цена + ТОТ ЖЕ адрес = повторная публикация
  if (senderPhone && property.type && property.price && property.address) {
    const { data } = await supabase.from('properties').select('id')
      .gte('created_at', since)
      .eq('sender_phone', senderPhone)
      .eq('type', property.type)
      .eq('price', property.price)
      .ilike('address', `%${property.address.slice(0, 25)}%`)
      .limit(1)
    if ((data?.length ?? 0) > 0) return true
  }

  return false
}
