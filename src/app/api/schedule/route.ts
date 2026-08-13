import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const SCRIPTS = path.join(process.cwd(), 'scripts')

const ENVS: Record<string, { scheduleFile: string; defaultTimes: string[] }> = {
  futebol: { scheduleFile: path.join(SCRIPTS, 'schedule-config.json'), defaultTimes: ['11:30', '18:30'] },
  motivacao: { scheduleFile: path.join(SCRIPTS, 'schedule-config-motivacao.json'), defaultTimes: ['12:00', '19:00'] },
}

const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

function validEnv(env: string): env is keyof typeof ENVS {
  return env in ENVS
}

export async function GET(req: NextRequest) {
  const env = new URL(req.url).searchParams.get('env') || 'futebol'
  if (!validEnv(env)) return NextResponse.json({ ok: false, error: 'env inválido' }, { status: 400 })
  const { scheduleFile, defaultTimes } = ENVS[env]

  try {
    const data = JSON.parse(await fs.readFile(scheduleFile, 'utf-8'))
    return NextResponse.json({
      ok: true,
      env,
      enabled: data.enabled !== false,
      times: Array.isArray(data.times) ? data.times : defaultTimes,
      timezone: data.timezone || DEFAULT_TIMEZONE,
      videosPerRun: Math.max(1, parseInt(data.videosPerRun, 10) || 1),
      raw: data,
    })
  } catch {
    return NextResponse.json({
      ok: true,
      env,
      enabled: true,
      times: defaultTimes,
      timezone: DEFAULT_TIMEZONE,
      videosPerRun: 1,
      raw: null,
    })
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const env = url.searchParams.get('env') || 'futebol'
  if (!validEnv(env)) return NextResponse.json({ ok: false, error: 'env inválido' }, { status: 400 })
  const { scheduleFile, defaultTimes } = ENVS[env]

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'json inválido' }, { status: 400 })
  }

  const times = Array.isArray(body.times)
    ? (body.times as string[]).filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    : defaultTimes

  const config = {
    times,
    timezone: typeof body.timezone === 'string' && body.timezone ? body.timezone : DEFAULT_TIMEZONE,
    enabled: body.enabled !== false,
    videosPerRun: Math.max(1, parseInt(String(body.videosPerRun), 10) || 1),
  }

  await fs.writeFile(scheduleFile, JSON.stringify(config, null, 2))
  return NextResponse.json({ ok: true, env, config })
}