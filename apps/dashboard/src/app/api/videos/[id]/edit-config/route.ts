import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const editConfigSchema = z.object({
  posX: z.number().default(0),
  posY: z.number().default(0),
  scale: z.number().default(1.0),
  zoom: z.number().default(1.0),
  volume: z.number().default(1.0),
  rotation: z.number().default(0),
  overlayX: z.number().default(0),
  overlayY: z.number().default(0),
  overlayCropTop: z.number().int().min(0).default(0),
  overlayCropBottom: z.number().int().min(0).default(0),
  opacity: z.number().default(1.0),
  cropTop: z.number().int().min(0).default(0),
  cropBottom: z.number().int().min(0).default(0),
  bgColor: z.string().default("#000000"),
  cropColor: z.string().default("#000000"),
  cropOpacity: z.number().min(0).max(1).default(1.0),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  mirror: z.boolean().default(false),
  texts: z.array(z.object({
    content: z.string(),
    x: z.number(),
    y: z.number(),
    fontSize: z.number(),
    color: z.string(),
  })).default([]),
})

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const parsed = editConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
  }

  const config = await prisma.editConfig.upsert({
    where: { videoId: params.id },
    update: parsed.data,
    create: { videoId: params.id, ...parsed.data },
  })
  return NextResponse.json({ success: true, data: config })
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const config = await prisma.editConfig.findUnique({
    where: { videoId: params.id },
  })
  return NextResponse.json({ success: true, data: config })
}
