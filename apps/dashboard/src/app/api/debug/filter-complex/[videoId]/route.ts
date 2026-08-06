import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildOverlayFilter } from '@/lib/ffmpeg'

export async function GET(_req: Request, { params }: { params: { videoId: string } }) {
  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: { editConfigs: true },
  })

  if (!video?.editConfigs) {
    return NextResponse.json({ error: 'No edit config' }, { status: 404 })
  }

  const args = await buildOverlayFilter({
    inputVideo: '/tmp/input.mp4',
    inputOverlay: '/tmp/overlay.png',
    outputPath: '/tmp/output.mp4',
    video: {
      posX: video.editConfigs.posX,
      posY: video.editConfigs.posY,
      scale: video.editConfigs.scale,
      zoom: video.editConfigs.zoom,
      rotation: video.editConfigs.rotation ?? 0,
    },
    overlay: {
      posX: video.editConfigs.overlayX,
      posY: video.editConfigs.overlayY,
      cropTop: video.editConfigs.overlayCropTop ?? 0,
      cropBottom: video.editConfigs.overlayCropBottom ?? 0,
      opacity: video.editConfigs.opacity,
    },
    volume: video.editConfigs.volume,
    overlayBehind: video.editConfigs.overlayBehind ?? false,
    videoDurationMs: video.durationMs,
    cropTop: video.editConfigs.cropTop || 0,
    cropBottom: video.editConfigs.cropBottom || 0,
    bgColor: video.editConfigs.bgColor || '#000000',
    cropColor: video.editConfigs.cropColor || '#000000',
    cropOpacity: video.editConfigs.cropOpacity ?? 1,
    speed: video.editConfigs.speed ?? 1,
    mirror: video.editConfigs.mirror ?? false,
    eq: video.editConfigs.eqEnabled
      ? {
          brightness: video.editConfigs.eqBrightness ?? 1,
          contrast: video.editConfigs.eqContrast ?? 1,
          saturation: video.editConfigs.eqSaturation ?? 1,
        }
      : undefined,
    grain: video.editConfigs.grain ? { amount: video.editConfigs.grainAmount ?? 0 } : undefined,
    frameDrop: video.editConfigs.frameDrop ? { frames: 1 } : undefined,
    zoomBreathing: video.editConfigs.zoomBreathing ? { amount: video.editConfigs.zoomBreathAmount ?? 0 } : undefined,
    inputFps: 30,
    texts: (video.editConfigs.texts as any) || undefined,
  })

  const filterComplexIndex = args.indexOf('-filter_complex')
  const filterComplex = args[filterComplexIndex + 1]

  return NextResponse.json({ filterComplex })
}
