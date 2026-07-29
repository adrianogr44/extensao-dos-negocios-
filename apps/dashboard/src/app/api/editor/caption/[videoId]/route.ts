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

export async function POST(_req: Request, { params }: { params: { videoId: string } }) {
  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    select: { id: true, minioKey: true, minioBucket: true },
  })
  if (!video) {
    return NextResponse.json({ success: false, error: 'Vídeo não encontrado' }, { status: 404 })
  }

  let tmpDir = ''
  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'pr-caption-'))
    const videoPath = join(tmpDir, `${nanoid()}.mp4`)
    const framePath = join(tmpDir, `${nanoid()}.jpg`)

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
      return NextResponse.json({ success: false, error: 'Nenhum texto encontrado no vídeo' }, { status: 400 })
    }

    const rewritten = await transformCaption(ocrText)

    await prisma.video.update({
      where: { id: video.id },
      data: {
        caption: ocrText,
        generatedCaption: rewritten,
      },
    })

    // Add as text overlay
    const editConfig = await prisma.editConfig.findUnique({
      where: { videoId: video.id },
      select: { texts: true },
    })

    const existingTexts: TextItem[] = (editConfig?.texts as TextItem[]) || []
    const inputLen = rewritten.length
    const pos = inputLen > 200
      ? { x: 40, y: 500, fontSize: 28 }
      : inputLen > 100
        ? { x: 50, y: 520, fontSize: 32 }
        : { x: 60, y: 540, fontSize: 36 }

    const newText: TextItem = {
      content: rewritten,
      x: pos.x,
      y: pos.y,
      fontSize: pos.fontSize,
      color: '#FFFFFF',
    }

    const existingAiIdx = existingTexts.findIndex(t => t.content.includes(rewritten.slice(0, 20)))
    const updatedTexts = existingAiIdx >= 0
      ? existingTexts.map((t, i) => i === existingAiIdx ? { ...t, content: rewritten } : t)
      : [...existingTexts, newText]

    await prisma.editConfig.update({
      where: { videoId: video.id },
      data: { texts: updatedTexts },
    })

    return NextResponse.json({
      success: true,
      data: {
        caption: ocrText,
        generatedCaption: rewritten,
        textOverlay: newText,
      },
    })
  } catch (err) {
    console.error('[caption] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro ao gerar legenda' },
      { status: 500 }
    )
  } finally {
    if (tmpDir) {
      await unlink(tmpDir).catch(() => {})
    }
  }
}
