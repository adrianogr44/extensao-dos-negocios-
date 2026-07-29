import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFileStream } from '@/lib/minio'

export async function GET(
  _req: Request,
  { params }: { params: { videoId: string } }
) {
  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: {
      renderJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const lastRender = video.renderJobs?.[0]
  if (!lastRender || lastRender.status !== 'completed' || !lastRender.outputKey) {
    return NextResponse.json({ error: 'No completed render available' }, { status: 404 })
  }

  try {
    const body = await getFileStream('postreels-renders', lastRender.outputKey)
    if (!body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const filename = video.filename.replace(/\.[^.]+$/, '') + '-editado.mp4'

    return new Response(body as ReadableStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[Download] Error:', err)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
