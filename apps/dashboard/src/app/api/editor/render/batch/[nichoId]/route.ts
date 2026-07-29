import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addRenderJob } from '@/lib/queue'

export async function POST(_req: Request, { params }: { params: { nichoId: string } }) {
  const videos = await prisma.video.findMany({
    where: { nicheId: params.nichoId, status: { not: 'error' } },
  })

  if (!videos.length) {
    return NextResponse.json({ success: false, error: 'No videos found in niche' }, { status: 404 })
  }

  const batchId = crypto.randomUUID()

  await prisma.renderJob.createMany({
    data: videos.map((v: { id: string }) => ({
      videoId: v.id,
      status: 'queued',
      batchId,
    })),
  })

  await Promise.all(videos.map((v: { id: string }) => addRenderJob(v.id, batchId)))

  return NextResponse.json({ success: true, data: { batchId, count: videos.length } })
}
