import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addRenderJob } from '@/lib/queue'

export async function POST(_req: Request, { params }: { params: { videoId: string } }) {
  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: { editConfigs: true },
  })

  if (!video) {
    return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 })
  }

  const renderJob = await prisma.renderJob.create({
    data: {
      videoId: video.id,
      status: 'queued',
    },
  })

  await addRenderJob(video.id)

  return NextResponse.json({ success: true, data: renderJob })
}
