import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { downloadFile } from '@/lib/minio'
import { transformCaption } from '@/lib/caption-engine'
import { extractTextFromImage } from '@/lib/caption-engine/OcrService'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { execa } from 'execa'
import { nanoid } from 'nanoid'

type TextItem = { content: string; x: number; y: number; fontSize: number; color: string }

export async function POST(_req: Request, { params }: { params: { profileId: string } }) {
  const videos = await prisma.video.findMany({
    where: { profileId: params.profileId },
    select: { id: true, minioKey: true, minioBucket: true },
  })

  if (videos.length === 0) {
    return NextResponse.json({ success: false, error: 'Nenhum vídeo encontrado' }, { status: 404 })
  }

  let tmpDir = ''
  let processed = 0
  let errors = 0

  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'pr-caption-batch-'))

    for (const video of videos) {
      const videoPath = join(tmpDir, `${nanoid()}.mp4`)
      const framePath = join(tmpDir, `${nanoid()}.jpg`)

      try {
        await downloadFile(video.minioBucket || 'postreels-downloads', video.minioKey, videoPath)

        await execa('ffmpeg', [
          '-i', videoPath,
          '-ss', '00:00:02',
          '-vframes', '1',
          '-q:v', '2',
          '-y', framePath,
        ])

        const ocrText = await extractTextFromImage(framePath)
        if (!ocrText) {
          console.log(`[caption-batch] No text in video ${video.id}, skipping`)
          continue
        }

        const rewritten = await transformCaption(ocrText)

        await prisma.video.update({
          where: { id: video.id },
          data: { caption: ocrText, generatedCaption: rewritten },
        })

        const editConfig = await prisma.editConfig.findUnique({
          where: { videoId: video.id },
          select: { texts: true },
        })

        const existingTexts: TextItem[] = (editConfig?.texts as TextItem[]) || []
        const len = rewritten.length
        const pos = len > 200 ? { x: 40, y: 500, fontSize: 28 }
          : len > 100 ? { x: 50, y: 520, fontSize: 32 }
          : { x: 60, y: 540, fontSize: 36 }

        const newText: TextItem = { content: rewritten, x: pos.x, y: pos.y, fontSize: pos.fontSize, color: '#FFFFFF' }
        const existingIdx = existingTexts.findIndex(t => t.content.includes(rewritten.slice(0, 20)))
        const updatedTexts = existingIdx >= 0
          ? existingTexts.map((t, i) => i === existingIdx ? { ...t, content: rewritten } : t)
          : [...existingTexts, newText]

        await prisma.editConfig.update({
          where: { videoId: video.id },
          data: { texts: updatedTexts },
        })

        processed++
        console.log(`[caption-batch] Video ${video.id} done (${rewritten.length} chars)`)
      } catch (err) {
        errors++
        console.error(`[caption-batch] Failed video ${video.id}:`, err)
      } finally {
        await unlink(videoPath).catch(() => {})
        await unlink(framePath).catch(() => {})
      }
    }
  } finally {
    if (tmpDir) await unlink(tmpDir).catch(() => {})
  }

  return NextResponse.json({ success: true, data: { processed, errors } })
}
