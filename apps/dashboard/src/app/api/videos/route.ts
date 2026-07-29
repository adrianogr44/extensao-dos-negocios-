import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { convertBigInts } from '@/lib/utils'

const createVideoSchema = z.object({
  filename: z.string(),
  minioKey: z.string(),
  minioBucket: z.string().default('postreels-downloads'),
  thumbnail: z.string().optional(),
  durationMs: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  sizeBytes: z.number().optional(),
  nicheId: z.string(),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const nicheId = url.searchParams.get('nicheId')
  const status = url.searchParams.get('status')
  const profilesParam = url.searchParams.get('profiles')

  const where: Record<string, unknown> = {}
  if (nicheId) where.nicheId = nicheId
  if (status) where.status = status

  if (profilesParam) {
    const profileIds = profilesParam.split(',')
    where.profileId = { in: profileIds }
  }

  const videos = await prisma.video.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { niche: true, profile: true },
  })
  return NextResponse.json({ success: true, data: convertBigInts(videos) })
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = createVideoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
  }
  const video = await prisma.video.create({
    data: parsed.data,
  })
  return NextResponse.json({ success: true, data: convertBigInts(video) }, { status: 201 })
}
