import { NextRequest, NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const SCRIPTS = path.join(process.cwd(), 'scripts')

const ENVS: Record<string, { pidFile: string; entry: string; args: string[] }> = {
  futebol: {
    pidFile: path.join(SCRIPTS, '.agendador-futebol.pid'),
    entry: path.join(SCRIPTS, 'postar-agendado.js'),
    args: ['--profile=futebol'],
  },
  motivacao: {
    pidFile: path.join(SCRIPTS, '.agendador-motivacao.pid'),
    entry: path.join(SCRIPTS, 'postar-agendado.js'),
    args: ['--profile=motivacao'],
  },
}

function readPid(file: string): number | null {
  try {
    if (!fs.existsSync(file)) return null
    const pid = parseInt(fs.readFileSync(file, 'utf-8').trim(), 10)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function isRunning(pid: number | null): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function findAgendadorPids(profile: string): number[] {
  // procura processos node rodando postar-agendado.js do perfil (via EncodedCommand, sem problemas de quoting)
  try {
    const ps = `
$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*postar-agendado.js*' -and $_.CommandLine -like '*${profile}*' }
$procs | ForEach-Object { $_.ProcessId }`.trim()
    const encoded = Buffer.from(ps, 'utf-16le').toString('base64')
    const out = execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 10000,
    })
    return out
      .split(/\r?\n/)
      .map((l) => parseInt(l.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0)
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const env = new URL(req.url).searchParams.get('env') || 'futebol'
  const def = ENVS[env]
  if (!def) return NextResponse.json({ ok: false, error: 'env inválido' }, { status: 400 })

  const pid = readPid(def.pidFile)
  const pids = findAgendadorPids(env)
  const running = isRunning(pid) || pids.length > 0

  return NextResponse.json({
    ok: true,
    env,
    running,
    pid: pid && isRunning(pid) ? pid : (pids[0] ?? null),
    pids,
  })
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const env = url.searchParams.get('env') || 'futebol'
  const action = url.searchParams.get('action') || 'start'
  const def = ENVS[env]
  if (!def) return NextResponse.json({ ok: false, error: 'env inválido' }, { status: 400 })
  if (action !== 'start' && action !== 'stop') {
    return NextResponse.json({ ok: false, error: 'action deve ser start|stop' }, { status: 400 })
  }

  if (action === 'start') {
    const pids = findAgendadorPids(env)
    const pidFile = readPid(def.pidFile)
    if (isRunning(pidFile) || pids.length > 0) {
      return NextResponse.json({ ok: false, already: true, message: `Agendador ${env} já está rodando` })
    }

    const child = spawn('node', [def.entry, ...def.args], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: 'ignore',
      detached: true,
    })
    child.unref()
    fs.writeFileSync(def.pidFile, String(child.pid))

    return NextResponse.json({ ok: true, started: true, env, pid: child.pid })
  }

  // stop
  const pids = [...new Set([readPid(def.pidFile), ...findAgendadorPids(env)].filter(Boolean) as number[])]
  if (pids.length === 0) {
    return NextResponse.json({ ok: false, notRunning: true, message: `Agendador ${env} não está rodando` })
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 9)
    } catch {}
  }
  try {
    fs.unlinkSync(def.pidFile)
  } catch {}

  return NextResponse.json({ ok: true, stopped: true, env, pids })
}