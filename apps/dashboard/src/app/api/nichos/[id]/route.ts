import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateNicheSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const parsed = updateNicheSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
  }
  const niche = await prisma.niche.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return NextResponse.json({ success: true, data: niche })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.niche.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
