import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { videoId: string } }) {
  const jobs = await prisma.renderJob.findMany({
    where: { videoId: params.videoId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: jobs })
}
