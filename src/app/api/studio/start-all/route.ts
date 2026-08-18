import { NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import net from 'net'
import { ENVS } from '@/lib/studio-data'

export const dynamic = 'force-dynamic'

const SCRIPTS = path.join(process.cwd(), 'scripts')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const AGENDADOR_PID: Record<string, string> = {
  futebol: path.join(SCRIPTS, '.agendador-futebol.pid'),
  motivacao: path.join(SCRIPTS, '.agendador-motivacao.pid'),
}

function checkPort(port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket()
    const done = (ok: boolean) => {
      s.removeAllListeners()
      s.destroy()
      resolve(ok)
    }
    s.setTimeout(timeoutMs)
    s.once('connect', () => done(true))
    s.once('timeout', () => done(false))
    s.once('error', () => done(false))
    s.connect(port, '127.0.0.1')
  })
}

function runPs(script: string): string {
  try {
    const encoded = Buffer.from(script, 'utf-16le').toString('base64')
    return execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 15000,
    })
  } catch {
    return ''
  }
}

function killChromeProcs(envId: string) {
  // futebol: mata processos do perfil chrome-debug-profile (exceto -motivacao)
  // motivacao: mata processos do perfil chrome-debug-profile-motivacao
  const ps =
    envId === 'futebol'
      ? `
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"
$procs | Where-Object {
  (($_.CommandLine -like '*chrome-debug-profile*') -and ($_.CommandLine -notlike '*chrome-debug-profile-motivacao*')) -or
  ($_.CommandLine -like '*--remote-debugging-port=9222*')
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
      : `
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"
$procs | Where-Object { $_.CommandLine -like '*chrome-debug-profile-motivacao*' -or $_.CommandLine -like '*--remote-debugging-port=9223*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
  runPs(ps)
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

function findAgendadorPid(envId: string): number | null {
  const ps = `$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*postar-agendado.js*' -and $_.CommandLine -like '*${envId}*' }; $procs | ForEach-Object { $_.ProcessId }`
  const out = runPs(ps)
  const pid = out
    .split(/\r?\n/)
    .map((l) => parseInt(l.trim(), 10))
    .find((n) => Number.isInteger(n) && n > 0)
  return pid ?? null
}

function launchChrome(envId: string) {
  const env = ENVS.find((e) => e.id === envId)!
  const chromeProfile = env.chromeProfile
  const profilePath = path.join(process.env.USERPROFILE || 'C:\\Users\\adria', chromeProfile)
  const args = [
    `--remote-debugging-port=${env.port}`,
    '--remote-allow-origins=http://127.0.0.1',
    `--user-data-dir=${profilePath}`,
    '--no-first-run',
  ]
  const mode = (process.env.CHROME_MODE || 'headless').toLowerCase()
  if (mode === 'headless') {
    args.push(
      '--headless=new',
      '--window-size=390,844',
      '--mute-audio',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
  } else {
    args.push('--start-minimized')
  }
  spawn(CHROME, args, { detached: true, windowsHide: true, stdio: 'ignore' }).unref()
}

async function ensureChrome(envId: string): Promise<{ ok: boolean; action: string; port: number }> {
  const env = ENVS.find((e) => e.id === envId)!
  const open = await checkPort(env.port)
  if (open) return { ok: true, action: 'ja_aberto', port: env.port }
  killChromeProcs(envId)
  await new Promise((r) => setTimeout(r, 2500))
  launchChrome(envId)
  await new Promise((r) => setTimeout(r, 4000))
  const nowOpen = await checkPort(env.port)
  return { ok: nowOpen, action: nowOpen ? 'aberto' : 'falha', port: env.port }
}

function ensureScheduler(envId: string): { ok: boolean; action: string; pid: number | null } {
  const pidFile = AGENDADOR_PID[envId]
  const found = findAgendadorPid(envId)
  if (isRunning(found) || isRunning(readPid(pidFile))) {
    return { ok: true, action: 'ja_rodando', pid: found ?? readPid(pidFile) }
  }
  const entry = path.join(SCRIPTS, 'postar-agendado.js')
  const child = spawn('node', [entry, `--profile=${envId}`], {
    cwd: process.cwd(),
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  })
  child.unref()
  try {
    fs.writeFileSync(pidFile, String(child.pid))
  } catch {}
  return { ok: true, action: 'iniciado', pid: child.pid ?? null }
}

export async function GET() {
  const status: Record<string, unknown> = {}
  for (const env of ENVS) {
    status[env.id] = {
      chrome: await checkPort(env.port),
      agendador: isRunning(findAgendadorPid(env.id)) || isRunning(readPid(AGENDADOR_PID[env.id])),
    }
  }
  return NextResponse.json({ ok: true, status })
}

export async function POST() {
  const results: Record<string, unknown> = {}
  for (const env of ENVS) {
    const chrome = await ensureChrome(env.id)
    const scheduler = ensureScheduler(env.id)
    results[env.id] = { chrome, scheduler }
  }
  return NextResponse.json({ ok: true, results })
}