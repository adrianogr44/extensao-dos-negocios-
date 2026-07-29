import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  shortcodes: z.array(z.string().min(1)).min(1),
  nicheId: z.string().min(1),
  platform: z.enum(['INSTAGRAM', 'FACEBOOK', 'YOUTUBE']).default('INSTAGRAM'),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
  }

  const { shortcodes, nicheId, platform } = parsed.data
  const ext = platform === 'YOUTUBE' ? 'webm' : 'mp4'
  const filenames = shortcodes.map(sc => `${sc}.${ext}`)

  const existing = await prisma.video.findMany({
    where: { nicheId, filename: { in: filenames } },
    select: { filename: true },
  })

  const existingShortcodes = existing.map(v => v.filename.replace(/\.(mp4|webm)$/, ''))

  return NextResponse.json({ success: true, data: { existing: existingShortcodes } })
}
