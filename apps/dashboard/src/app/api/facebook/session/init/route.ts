import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initLogin } from '@/lib/facebook-publisher/session'
import { z } from 'zod'

const schema = z.object({
  metaAccountId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const account = await prisma.metaAccount.findUnique({
      where: { id: parsed.data.metaAccountId, isActive: true },
    })
    if (!account) {
      return NextResponse.json({ success: false, error: 'Conta Meta não encontrada ou inativa' }, { status: 404 })
    }

    const result = await initLogin(parsed.data.metaAccountId)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[FB Session Init]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro ao iniciar login' },
      { status: 500 }
    )
  }
}
