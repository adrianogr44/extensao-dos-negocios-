import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { ScheduleConfig } from '@/lib/types'
import { startScheduler, stopScheduler } from '@/lib/scheduler'
import { VIDEOS_DIR } from '@/lib/video-processor'

const CONFIG_PATH = path.join(process.cwd(), 'schedule-config.json')

async function processNextVideo() {
  const files = await fs.readdir(VIDEOS_DIR)
  const videoFiles = files.filter((f) => f.match(/\.(mp4|mov|avi|mkv)$/i))

  if (videoFiles.length === 0) return

  const videoPath = path.join(VIDEOS_DIR, videoFiles[0])
  console.log(`[Scheduler] Processando vídeo: ${videoPath}`)
}

export async function GET() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8')
    return NextResponse.json(JSON.parse(data))
  } catch {
    return NextResponse.json({
      enabled: false,
      timesPerDay: 5,
      intervalMinutes: 60,
      startTime: '08:00',
      endTime: '18:00',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    })
  }
}

export async function POST(req: NextRequest) {
  const config: ScheduleConfig = await req.json()
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))

  stopScheduler()
  startScheduler(config, processNextVideo)

  return NextResponse.json({ success: true, config })
}

export async function DELETE() {
  stopScheduler()
  return NextResponse.json({ success: true })
}
