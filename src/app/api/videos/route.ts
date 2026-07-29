import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { VIDEOS_DIR, ensureVideosDir, getVideoDuration } from '@/lib/video-processor'

export async function GET() {
  await ensureVideosDir()
  const files = await fs.readdir(VIDEOS_DIR)
  const videos = await Promise.all(
    files
      .filter((f) => f.match(/\.(mp4|mov|avi|mkv)$/i))
      .map(async (filename) => {
        const filepath = path.join(VIDEOS_DIR, filename)
        const stat = await fs.stat(filepath)
        const duration = await getVideoDuration(filepath)
        return {
          id: filename,
          filename,
          filepath,
          duration,
          status: 'pending' as const,
          createdAt: stat.birthtime.toISOString(),
        }
      })
  )
  return NextResponse.json({ videos })
}

export async function POST(req: NextRequest) {
  await ensureVideosDir()
  const formData = await req.formData()
  const file = formData.get('video') as File

  if (!file) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const filename = `${Date.now()}-${file.name}`
  const filepath = path.join(VIDEOS_DIR, filename)

  await fs.writeFile(filepath, buffer)
  const duration = await getVideoDuration(filepath)

  return NextResponse.json({
    id: filename,
    filename,
    filepath,
    duration,
    status: 'pending',
    createdAt: new Date().toISOString(),
  })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filename = searchParams.get('filename')

  if (!filename) {
    return NextResponse.json({ error: 'filename é obrigatório' }, { status: 400 })
  }

  const filepath = path.join(VIDEOS_DIR, filename)
  await fs.unlink(filepath).catch(() => {})

  return NextResponse.json({ success: true })
}
