import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createNicheSchema = z.object({
  nome: z.string().min(1).max(100),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export async function GET() {
  const nichos = await prisma.niche.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { videos: true } },
      profiles: {
        include: { _count: { select: { videos: true } } },
      },
    },
  })
  return NextResponse.json({ success: true, data: nichos })
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = createNicheSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
  }
  const niche = await prisma.niche.create({ data: parsed.data })
  return NextResponse.json({ success: true, data: niche }, { status: 201 })
}
