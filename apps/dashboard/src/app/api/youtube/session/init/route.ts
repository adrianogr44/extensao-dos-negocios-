import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initLogin } from '@/lib/youtube-publisher/session'
import { z } from 'zod'

const schema = z.object({
  youtubeAccountId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const account = await prisma.youtubeAccount.findUnique({
      where: { id: parsed.data.youtubeAccountId },
    })
    if (!account) {
      return NextResponse.json({ success: false, error: 'Conta YouTube não encontrada' }, { status: 404 })
    }

    const result = await initLogin(parsed.data.youtubeAccountId)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[YT Session Init]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro ao iniciar login' },
      { status: 500 }
    )
  }
}
