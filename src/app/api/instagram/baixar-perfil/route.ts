import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

const REELS_DIR = path.join(process.cwd(), 'public', 'reels-baixados')
const TASKS_DIR = path.join(process.cwd(), '.tasks-reels')
const COOKIES_PATH = path.join(process.cwd(), 'instagram_cookies.txt')

async function ensureDirs() {
  await fs.mkdir(REELS_DIR, { recursive: true })
  await fs.mkdir(TASKS_DIR, { recursive: true })
}

export async function POST(req: NextRequest) {
  try {
    const { username, maxCount } = await req.json()
    if (!username) {
      return NextResponse.json({ error: 'Username é obrigatório' }, { status: 400 })
    }

    await ensureDirs()

    const cookiesExists = await fs.access(COOKIES_PATH).then(() => true).catch(() => false)
    if (!cookiesExists) {
      return NextResponse.json(
        { error: 'Nenhum arquivo de cookies encontrado. Va em Configuracoes e faça upload do cookies.txt.' },
        { status: 400 }
      )
    }

    const taskId = randomUUID()
    const user = username.trim().toLowerCase()
    const userDir = path.join(REELS_DIR, user)
    const statusFile = path.join(TASKS_DIR, `${taskId}.json`)

    const script = path.join(process.cwd(), 'scripts', 'baixar_reels.py')
    const args = [
      script,
      user,
      userDir,
      taskId,
      statusFile,
      String(maxCount || 0),
      COOKIES_PATH,
    ]

    const proc = spawn('python', args, { stdio: 'ignore', detached: true })
    proc.unref()

    return NextResponse.json({ taskId, username: user, mensagem: `Download de reels de @${user} iniciado.` })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao iniciar download: ' + String(error) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  const username = searchParams.get('username')

  await ensureDirs()

  if (taskId) {
    const statusFile = path.join(TASKS_DIR, `${taskId}.json`)
    try {
      const content = await fs.readFile(statusFile, 'utf-8')
      return NextResponse.json(JSON.parse(content))
    } catch {
      return NextResponse.json({ taskId, status: 'PENDING', progress: 0 })
    }
  }

  if (username) {
    const userDir = path.join(REELS_DIR, username.toLowerCase())
    try {
      await fs.access(userDir)
      const files = await fs.readdir(userDir)
      const videos = files
        .filter((f) => f.endsWith('.mp4'))
        .map((f) => {
          const fp = path.join(userDir, f)
          const stat = fs.stat(fp)
          return { filename: f, size_mb: 0 }
        })

      const results = await Promise.all(
        videos.map(async (v) => {
          const stat = await fs.stat(path.join(userDir, v.filename))
          return { ...v, size_mb: parseFloat((stat.size / 1024 / 1024).toFixed(2)) }
        })
      )

      return NextResponse.json({ username, reels: results, total: results.length })
    } catch {
      return NextResponse.json({ username, reels: [], total: 0 })
    }
  }

  return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
}
