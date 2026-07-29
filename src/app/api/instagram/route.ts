import { NextRequest, NextResponse } from 'next/server'
import { postToInstagram } from '@/lib/instagram'

export async function POST(req: NextRequest) {
  try {
    const { username, password, videoPath, caption } = await req.json()

    if (!username || !password || !videoPath) {
      return NextResponse.json(
        { error: 'Username, password e videoPath são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await postToInstagram(
      { username, password },
      videoPath,
      caption || ''
    )

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao postar no Instagram: ' + String(error) },
      { status: 500 }
    )
  }
}
