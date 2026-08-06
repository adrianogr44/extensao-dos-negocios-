import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initLogin } from '@/lib/tiktok-publisher/session'
import { z } from 'zod'

const schema = z.object({
  tiktokAccountId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const account = await prisma.tiktokAccount.findUnique({
      where: { id: parsed.data.tiktokAccountId },
    })
    if (!account) {
      return NextResponse.json({ success: false, error: 'Conta TikTok não encontrada' }, { status: 404 })
    }

    const result = await initLogin(parsed.data.tiktokAccountId)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[TT Session Init]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro ao iniciar login' },
      { status: 500 }
    )
  }
}
