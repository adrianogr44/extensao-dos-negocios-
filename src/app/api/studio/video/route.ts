import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { ENVS } from '@/lib/studio-data'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const envId = url.searchParams.get('env')
  const file = url.searchParams.get('file') || ''
  const env = ENVS.find((e) => e.id === envId)
  if (!env || !file) return new Response(null, { status: 400 })

  const filename = path.basename(file)
  if (!/^.+\.(mp4|mov|avi|mkv)$/i.test(filename)) return new Response(null, { status: 400 })

  const videoPath = path.join(env.videosDir, filename)
  if (!fs.existsSync(videoPath)) return new Response(null, { status: 404 })

  const stat = fs.statSync(videoPath)
  const size = stat.size
  const range = req.headers.get('range')

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    if (!m) return new Response(null, { status: 416 })
    const start = m[1] ? parseInt(m[1], 10) : 0
    const end = m[2] ? parseInt(m[2], 10) : Math.min(start + 1024 * 1024, size - 1)
    if (start >= size || end >= size) return new Response(null, { status: 416 })
    const v = fs.createReadStream(videoPath, { start, end })
    return new Response(Readable.toWeb(v) as ReadableStream, {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=60',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }

  const v = fs.createReadStream(videoPath)
  return new Response(Readable.toWeb(v) as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=60',
      'Content-Length': String(size),
    },
  })
}
