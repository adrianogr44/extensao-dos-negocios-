import { NextResponse } from 'next/server'
import { startScheduler, stopScheduler } from '@/lib/scheduler'
import fs from 'fs/promises'
import path from 'path'
import { VIDEOS_DIR } from '@/lib/video-processor'

const CONFIG_PATH = path.join(process.cwd(), 'schedule-config.json')

async function processNextVideo() {
  const files = await fs.readdir(VIDEOS_DIR)
  const videoFiles = files.filter((f) => f.match(/\.(mp4|mov|avi|mkv)$/i))
  if (videoFiles.length > 0) {
    console.log(`[Cron] Processando vídeo: ${videoFiles[0]}`)
  }
}

export async function POST() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(data)
    stopScheduler()
    startScheduler(config, processNextVideo)
    return NextResponse.json({ success: true, message: 'Scheduler iniciado' })
  } catch {
    return NextResponse.json({ error: 'Config não encontrada' }, { status: 400 })
  }
}

export async function DELETE() {
  stopScheduler()
  return NextResponse.json({ success: true, message: 'Scheduler parado' })
}
