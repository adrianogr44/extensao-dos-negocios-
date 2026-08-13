import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export async function POST(req: NextRequest) {
  const profile = new URL(req.url).searchParams.get('profile') || 'futebol'
  if (profile !== 'futebol' && profile !== 'motivacao') {
    return NextResponse.json({ ok: false, error: `Perfil desconhecido: ${profile}` }, { status: 400 })
  }

  const launcherPath = path.join(process.cwd(), 'scripts', 'launch-chrome.js')
  if (!fs.existsSync(launcherPath)) {
    return NextResponse.json({ ok: false, error: 'launch-chrome.js nao encontrado' }, { status: 500 })
  }

  // Lanca SEM janela de terminal
  spawn('node', [launcherPath, `--profile=${profile}`], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: 'ignore',
    detached: true,
  }).unref()
  return NextResponse.json({ ok: true, profile })
}