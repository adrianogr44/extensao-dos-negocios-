import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/minio'
import { convertBigInts } from '@/lib/utils'

export async function GET(_req: Request, { params }: { params: { profileId: string } }) {
  const profile = await prisma.profile.findUnique({
    where: { id: params.profileId },
    include: {
      _count: { select: { videos: true } },
      overlay: true,
      videos: {
        orderBy: { createdAt: 'desc' },
        include: {
          renderJobs: {
            where: { status: 'completed' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })
  if (!profile) {
    return NextResponse.json({ success: false, error: 'Perfil não encontrado' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: convertBigInts(profile) })
}

export async function DELETE(_req: Request, { params }: { params: { profileId: string } }) {
  const profile = await prisma.profile.findUnique({
    where: { id: params.profileId },
    select: { id: true },
  })
  if (!profile) {
    return NextResponse.json({ success: false, error: 'Perfil não encontrado' }, { status: 404 })
  }

  const videos = await prisma.video.findMany({
    where: { profileId: params.profileId },
    select: { minioBucket: true, minioKey: true, thumbnail: true },
  })

  for (const video of videos) {
    await deleteFile(video.minioBucket, video.minioKey).catch(() => {})
    if (video.thumbnail) {
      await deleteFile(video.minioBucket, video.thumbnail).catch(() => {})
    }
  }

  await prisma.video.deleteMany({ where: { profileId: params.profileId } })
  await prisma.profile.delete({ where: { id: params.profileId } })

  return NextResponse.json({ success: true })
}
