import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pollLogin } from '@/lib/youtube-publisher/session'
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

    const result = await pollLogin(parsed.data.youtubeAccountId)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[YT Session Poll]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro ao verificar login' },
      { status: 500 }
    )
  }
}
