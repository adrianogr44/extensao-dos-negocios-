import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const replicateSchema = z.object({
  overlayId: z.string().nullish(),
  overlayBehind: z.boolean().default(false),
  posX: z.number().default(0),
  posY: z.number().default(0),
  scale: z.number().default(1.0),
  zoom: z.number().default(1.0),
  volume: z.number().default(1.0),
  rotation: z.number().default(0),
  overlayX: z.number().default(0),
  overlayY: z.number().default(0),
  opacity: z.number().default(1.0),
  texts: z.array(z.object({
    content: z.string(),
    x: z.number(),
    y: z.number(),
    fontSize: z.number(),
    color: z.string(),
  })).default([]),
  overlayCropTop: z.number().int().min(0).default(0),
  overlayCropBottom: z.number().int().min(0).default(0),
  cropTop: z.number().int().min(0).default(0),
  cropBottom: z.number().int().min(0).default(0),
  bgColor: z.string().default('#000000'),
  cropColor: z.string().default('#000000'),
  cropOpacity: z.number().min(0).max(1).default(1.0),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  mirror: z.boolean().default(false),
  eqEnabled: z.boolean().default(false),
  eqBrightness: z.number().default(1.0),
  eqContrast: z.number().default(1.0),
  eqSaturation: z.number().default(1.0),
  grain: z.boolean().default(false),
  grainAmount: z.number().default(0.0),
  frameDrop: z.boolean().default(false),
  zoomBreathing: z.boolean().default(false),
  zoomBreathAmount: z.number().default(0.0),
})

const ALLOWED_FIELDS = [
  'overlayId','overlayBehind',
  'posX','posY','scale','zoom','volume','rotation',
  'overlayX','overlayY','opacity',
  'overlayCropTop','overlayCropBottom',
  'cropTop','cropBottom','bgColor','cropColor','cropOpacity',
  'speed','mirror','texts',
  'eqEnabled','eqBrightness','eqContrast','eqSaturation',
  'grain','grainAmount','frameDrop','zoomBreathing','zoomBreathAmount',
] as const

export async function POST(req: Request, { params }: { params: { profileId: string } }) {
  const body = await req.json()

  const clean: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) clean[key] = body[key]
  }

  const parsed = replicateSchema.safeParse(clean)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
  }

  const profile = await prisma.profile.findUnique({
    where: { id: params.profileId },
    select: { id: true },
  })
  if (!profile) {
    return NextResponse.json({ success: false, error: 'Perfil não encontrado' }, { status: 404 })
  }

  const videos = await prisma.video.findMany({
    where: { profileId: params.profileId },
    select: { id: true },
  })

  // Save edit configs only
  for (const video of videos) {
    await prisma.editConfig.upsert({
      where: { videoId: video.id },
      update: parsed.data,
      create: { videoId: video.id, ...parsed.data },
    })
  }

  return NextResponse.json({ success: true, data: { count: videos.length } })
}
