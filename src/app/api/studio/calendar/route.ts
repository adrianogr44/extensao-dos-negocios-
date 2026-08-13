import { NextResponse } from 'next/server'
import fs from 'fs'
import { ENVS, PLATFORMS, type QueueVideo } from '@/lib/studio-data'

export const dynamic = 'force-dynamic'

function vf(v: QueueVideo, field: string): unknown {
  return (v as unknown as Record<string, unknown>)[field]
}

function platformStateFor(v: QueueVideo) {
  return PLATFORMS.map((p) => ({
    key: p.key,
    label: p.label,
    short: p.short,
    done: !!vf(v, p.field),
    date: (vf(v, p.dateField) ?? null) as string | null,
  }))
}

function hasPublishedOn(v: QueueVideo, day: string): boolean {
  return PLATFORMS.some((p) => (vf(v, p.dateField) as string | undefined)?.slice(0, 10) === day)
}

interface CalendarEvent {
  id: string
  env: 'futebol' | 'motivacao'
  date: string
  time: string
  ts: string | null
  filename: string
  platforms: { key: string; label: string; short: string; done: boolean; date: string | null }[]
  status: 'publicado' | 'agendado' | 'parcial' | 'pendente' | 'erro'
  error?: string | null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)
  const [yy, mm] = month.split('-').map(Number)
  const daysInMonth = new Date(yy, mm, 0).getDate()

  const events: CalendarEvent[] = []

  for (const env of ENVS) {
    let videos: QueueVideo[] = []
    let times: string[] = []
    try {
      if (fs.existsSync(env.queueFile)) videos = (JSON.parse(fs.readFileSync(env.queueFile, 'utf-8')).videos || [])
    } catch { return NextResponse.json({ month, error: 'queue' }, { status: 500 }) }
    try {
      const cfg = JSON.parse(fs.readFileSync(env.scheduleFile, 'utf-8'))
      times = (cfg.times || []).filter((t: string) => /^\d{1,2}:\d{2}$/.test(t))
    } catch {}
    if (times.length === 0) continue

    const enabledFields = env.enabledPlatforms.map((k) => PLATFORMS.find((p) => p.key === k)!.field)
    const allDone = (v: QueueVideo) => enabledFields.every((f) => vf(v, f))
    const pending = videos.filter((v) => !allDone(v) && fs.existsSync(v.path))

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${month}-${String(day).padStart(2, '0')}`

      const publishedOnDay = videos.filter((v) => hasPublishedOn(v, dateStr))
      for (const v of publishedOnDay) {
        const latest = Math.max(0, ...PLATFORMS.map((p) => Date.parse((vf(v, p.dateField) as string) || '0')).filter((n) => !Number.isNaN(n)))
        events.push({
          id: `${env.id}-${dateStr}-${v.filename}-publicado`,
          env: env.id,
          date: dateStr,
          time: latest ? new Date(latest).toTimeString().slice(0, 5) : '',
          ts: new Date(latest).toISOString(),
          filename: v.filename,
          platforms: platformStateFor(v),
          status: allDone(v) ? 'publicado' : 'parcial',
          error: v.error,
        })
      }

      let timeIdx = 0
      for (const t of times) {
        const slotTs = Date.parse(`${dateStr}T${t}:00`)
        if (Number.isNaN(slotTs)) continue
        const v = pending[timeIdx % Math.max(1, pending.length)]
        if (!v) continue
        timeIdx++
        const isPast = slotTs <= Date.now()
        const hasPosted = hasPublishedOn(v, dateStr)
        events.push({
          id: `${env.id}-${dateStr}-${t}-${v.filename}`,
          env: env.id,
          date: dateStr,
          time: t,
          ts: isPast ? new Date(slotTs).toISOString() : null,
          filename: v.filename,
          platforms: platformStateFor(v),
          status: v.error && !hasPosted ? 'erro' : hasPosted ? (allDone(v) ? 'publicado' : 'parcial') : isPast ? 'pendente' : 'agendado',
          error: v.error,
        })
      }
    }
  }

  events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  return NextResponse.json({ month, events })
}