import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/minio'
import { convertBigInts } from '@/lib/utils'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const video = await prisma.video.findUnique({
    where: { id: params.id },
    include: { niche: true, editConfigs: true },
  })
  if (!video) {
    return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: convertBigInts(video) })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const video = await prisma.video.findUnique({ where: { id: params.id } })
  if (!video) {
    return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 })
  }

  await deleteFile(video.minioBucket, video.minioKey).catch(() => {})
  if (video.thumbnail) {
    await deleteFile(video.minioBucket, video.thumbnail).catch(() => {})
  }

  await prisma.video.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
