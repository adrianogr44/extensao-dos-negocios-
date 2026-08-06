import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const metaAccountId = url.searchParams.get('metaAccountId')

    if (!metaAccountId) {
      return NextResponse.json({ success: false, error: 'metaAccountId required' }, { status: 400 })
    }

    const session = await prisma.facebookSession.findUnique({
      where: { metaAccountId },
      select: { id: true, status: true, loggedInAs: true, fbUserId: true, lastUsedAt: true },
    })

    if (!session) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({ success: true, data: session })
  } catch (err) {
    console.error('[FB Session Status]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar sessão' }, { status: 500 })
  }
}
