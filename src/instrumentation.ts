// Auto-inicia os agendadores (Futebol + Motivacao) quando o servidor Next sobe.
// Evita o problema de "automacao morreu e ninguem reiniciou".
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Nao auto-inicia em builds/renderers remotos — apenas no ambiente local
  if (process.env.AUTOMACAO_AUTO_START === 'false') return

  const SCRIPTS = path.join(process.cwd(), 'scripts')

  function runPs(script: string): string {
    try {
      const encoded = Buffer.from(script, 'utf-16le').toString('base64')
      return execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 10000,
      })
    } catch {
      return ''
    }
  }

  function findAgendadorPid(profile: string): number | null {
    const ps = `$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*postar-agendado.js*' -and $_.CommandLine -like '*${profile}*' }; $procs | ForEach-Object { $_.ProcessId }`
    const out = runPs(ps)
    const pid = out
      .split(/\r?\n/)
      .map((l) => parseInt(l.trim(), 10))
      .find((n) => Number.isInteger(n) && n > 0)
    return pid ?? null
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

  const pidFiles: Record<string, string> = {
    futebol: path.join(SCRIPTS, '.agendador-futebol.pid'),
    motivacao: path.join(SCRIPTS, '.agendador-motivacao.pid'),
  }

  for (const profile of ['futebol', 'motivacao'] as const) {
    const cfgFile = path.join(SCRIPTS, profile === 'futebol' ? 'schedule-config.json' : 'schedule-config-motivacao.json')
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf-8'))
      if (!cfg.enabled) continue
    } catch {
      continue
    }

    if (isRunning(findAgendadorPid(profile)) || isRunning(readPid(pidFiles[profile]))) {
      console.log(`[auto-start] Agendador ${profile} ja rodando — nada a fazer`)
      continue
    }

    console.log(`[auto-start] Iniciando agendador ${profile} (segundo plano, sem janela)...`)
    const entry = path.join(SCRIPTS, 'postar-agendado.js')
    const child = spawn('node', [entry, `--profile=${profile}`], {
      cwd: process.cwd(),
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    })
    child.unref()
    try {
      fs.writeFileSync(pidFiles[profile], String(child.pid))
    } catch {}
  }
}
