import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/minio'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const videos = await prisma.video.findMany({
    where: { nicheId: params.id },
    select: { id: true, minioBucket: true, minioKey: true, thumbnail: true },
  })

  for (const video of videos) {
    await deleteFile(video.minioBucket, video.minioKey).catch(() => {})
    if (video.thumbnail) {
      await deleteFile(video.minioBucket, video.thumbnail).catch(() => {})
    }
  }

  await prisma.video.deleteMany({ where: { nicheId: params.id } })

  return NextResponse.json({ success: true, deleted: videos.length })
}
