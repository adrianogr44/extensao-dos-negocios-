import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { ENVS, type EnvId } from '@/lib/studio-data'

// Reset da fila migrado do serve-studio.js (porta 3940, aposentado). Diferenças:
// cobre os DOIS ambientes (futebol/motivacao) e escreve de forma atômica (tmp+rename+bak).
type Action = 'all' | 'posted' | 'errors' | 'daily'

interface QueueVideo {
  postedInstagram?: boolean
  postedTikTok?: boolean
  postedFacebook?: boolean
  postedKwai?: boolean
  postedShorts?: boolean
  error?: string | null
}

interface Queue {
  videos: QueueVideo[]
  dailyCount?: number
  dailyCountTikTok?: number
  dailyCountFacebook?: number
  dailyCountKwai?: number
  dailyCountShorts?: number
  lastPostDate?: string
}

function clearPosted(v: QueueVideo) {
  v.postedInstagram = false
  v.postedTikTok = false
  v.postedFacebook = false
  v.postedKwai = false
  v.postedShorts = false
}

function zeroDaily(q: Queue) {
  q.dailyCount = 0
  q.dailyCountTikTok = 0
  q.dailyCountFacebook = 0
  q.dailyCountKwai = 0
  q.dailyCountShorts = 0
  q.lastPostDate = ''
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const envId = (searchParams.get('env') || 'futebol') as EnvId
  const action = (searchParams.get('action') || 'all') as Action

  const env = ENVS.find((e) => e.id === envId)
  if (!env) return NextResponse.json({ error: 'ambiente inválido' }, { status: 400 })

  let q: Queue
  try {
    q = JSON.parse(fs.readFileSync(env.queueFile, 'utf-8').replace(/^﻿/, ''))
  } catch {
    return NextResponse.json({ error: 'fila ilegível ou inexistente' }, { status: 500 })
  }

  switch (action) {
    case 'all':
      q.videos.forEach((v) => {
        clearPosted(v)
        v.error = null
      })
      zeroDaily(q)
      break
    case 'posted':
      q.videos.forEach(clearPosted)
      zeroDaily(q)
      break
    case 'errors':
      q.videos.forEach((v) => {
        v.error = null
      })
      break
    case 'daily':
      zeroDaily(q)
      break
    default:
      return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
  }

  // Escrita atômica: tmp + rename, com backup .bak (mesmo padrão de postar-completo.js)
  const tmp = env.queueFile + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(q, null, 2))
  try {
    if (fs.existsSync(env.queueFile)) fs.copyFileSync(env.queueFile, env.queueFile + '.bak')
  } catch {}
  fs.renameSync(tmp, env.queueFile)

  return NextResponse.json({ ok: true, env: envId, action })
}
