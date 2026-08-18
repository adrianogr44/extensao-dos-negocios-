import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import net from 'net'
import { ENVS, type EnvId } from './studio-data'

const SCRIPTS = path.join(process.cwd(), 'scripts')
export const MODE_FILE = path.join(SCRIPTS, 'chrome-mode.json')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

export type ChromeMode = 'headless' | 'windowed'

const DEFAULT_MODES: Record<EnvId, ChromeMode> = { futebol: 'headless', motivacao: 'headless' }

export function readChromeMode(envId: string): ChromeMode {
  try {
    if (fs.existsSync(MODE_FILE)) {
      const raw = fs.readFileSync(MODE_FILE, 'utf-8').replace(/^\uFEFF/, '')
      const data = JSON.parse(raw)
      const mode = data[envId]
      if (mode === 'headless' || mode === 'windowed') return mode
    }
  } catch {}
  const env = (process.env.CHROME_MODE || 'headless').toLowerCase()
  return env === 'windowed' ? 'windowed' : 'headless'
}

export function writeChromeMode(envId: string, mode: ChromeMode) {
  let data: Record<string, string> = {}
  try {
    if (fs.existsSync(MODE_FILE)) {
      data = JSON.parse(fs.readFileSync(MODE_FILE, 'utf-8').replace(/^\uFEFF/, ''))
    }
  } catch {}
  data[envId] = mode
  fs.writeFileSync(MODE_FILE, JSON.stringify(data, null, 2))
  return { ...DEFAULT_MODES, ...data }
}

export function checkPort(port: number, timeoutMs = 2000): Promise<boolean> {
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

export function killChromeProcs(envId: string) {
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

export function launchChrome(envId: string, mode?: ChromeMode) {
  const env = ENVS.find((e) => e.id === envId)
  const profilePath = path.join(
    process.env.USERPROFILE || 'C:\\Users\\adria',
    env?.chromeProfile || (envId === 'motivacao' ? 'chrome-debug-profile-motivacao' : 'chrome-debug-profile')
  )
  const args = [
    `--remote-debugging-port=${env?.port ?? (envId === 'motivacao' ? 9223 : 9222)}`,
    '--remote-allow-origins=http://127.0.0.1',
    `--user-data-dir=${profilePath}`,
    '--no-first-run',
  ]
  const chosen: ChromeMode = mode || readChromeMode(envId)
  if (chosen === 'headless') {
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
  return chosen
}

export async function relaunchChrome(envId: string, mode?: ChromeMode): Promise<{ ok: boolean; mode: ChromeMode; port: number }> {
  const chosen: ChromeMode = mode || readChromeMode(envId)
  killChromeProcs(envId)
  await new Promise((r) => setTimeout(r, 2500))
  launchChrome(envId, chosen)
  await new Promise((r) => setTimeout(r, 4000))
  const env = ENVS.find((e) => e.id === envId)
  const port = env?.port ?? (envId === 'motivacao' ? 9223 : 9222)
  const open = await checkPort(port)
  return { ok: open, mode: chosen, port }
}