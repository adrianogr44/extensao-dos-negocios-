import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  channelName: z.string().min(2),
  channelId: z.string().optional(),
})

export async function GET() {
  try {
    const accounts = await prisma.youtubeAccount.findMany({
      select: {
        id: true,
        channelName: true,
        channelId: true,
        profilePictureUrl: true,
        isActive: true,
        connectedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: accounts })
  } catch (err) {
    console.error('[YT Accounts]', err)
    return NextResponse.json({ success: false, error: 'Erro ao listar contas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const account = await prisma.youtubeAccount.create({
      data: {
        channelName: parsed.data.channelName,
        channelId: parsed.data.channelId,
      },
    })

    return NextResponse.json({ success: true, data: account }, { status: 201 })
  } catch (err) {
    console.error('[YT Accounts]', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar conta' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    await prisma.youtubeSession.deleteMany({ where: { youtubeAccountId: id } })
    await prisma.youtubeAccount.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[YT Accounts]', err)
    return NextResponse.json({ success: false, error: 'Erro ao remover conta' }, { status: 500 })
  }
}
