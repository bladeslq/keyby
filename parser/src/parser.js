const Groq = require('groq-sdk')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

async function parseMessage(text) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Ты парсер объявлений о недвижимости из чата риелторов Казани (Россия), цены в рублях.

Районы Казани: Вахитовский, Авиастроительный, Ново-Савиновский, Московский, Кировский, Приволжский, Советский, Азино, Горки, Дербышки, Салават Купере, Танкодром, Академический, Компрессорный, Борисково.

Правила:
- "цп", "ЦП", "центр" = Вахитовский
- Определяй район по улице, ЖК, метро если прямо не указан
- Тип: room/studio/1k/2k/3k/4k+/house/other
- Площадь, этаж/этажность извлекай если есть

Если это НЕ объявление об аренде/продаже (приветствие, вопрос, флуд) — верни: null

Если объявление — верни JSON без пояснений:
{
  "title": "краткое название (тип + ЖК или адрес)",
  "type": "тип объекта",
  "district": "район или null",
  "address": "адрес или null",
  "price": число или null,
  "deposit": число или null,
  "rooms": число или null,
  "area": число или null,
  "floor": число или null,
  "totalFloors": число или null,
  "description": "доп детали или null",
  "raw": "оригинал сообщения"
}

Сообщение:
${text}`,
    }],
  })

  const content = response.choices[0].message.content.trim()
  if (content === 'null') return null

  const match = content.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

module.exports = { parseMessage }
