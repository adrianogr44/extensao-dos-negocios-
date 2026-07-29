import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: { profileId: string } }) {
  const body = await req.json()
  const { overlayId } = body

  const profile = await prisma.profile.findUnique({
    where: { id: params.profileId },
    select: { id: true },
  })
  if (!profile) {
    return NextResponse.json({ success: false, error: 'Perfil não encontrado' }, { status: 404 })
  }

  const updated = await prisma.profile.update({
    where: { id: params.profileId },
    data: { overlayId: overlayId || null },
    include: { overlay: true },
  })

  return NextResponse.json({ success: true, data: updated })
}
