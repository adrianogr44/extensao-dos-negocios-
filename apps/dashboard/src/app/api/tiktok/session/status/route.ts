import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const tiktokAccountId = url.searchParams.get('tiktokAccountId')

    if (!tiktokAccountId) {
      return NextResponse.json({ success: false, error: 'tiktokAccountId required' }, { status: 400 })
    }

    const session = await prisma.tiktokSession.findUnique({
      where: { tiktokAccountId },
      select: { id: true, status: true, loggedInAs: true, ttUserId: true, lastUsedAt: true },
    })

    if (!session) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({ success: true, data: session })
  } catch (err) {
    console.error('[TT Session Status]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar sessão' }, { status: 500 })
  }
}
