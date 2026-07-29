import OpenAI from 'openai'

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

export async function generateDescription(videoTopic?: string): Promise<{
  title: string
  description: string
  hashtags: string[]
}> {
  const prompt = videoTopic
    ? `Crie um título, descrição e hashtags para um Reels sobre: ${videoTopic}`
    : `Crie um título criativo, descrição e hashtags para um Reels do Instagram.`

  const openai = getOpenAI()
  if (!openai) {
    return { title: 'Reels automático', description: '', hashtags: [] }
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Você gera títulos, descrições e hashtags para Reels do Instagram. Responda em português brasileiro. Formato: TÍTULO: ... | DESCRIÇÃO: ... | HASHTAGS: ...',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
  })

  const text = response.choices[0]?.message?.content || ''

  const titleMatch = text.match(/TÍTULO:\s*(.+)/i)
  const descMatch = text.match(/DESCRIÇÃO:\s*(.+)/i)
  const hashtagMatch = text.match(/HASHTAGS:\s*(.+)/i)

  return {
    title: titleMatch?.[1]?.trim() || 'Reels automático',
    description: descMatch?.[1]?.trim() || '',
    hashtags: hashtagMatch?.[1]?.split(/\s+/) || [],
  }
}
