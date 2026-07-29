import { NextResponse } from 'next/server'
import { getFileStream } from '@/lib/minio'

export async function GET(
  _req: Request,
  { params }: { params: { bucket: string; key: string[] } }
) {
  const key = params.key.join('/')

  try {
    const body = await getFileStream(params.bucket, key)
    if (!body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const ext = key.split('.').pop()?.toLowerCase()
    const mime: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    }

    return new Response(body as ReadableStream, {
      headers: {
        'Content-Type': mime[ext || ''] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[Stream] Error:', err)
    return NextResponse.json({ error: 'Failed to stream file' }, { status: 500 })
  }
}
