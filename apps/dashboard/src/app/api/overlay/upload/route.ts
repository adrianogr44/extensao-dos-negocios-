import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/minio'
import { nanoid } from 'nanoid'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'png'
  const key = `overlays/${nanoid()}.${ext}`

  await uploadFile('postreels-overlays', key, buffer, file.type)

  const overlay = await prisma.overlay.create({
    data: {
      filename: file.name,
      minioKey: key,
      width: 0,
      height: 0,
    },
  })

  const url = `/api/videos/stream/postreels-overlays/${key}`

  return NextResponse.json({
    success: true,
    data: { ...overlay, url },
  })
}

export async function GET() {
  const overlay = await prisma.overlay.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!overlay) {
    return NextResponse.json({ success: true, data: null })
  }

  const url = `/api/videos/stream/postreels-overlays/${overlay.minioKey}`

  return NextResponse.json({
    success: true,
    data: { ...overlay, url },
  })
}
