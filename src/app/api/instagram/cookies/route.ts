import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

const COOKIES_PATH = path.join(process.cwd(), 'instagram_cookies.txt')

export async function GET() {
  try {
    await fs.access(COOKIES_PATH)
    const stat = await fs.stat(COOKIES_PATH)
    return NextResponse.json({
      filename: 'instagram_cookies.txt',
      size: stat.size,
      modified: stat.mtime.toISOString(),
    })
  } catch {
    return NextResponse.json({ filename: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    let text = ''

    const ct = req.headers.get('content-type') || ''
    if (ct.includes('json')) {
      const body = await req.json()
      text = body.cookies || ''
    } else {
      const formData = await req.formData()
      const file = formData.get('cookies') as File
      if (file) text = await file.text()
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'Nenhum conteudo de cookies enviado' }, { status: 400 })
    }

    if (!text.includes('.instagram.com') && !text.includes('instagram.com')) {
      return NextResponse.json(
        { error: 'Arquivo de cookies invalido. Use a extensao "Get cookies.txt LOCALLY" e exporte os cookies apos logar no Instagram.' },
        { status: 400 }
      )
    }

    await fs.writeFile(COOKIES_PATH, text, 'utf-8')

    return NextResponse.json({
      success: true,
      filename: 'instagram_cookies.txt',
      size: text.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao salvar cookies: ' + String(error) },
      { status: 500 }
    )
  }
}
