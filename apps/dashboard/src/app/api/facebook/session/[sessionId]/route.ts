import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { disconnectSession } from '@/lib/facebook-publisher/session'

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await prisma.facebookSession.findUnique({
      where: { id: params.sessionId },
      select: { id: true, status: true, loggedInAs: true, fbUserId: true, lastUsedAt: true, metaAccountId: true },
    })

    if (!session) {
      return NextResponse.json({ success: false, error: 'Sessão não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: session })
  } catch (err) {
    console.error('[FB Session Status]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar sessão' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await prisma.facebookSession.findUnique({
      where: { id: params.sessionId },
    })

    if (!session || !session.metaAccountId) {
      return NextResponse.json({ success: false, error: 'Sessão não encontrada' }, { status: 404 })
    }

    await disconnectSession(session.metaAccountId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[FB Session Delete]', err)
    return NextResponse.json({ success: false, error: 'Erro ao desconectar sessão' }, { status: 500 })
  }
}
