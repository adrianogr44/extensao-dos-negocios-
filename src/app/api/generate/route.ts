import { NextRequest, NextResponse } from 'next/server'
import { generateDescription } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json()
    const result = await generateDescription(topic)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao gerar descrição: ' + String(error) },
      { status: 500 }
    )
  }
}
