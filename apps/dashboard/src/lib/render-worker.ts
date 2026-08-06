import { Worker } from 'bullmq'
import { prisma } from './prisma'
import { uploadFile, getFileUrl, downloadFile } from './minio'
import { buildOverlayFilter, renderVideo, renderVideoWithProgress, getVideoFps } from './ffmpeg'
import { resolveOverlayForVideo } from './overlay'
import { nanoid } from 'nanoid'
import { execa } from 'execa'
import { readFile, writeFile, unlink, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? Number(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
}

// Deterministic: quantos frames micro-cortar no início (1-2) por vídeo.
function dropFrameCount(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 2) + 1
}

export function startRenderWorker() {
  const concurrency = parseInt(process.env.RENDER_WORKER_CONCURRENCY || '2', 10)
  const worker = new Worker('video-render', async job => {
    const { videoId, batchId } = job.data

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { editConfigs: true },
    })

    if (!video) throw new Error(`Video ${videoId} not found`)

    const editConfig = video.editConfigs
    if (!editConfig) throw new Error(`No edit config for video ${videoId}`)

    // Get overlay (hierarquia: editor > perfil > nicho > global)
    const overlay = await resolveOverlayForVideo({
      nicheId: video.nicheId,
      profileId: video.profileId,
      editConfigs: video.editConfigs,
    })
    if (!overlay) throw new Error('No overlay configured')

    // Update status
    await prisma.renderJob.updateMany({
      where: { videoId, batchId: batchId || undefined },
      data: { status: 'processing', startedAt: new Date() },
    })

    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'processing' },
    })

    // Create temp directory
    const tmpDir = await mkdtemp(join(tmpdir(), 'pr-render-'))
    const inputPath = join(tmpDir, `input_${videoId}.mp4`)
    const overlayPath = join(tmpDir, `overlay_${videoId}.png`)
    const outputPath = join(tmpDir, `output_${videoId}.mp4`)

    try {
      // Download video from MinIO using SDK (com autenticação)
      console.log(`[render-worker] Baixando vídeo: ${video.minioBucket}/${video.minioKey}`)
      console.log(`[render-worker] Baixando overlay: postreels-overlays/${overlay.minioKey}`)

      const videoSize = await downloadFile(video.minioBucket, video.minioKey, inputPath)
      const overlaySize = await downloadFile('postreels-overlays', overlay.minioKey, overlayPath)

      console.log(`[render-worker] ✓ Vídeo baixado: ${videoSize} bytes`)
      console.log(`[render-worker] ✓ Overlay baixado: ${overlaySize} bytes`)

      if (videoSize === 0) {
        throw new Error(`Video file is empty (0 bytes)`)
      }
      if (overlaySize === 0) {
        throw new Error(`Overlay file is empty (0 bytes)`)
      }

      // Build FFmpeg args
      console.log(`[render-worker] Building filter for video ${videoId}`)
      const inputFps = editConfig.zoomBreathing ? await getVideoFps(inputPath) : 0
      const args = await buildOverlayFilter({
        inputVideo: inputPath,
        inputOverlay: overlayPath,
        outputPath,
        video: {
          posX: editConfig.posX,
          posY: editConfig.posY,
          scale: editConfig.scale,
          zoom: editConfig.zoom,
          rotation: editConfig.rotation ?? 0,
        },
        overlay: {
          posX: editConfig.overlayX,
          posY: editConfig.overlayY,
          cropTop: editConfig.overlayCropTop ?? 0,
          cropBottom: editConfig.overlayCropBottom ?? 0,
          opacity: editConfig.opacity,
        },
        volume: editConfig.volume,
        overlayBehind: editConfig.overlayBehind ?? false,
        videoDurationMs: video.durationMs,
        cropTop: editConfig.cropTop || 0,
        cropBottom: editConfig.cropBottom || 0,
        bgColor: editConfig.bgColor || '#000000',
        cropColor: editConfig.cropColor || '#000000',
        cropOpacity: editConfig.cropOpacity ?? 1,
        speed: editConfig.speed ?? 1,
        mirror: editConfig.mirror ?? false,
        eq: editConfig.eqEnabled
          ? {
              brightness: editConfig.eqBrightness ?? 1,
              contrast: editConfig.eqContrast ?? 1,
              saturation: editConfig.eqSaturation ?? 1,
            }
          : undefined,
        grain: editConfig.grain ? { amount: editConfig.grainAmount ?? 0 } : undefined,
        frameDrop: editConfig.frameDrop ? { frames: dropFrameCount(videoId) } : undefined,
        zoomBreathing: editConfig.zoomBreathing ? { amount: editConfig.zoomBreathAmount ?? 0 } : undefined,
        inputFps: inputFps,
        texts: (editConfig.texts as Array<{ content: string; x: number; y: number; fontSize: number; color: string }>) || undefined,
      })

      // Render com progresso via BullMQ
      await renderVideoWithProgress(args, job)

      // Upload output
      const outputBuffer = await readFile(outputPath)
      const outputKey = `renders/${video.nicheId}/${nanoid()}.mp4`

      await uploadFile('postreels-renders', outputKey, outputBuffer, 'video/mp4')

      // Update records
      await prisma.renderJob.updateMany({
        where: { videoId, batchId: batchId || undefined },
        data: {
          status: 'completed',
          outputKey,
          finishedAt: new Date(),
          progress: 100,
        },
      })

      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'completed' },
      })
    } catch (err) {
      await prisma.renderJob.updateMany({
        where: { videoId, batchId: batchId || undefined },
        data: {
          status: 'error',
          errorMessage: (err as Error).message,
          finishedAt: new Date(),
        },
      })

      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'error', errorMsg: (err as Error).message },
      })

      throw err
    } finally {
      // Cleanup temp files
      try {
        await unlink(inputPath).catch(() => {})
        await unlink(overlayPath).catch(() => {})
        await unlink(outputPath).catch(() => {})
        await execa('rmdir', [tmpDir]).catch(() => {})
      } catch {}
    }
  }, { connection, concurrency })

  worker.on('completed', job => {
    console.log(`[render-worker] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[render-worker] Job ${job?.id} failed:`, err.message)
  })

  console.log(`[render-worker] Started with concurrency=${concurrency} (processando até ${concurrency} vídeos em paralelo)`)

  return worker
}
