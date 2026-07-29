import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/minio'
import { convertBigInts } from '@/lib/utils'
import { nanoid } from 'nanoid'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const nicheId = formData.get('nicheId') as string | null
  const shortcode = formData.get('shortcode') as string | null

  if (!file || !nicheId) {
    return NextResponse.json({ success: false, error: 'File and nicheId required' }, { status: 400 })
  }

  // Verify niche exists
  const niche = await prisma.niche.findUnique({ where: { id: nicheId } })
  if (!niche) {
    return NextResponse.json({ success: false, error: 'Niche not found' }, { status: 404 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'mp4'
  const key = `videos/${nicheId}/${nanoid()}.${ext}`

  await uploadFile('postreels-downloads', key, buffer, file.type)

  const video = await prisma.video.create({
    data: {
      filename: file.name,
      minioKey: key,
      minioBucket: 'postreels-downloads',
      sizeBytes: buffer.length,
      nicheId,
    },
  })

  return NextResponse.json({
    success: true,
    data: convertBigInts(video),
  }, { status: 201 })
}
