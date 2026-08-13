import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import net from 'net'
import path from 'path'

export const dynamic = 'force-dynamic'

const SCRIPTS = path.join(process.cwd(), 'scripts')

const ENV_DEFS: Record<string, { lockFile: string; port: number; args: string[] }> = {
  futebol: {
    lockFile: path.join(SCRIPTS, '.posting.lock'),
    port: 9222,
    args: ['scripts/postar-completo.js', '1'],
  },
  motivacao: {
    lockFile: path.join(SCRIPTS, '.posting-motivacao.lock'),
    port: 9223,
    args: ['scripts/postar-completo.js', '1', '--profile=motivacao'],
  },
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Lock so eh considerado ativo se o processo dono ainda estiver vivo.
// Lock preso de uma rodada morta (ex: Chrome offline) nao bloqueia mais o botao.
function lockBlocking(lockFile: string): boolean {
  try {
    if (!fs.existsSync(lockFile)) return false
    const content = fs.readFileSync(lockFile, 'utf-8').trim()
    const pid = /^\d+$/.test(content) ? parseInt(content, 10) : null
    return pid !== null && pidAlive(pid)
  } catch {
    return false
  }
}

function checkPort(port: number, timeoutMs = 1500): Promise<boolean> {
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

async function ensureChrome(def: { port: number }): Promise<boolean> {
  if (await checkPort(def.port)) return true
  const launcher = path.join(SCRIPTS, 'launch-chrome.js')
  if (fs.existsSync(launcher)) {
    // Lanca SEM janela de terminal
    const profile = def.port === 9223 ? 'motivacao' : 'futebol'
    spawn('node', [launcher, `--profile=${profile}`], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: 'ignore',
      detached: true,
    }).unref()
  }
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500))
    if (await checkPort(def.port)) return true
  }
  return false
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const env = url.searchParams.get('env') || 'futebol'
  const def = ENV_DEFS[env]
  if (!def) return NextResponse.json({ ok: false, error: 'env inválido' }, { status: 400 })

  if (lockBlocking(def.lockFile)) {
    return NextResponse.json({ ok: false, already: true, message: 'Já existe uma execução em andamento' })
  }

  if (!(await ensureChrome(def))) {
    return NextResponse.json({ ok: false, error: `Chrome não abriu na porta ${def.port}. Verifique o navegador do ambiente.` }, { status: 503 })
  }

  try {
    fs.unlinkSync(def.lockFile)
  } catch {}

  const child = spawn('node', def.args, { cwd: process.cwd(), windowsHide: true, stdio: 'ignore', detached: true })
  child.unref()

  return NextResponse.json({ ok: true, started: true, env })
}