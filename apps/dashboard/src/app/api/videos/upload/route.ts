import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/minio'
import { convertBigInts } from '@/lib/utils'
import { nanoid } from 'nanoid'
import { execa } from 'execa'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const nicheId = formData.get('nicheId') as string | null
  const shortcode = formData.get('shortcode') as string | null
  const profileId = (formData.get('profileId') as string | null) || null
  const platform = (formData.get('platform') as string | null) || 'INSTAGRAM'

  if (!file || !nicheId) {
    return NextResponse.json({ success: false, error: 'File and nicheId required' }, { status: 400 })
  }

  const validPlatforms = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE']
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({ success: false, error: 'Invalid platform' }, { status: 400 })
  }

  // Verify niche exists
  const niche = await prisma.niche.findUnique({ where: { id: nicheId } })
  if (!niche) {
    return NextResponse.json({ success: false, error: 'Niche not found' }, { status: 404 })
  }

  // Verify profile (if provided) belongs to the niche
  if (profileId) {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } })
    if (!profile || profile.nicheId !== nicheId) {
      return NextResponse.json({ success: false, error: 'Profile not found in this niche' }, { status: 404 })
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'mp4'
  const key = `videos/${nicheId}/${nanoid()}.${ext}`

  await uploadFile('postreels-downloads', key, buffer, file.type)

  // Gera thumbnail (1º frame) com ffmpeg
  let thumbnailKey: string | null = null
  const tmpDir = await mkdtemp(join(tmpdir(), 'pr-thumb-'))
  try {
    const inputPath = join(tmpDir, `input.${ext}`)
    await writeFile(inputPath, buffer)
    const thumbPath = join(tmpDir, 'thumb.jpg')
    await execa(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-i', inputPath,
      '-ss', '00:00:01',
      '-vframes', '1',
      '-q:v', '3',
      '-y', thumbPath,
    ])
    const thumbBuffer = await readFile(thumbPath)
    thumbnailKey = `thumbnails/${nicheId}/${nanoid()}.jpg`
    await uploadFile('postreels-downloads', thumbnailKey, thumbBuffer, 'image/jpeg')
  } catch (err) {
    console.warn('[upload] Erro ao gerar thumbnail:', err)
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }

  const video = await prisma.video.create({
    data: {
      filename: file.name,
      minioKey: key,
      minioBucket: 'postreels-downloads',
      thumbnail: thumbnailKey,
      sizeBytes: buffer.length,
      nicheId,
      profileId: profileId || undefined,
      platform: platform as 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE',
    },
  })

  return NextResponse.json({
    success: true,
    data: convertBigInts(video),
  }, { status: 201 })
}
