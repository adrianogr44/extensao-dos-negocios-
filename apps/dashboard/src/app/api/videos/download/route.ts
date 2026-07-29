import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/minio'
import { convertBigInts } from '@/lib/utils'
import { nanoid } from 'nanoid'
import { execa } from 'execa'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'

function buildUrl(shortcode: string, platform: Platform): string {
  switch (platform) {
    case 'FACEBOOK':
      return `https://www.facebook.com/reel/${shortcode}/`
    case 'YOUTUBE':
      return `https://www.youtube.com/shorts/${shortcode}`
    default:
      return `https://www.instagram.com/reel/${shortcode}/`
  }
}

function getFilename(shortcode: string, platform: Platform): string {
  const ext = platform === 'YOUTUBE' ? 'webm' : 'mp4'
  return `${shortcode}.${ext}`
}

export async function POST(req: Request) {
  const body = await req.json()
  const { shortcode, nicheId, profile, platform = 'INSTAGRAM' } = body as {
    shortcode: string
    nicheId: string
    profile?: { username: string; fullName?: string; avatarUrl?: string }
    platform?: Platform
  }

  if (!shortcode || !nicheId) {
    return NextResponse.json(
      { success: false, error: 'shortcode e nicheId são obrigatórios' },
      { status: 400 }
    )
  }

  const niche = await prisma.niche.findUnique({ where: { id: nicheId } })
  if (!niche) {
    return NextResponse.json(
      { success: false, error: 'Niche not found' },
      { status: 404 }
    )
  }

  let profileId: string | undefined
  if (profile?.username) {
    const upserted = await prisma.profile.upsert({
      where: { nicheId_platform_username: { nicheId, platform, username: profile.username } },
      create: {
        username: profile.username,
        fullName: profile.fullName || null,
        avatarUrl: profile.avatarUrl || null,
        nicheId,
        platform,
      },
      update: {
        fullName: profile.fullName || undefined,
        avatarUrl: profile.avatarUrl || undefined,
        platform,
      },
    })
    profileId = upserted.id
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'postreels-'))
  const filename = getFilename(shortcode, platform)
  const dlPath = path.join(tmpDir, filename)
  const videoUrl = buildUrl(shortcode, platform)

  try {
    let caption = ''
    try {
      const { stdout: json } = await execa('yt-dlp', [
        '--dump-json',
        '--no-warnings',
        '--quiet',
        videoUrl,
      ])
      const meta = JSON.parse(json)
      caption = meta?.description || meta?.title || ''
    } catch (metaErr) {
      console.warn(`[download-${platform.toLowerCase()}] Erro ao obter metadados:`, metaErr)
    }

    const format = platform === 'YOUTUBE' ? 'bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best' : 'best[ext=mp4]'
    await execa('yt-dlp', [
      '-f', format,
      '-o', dlPath,
      '--no-warnings',
      '--quiet',
      videoUrl,
    ])

    const buffer = await fs.readFile(dlPath)

    const videoKey = `videos/${nicheId}/${nanoid()}.${platform === 'YOUTUBE' ? 'webm' : 'mp4'}`
    await uploadFile('postreels-downloads', videoKey, buffer, `video/${platform === 'YOUTUBE' ? 'webm' : 'mp4'}`)

    let thumbnailKey = ''
    try {
      const thumbName = `${shortcode}_thumb.jpg`
      const thumbPath = path.join(tmpDir, thumbName)
      await execa('ffmpeg', [
        '-i', dlPath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-q:v', '3',
        '-y', thumbPath,
      ])
      const thumbBuffer = await fs.readFile(thumbPath)
      thumbnailKey = `thumbnails/${nicheId}/${nanoid()}.jpg`
      await uploadFile('postreels-downloads', thumbnailKey, thumbBuffer, 'image/jpeg')
    } catch (err) {
      console.warn(`[download-${platform.toLowerCase()}] Erro ao gerar thumbnail:`, err)
    }

    const video = await prisma.video.create({
      data: {
        filename,
        minioKey: videoKey,
        minioBucket: 'postreels-downloads',
        thumbnail: thumbnailKey || null,
        sizeBytes: buffer.length,
        nicheId,
        profileId: profileId || null,
        platform,
        caption: caption || null,
      },
    })

    return NextResponse.json(
      { success: true, data: convertBigInts(video) },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao baixar vídeo:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao baixar vídeo',
      },
      { status: 500 }
    )
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true })
    } catch {}
  }
}
