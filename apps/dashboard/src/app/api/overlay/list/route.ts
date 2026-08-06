import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { overlayUrl } from '@/lib/overlay'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const nicheId = searchParams.get('nicheId')

  const overlays = await prisma.overlay.findMany({
    where: nicheId
      ? { OR: [{ nicheId }, { nicheId: null }] }
      : undefined,
    orderBy: [{ nicheId: { sort: 'asc', nulls: 'first' } }, { isDefault: 'desc' }, { createdAt: 'desc' }],
  })

  const data = overlays.map(o => ({
    ...o,
    url: overlayUrl(o.minioKey),
  }))

  return NextResponse.json({ success: true, data })
}