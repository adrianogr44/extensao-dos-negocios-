import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const overlays = await prisma.overlay.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const data = overlays.map(o => ({
    ...o,
    url: `/api/videos/stream/postreels-overlays/${o.minioKey}`,
  }))

  return NextResponse.json({ success: true, data })
}
