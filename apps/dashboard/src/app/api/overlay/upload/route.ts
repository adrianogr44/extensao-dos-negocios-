import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/minio'
import { overlayUrl } from '@/lib/overlay'
import { nanoid } from 'nanoid'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const nicheId = (formData.get('nicheId') as string | null) || null
  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'png'
  const key = `overlays/${nanoid()}.${ext}`

  await uploadFile('postreels-overlays', key, buffer, file.type)

  // Marca como padrão se for a primeira overlay do escopo (por nicho ou global)
  const existingCount = await prisma.overlay.count({
    where: { nicheId: nicheId || null },
  })

  const overlay = await prisma.overlay.create({
    data: {
      filename: file.name,
      minioKey: key,
      width: 0,
      height: 0,
      nicheId,
      isDefault: existingCount === 0,
    },
  })

  return NextResponse.json({
    success: true,
    data: { ...overlay, url: overlayUrl(overlay.minioKey) },
  })
}

export async function GET() {
  const overlay = await prisma.overlay.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!overlay) {
    return NextResponse.json({ success: true, data: null })
  }

  return NextResponse.json({
    success: true,
    data: { ...overlay, url: overlayUrl(overlay.minioKey) },
  })
}