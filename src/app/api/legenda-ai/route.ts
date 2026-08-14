import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { generateCaptionFromVideo } from '@/lib/legenda-ai'
import { ENVS } from '@/lib/studio-data'

export const dynamic = 'force-dynamic'

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm']

function isAllowedVideoPath(p: string): boolean {
  const resolved = path.resolve(p)
  for (const env of ENVS) {
    const base = path.resolve(env.videosDir).toLowerCase()
    if (resolved.toLowerCase().startsWith(base + path.sep) || resolved.toLowerCase() === base) {
      return true
    }
  }
  return false
}

function resolveEnvVideo(env: string, filename: string): string | null {
  const config = ENVS.find((e) => e.id === env)
  if (!config || !/^[\w\d\s\-_.()\[\]]+\.(mp4|mov|avi|mkv|webm)$/i.test(filename)) return null
  const p = path.join(config.videosDir, filename)
  return fs.existsSync(p) ? p : null
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''

  try {
    let videoPath: string | null = null
    let apiKey: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      apiKey = String(form.get('apiKey') || '') || null
      const file = form.get('video') as File | null
      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo de vídeo enviado.' }, { status: 400 })
      }
      const ext = path.extname(file.name || '.mp4').toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ error: 'Formato de vídeo não suportado.' }, { status: 400 })
      }
      const tempFile = path.join(os.tmpdir(), `upload-legenda-${crypto.randomBytes(6).toString('hex')}${ext}`)
      const buffer = Buffer.from(await file.arrayBuffer())
      fs.writeFileSync(tempFile, buffer)
      videoPath = tempFile
    } else {
      const body = await req.json()
      apiKey = typeof body.apiKey === 'string' ? body.apiKey : null
      if (typeof body.env === 'string' && typeof body.filename === 'string') {
        videoPath = resolveEnvVideo(body.env, body.filename)
        if (!videoPath) {
          return NextResponse.json({ error: 'Vídeo não encontrado na fila do ambiente informado.' }, { status: 404 })
        }
      } else if (typeof body.videoPath === 'string') {
        const p = body.videoPath
        videoPath = p
        if (!fs.existsSync(p)) {
          return NextResponse.json({ error: 'Vídeo não encontrado no caminho informado.' }, { status: 404 })
        }
        if (!isAllowedVideoPath(p)) {
          return NextResponse.json(
            { error: 'Caminho fora das pastas permitidas. Use o upload de arquivo ou um vídeo da fila.' },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json({ error: 'Envie um arquivo, um env+filename ou um videoPath válido.' }, { status: 400 })
      }
    }

    if (typeof videoPath !== 'string') {
      return NextResponse.json({ error: 'Vídeo não resolvido.' }, { status: 400 })
    }

    const result = await generateCaptionFromVideo(videoPath, apiKey || undefined)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Erro ao gerar legenda: ' + message }, { status: 500 })
  }
}