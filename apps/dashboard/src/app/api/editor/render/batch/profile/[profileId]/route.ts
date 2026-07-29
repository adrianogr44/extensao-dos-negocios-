import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addRenderJob } from '@/lib/queue'

export async function POST(_req: Request, { params }: { params: { profileId: string } }) {
  const body = await _req.json()
  const { videoIds } = body as { videoIds: string[] }

  if (!videoIds?.length) {
    return NextResponse.json({ success: false, error: 'No videos provided' }, { status: 400 })
  }

  const videos = await prisma.video.findMany({
    where: { id: { in: videoIds }, profileId: params.profileId },
  })

  if (!videos.length) {
    return NextResponse.json({ success: false, error: 'No videos found' }, { status: 404 })
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
