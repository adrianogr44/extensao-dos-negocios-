import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { downloadFile, uploadFile } from '@/lib/minio'
import { nanoid } from 'nanoid'
import { execa } from 'execa'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export async function POST() {
  const videos = await prisma.video.findMany({
    where: { thumbnail: null },
    select: { id: true, minioBucket: true, minioKey: true, nicheId: true },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })

  let generated = 0
  let failed = 0

  for (const video of videos) {
    const tmpDir = await mkdtemp(join(tmpdir(), 'pr-thumb-'))
    try {
      const inputPath = join(tmpDir, 'input.mp4')
      const thumbPath = join(tmpDir, 'thumb.jpg')

      try {
        await downloadFile(video.minioBucket, video.minioKey, inputPath)
      } catch (err) {
        console.warn(`[thumb-backfill] ${video.id}: download falhou:`, (err as Error).message)
        failed++
        continue
      }

      await execa(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-i', inputPath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-q:v', '3',
        '-y', thumbPath,
      ])

      const thumbBuffer = await readFile(thumbPath)
      const thumbnailKey = `thumbnails/${video.nicheId}/${nanoid()}.jpg`
      await uploadFile('postreels-downloads', thumbnailKey, thumbBuffer, 'image/jpeg')

      await prisma.video.update({
        where: { id: video.id },
        data: { thumbnail: thumbnailKey },
      })

      generated++
    } catch (err) {
      console.warn(`[thumb-backfill] ${video.id}:`, (err as Error).message)
      failed++
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true, generated, failed, remaining: Math.max(0, videos.length - generated) })
}
