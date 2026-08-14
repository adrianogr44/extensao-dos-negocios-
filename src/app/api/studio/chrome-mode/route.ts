import { NextRequest, NextResponse } from 'next/server'
import { ENVS } from '@/lib/studio-data'
import {
  readChromeMode,
  writeChromeMode,
  relaunchChrome,
  type ChromeMode,
} from '@/lib/chrome-manager'

export const dynamic = 'force-dynamic'

function validEnv(env: string): boolean {
  return ENVS.some((e) => e.id === env)
}

function validMode(mode: string): mode is ChromeMode {
  return mode === 'headless' || mode === 'windowed'
}

export async function GET() {
  const modes: Record<string, ChromeMode> = {}
  for (const env of ENVS) {
    modes[env.id] = readChromeMode(env.id)
  }
  return NextResponse.json({ ok: true, modes })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const env = typeof body.env === 'string' ? body.env : ''
    const mode = typeof body.mode === 'string' ? body.mode : ''
    if (!validEnv(env)) {
      return NextResponse.json({ ok: false, error: 'Ambiente inválido.' }, { status: 400 })
    }
    if (!validMode(mode)) {
      return NextResponse.json({ ok: false, error: 'Modo inválido. Use headless ou windowed.' }, { status: 400 })
    }

    writeChromeMode(env, mode)
    const result = await relaunchChrome(env, mode)
    return NextResponse.json({
      ok: result.ok,
      env,
      mode: result.mode,
      port: result.port,
      message: result.ok
        ? `Chrome ${env} reiniciado em modo ${result.mode === 'headless' ? 'headless (invisível)' : 'janela visível'} (porta ${result.port}). Sessão preservada — logins continuam salvos.`
        : `Chrome ${env} não abriu a porta ${result.port} após reiniciar no modo ${result.mode}.`,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}