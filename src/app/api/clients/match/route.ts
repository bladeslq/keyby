import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

export async function POST(req: Request) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const { clientId } = await req.json()
  const supabase = createServiceClient()

  const [{ data: client }, { data: properties }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('properties').select('*').eq('status', 'published'),
  ])

  if (!client) return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
  if (!properties?.length) return NextResponse.json({ matches: [] })

  const clientDesc = `
Клиент: ${client.name}
Бюджет: ${client.price_min ?? '—'} – ${client.price_max ?? '—'} ₽/мес
Комнат: ${client.rooms?.join(', ') || 'любое'}
Районы: ${client.districts?.join(', ') || 'любой'}
Площадь от: ${client.area_min ?? '—'} м²
Заметки: ${client.notes || 'нет'}
`.trim()

  const propertiesDesc = properties.map((p, i) => `
[${i}] ID: ${p.id}
Название: ${p.title}
Адрес: ${p.address || '—'}, ${p.district || '—'}
Цена: ${p.price ?? '—'} ₽/мес
Комнат: ${p.rooms ?? '—'}, Площадь: ${p.area ?? '—'} м²
Этаж: ${p.floor ?? '—'}/${p.total_floors ?? '—'}
`).join('\n---\n')

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Ты риелтор-помощник. Подбери подходящие объекты недвижимости для клиента.

${clientDesc}

Доступные объекты:
${propertiesDesc}

Верни JSON массив из до 5 лучших совпадений, отсортированных по релевантности:
[
  {
    "index": <индекс объекта>,
    "score": <от 0 до 1, насколько подходит>,
    "reason": "<1-2 предложения почему подходит>"
  }
]

Только JSON, без пояснений.`
    }]
  })

  const content = response.choices[0].message.content?.trim() || '[]'
  const match = content.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ matches: [] })

  let parsed: { index: number; score: number; reason: string }[] = []
  try { parsed = JSON.parse(match[0]) } catch { return NextResponse.json({ matches: [] }) }

  const matches = parsed
    .filter((m) => m.score > 0.4 && properties[m.index])
    .map((m) => ({
      property: properties[m.index],
      score: m.score,
      reason: m.reason,
    }))

  return NextResponse.json({ matches })
}
