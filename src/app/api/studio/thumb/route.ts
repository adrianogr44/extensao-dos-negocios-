import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { ENVS } from '@/lib/studio-data'

export const dynamic = 'force-dynamic'

const THUMB_DIR = path.join(process.cwd(), '.cache', 'thumbs')

function sanitize(filename: string): string {
  const base = path.basename(filename)
  if (!/^[\w\d\-_\s().]+(\.mp4|\.mov|\.avi|\.mkv)?$/i.test(base)) return ''
  return base
}

async function generateThumb(videoPath: string, thumbPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      'ffmpeg',
      ['-y', '-ss', '1', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '5', thumbPath],
      { timeout: 30000, windowsHide: true },
      (err) => (err ? reject(err) : resolve())
    )
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const envId = url.searchParams.get('env')
  const file = url.searchParams.get('file') || ''
  const env = ENVS.find((e) => e.id === envId)
  if (!env || !file) return new NextResponse(null, { status: 400 })

  const filename = sanitize(file)
  if (!filename) return new NextResponse(null, { status: 400 })

  const videoPath = path.join(env.videosDir, filename)
  if (!fs.existsSync(videoPath)) return new NextResponse(null, { status: 404 })

  const stat = fs.statSync(videoPath)
  const hash = crypto.createHash('md5').update(`${env.id}-${filename}-${stat.mtimeMs}`).digest('hex')
  const thumbPath = path.join(THUMB_DIR, `${hash}.jpg`)
  fs.mkdirSync(THUMB_DIR, { recursive: true })

  if (!fs.existsSync(thumbPath)) {
    try {
      await generateThumb(videoPath, thumbPath)
    } catch {
      return new NextResponse(null, { status: 415 })
    }
  }
  const data = fs.readFileSync(thumbPath)
  return new NextResponse(data, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}