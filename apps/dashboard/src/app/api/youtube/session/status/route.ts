import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const youtubeAccountId = url.searchParams.get('youtubeAccountId')

    if (!youtubeAccountId) {
      return NextResponse.json({ success: false, error: 'youtubeAccountId required' }, { status: 400 })
    }

    const session = await prisma.youtubeSession.findUnique({
      where: { youtubeAccountId },
      select: { id: true, status: true, loggedInAs: true, googleUserId: true, lastUsedAt: true },
    })

    if (!session) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({ success: true, data: session })
  } catch (err) {
    console.error('[YT Session Status]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar sessão' }, { status: 500 })
  }
}
