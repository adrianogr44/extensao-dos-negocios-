import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/minio'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { isDefault, filename } = body

  const overlay = await prisma.overlay.findUnique({ where: { id: params.id } })
  if (!overlay) {
    return NextResponse.json({ success: false, error: 'Overlay não encontrada' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof filename === 'string' && filename.trim()) {
    data.filename = filename.trim()
  }
  if (typeof isDefault === 'boolean' && isDefault) {
    // Desmarca qualquer outra overlay padrão no mesmo escopo (por nicho ou global)
    await prisma.overlay.updateMany({
      where: { id: { not: params.id }, nicheId: overlay.nicheId || null, isDefault: true },
      data: { isDefault: false },
    })
    data.isDefault = true
  }

  const updated = await prisma.overlay.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const overlay = await prisma.overlay.findUnique({ where: { id: params.id } })
  if (!overlay) {
    return NextResponse.json({ success: false, error: 'Overlay não encontrada' }, { status: 404 })
  }

  // Os FKs (Profile.overlayId e EditConfig.overlayId) são ON DELETE SET NULL
  await prisma.overlay.delete({ where: { id: params.id } })
  await deleteFile('postreels-overlays', overlay.minioKey).catch(() => {})

  return NextResponse.json({ success: true })
}