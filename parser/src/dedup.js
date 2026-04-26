import { createClient } from './db.js'

function normalizeAddress(addr) {
  if (!addr) return null
  return addr
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,;:"'«»()]/g, ' ')
    .replace(/\b(ул|улица|пр|проспект|пер|переулок|б-р|бульвар|пр-кт|пр-т|д|дом|корп|корпус|стр|строение|кв|квартира|г|город)\b\.?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function isDuplicate(property, _senderPhone) {
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

  // 2. Та же цена + тот же тип + тот же нормализованный адрес = дубликат
  //    (отправитель не учитывается — один и тот же объект могут постить разные риелторы)
  const normAddr = normalizeAddress(property.address)
  if (property.type && property.price && normAddr) {
    const { data } = await supabase.from('properties').select('id, address')
      .gte('created_at', since)
      .eq('type', property.type)
      .eq('price', property.price)
    if (data?.length) {
      for (const row of data) {
        if (normalizeAddress(row.address) === normAddr) return true
      }
    }
  }

  return false
}
