import fs from 'fs'
import net from 'net'
import path from 'path'

export const SCRIPTS_DIR = path.join(process.cwd(), 'scripts')

export type EnvId = 'futebol' | 'motivacao'
export type PlatformKey = 'instagram' | 'tiktok' | 'facebook' | 'shorts'

export interface PlatformDef {
  key: PlatformKey
  label: string
  short: string
  field: string
  dateField: string
}

export const PLATFORMS: PlatformDef[] = [
  { key: 'instagram', label: 'Instagram', short: 'IG', field: 'postedInstagram', dateField: 'instagramDate' },
  { key: 'tiktok', label: 'TikTok', short: 'TT', field: 'postedTikTok', dateField: 'tiktokDate' },
  { key: 'facebook', label: 'Facebook', short: 'FB', field: 'postedFacebook', dateField: 'facebookDate' },
  { key: 'shorts', label: 'Shorts', short: 'YT', field: 'postedShorts', dateField: 'shortsDate' },
]

export interface Env {
  id: EnvId
  nome: string
  color: string
  port: number
  queueFile: string
  lockFile: string
  scheduleFile: string
  logFile: string
  videosDir: string
  chromeProfile: string
  enabledPlatforms: PlatformKey[]
  kwaiEnabled: boolean
}

const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\adria'

function envVideosDir(envKey: EnvId): string {
  if (envKey === 'motivacao') {
    return process.env.MOTIVACAO_VIDEOS_DIR || path.join(homeDir, 'Downloads', 'videos editados motiv')
  }
  return process.env.VIDEOS_DIR || path.join(homeDir, 'Downloads', 'videos editados fut')
}

export const ENVS: Env[] = [
  {
    id: 'futebol',
    nome: 'Futebol',
    color: '#35d07f',
    port: 9222,
    queueFile: path.join(SCRIPTS_DIR, 'posts-queue.json'),
    lockFile: path.join(SCRIPTS_DIR, '.posting.lock'),
    scheduleFile: path.join(SCRIPTS_DIR, 'schedule-config.json'),
    logFile: path.join(SCRIPTS_DIR, 'postar-log.txt'),
    videosDir: envVideosDir('futebol'),
    chromeProfile: 'chrome-debug-profile',
    enabledPlatforms: ['instagram', 'tiktok', 'facebook', 'shorts'],
    kwaiEnabled: false,
  },
  {
    id: 'motivacao',
    nome: 'Motivacao',
    color: '#f5a623',
    port: 9223,
    queueFile: path.join(SCRIPTS_DIR, 'posts-queue-motivacao.json'),
    lockFile: path.join(SCRIPTS_DIR, '.posting-motivacao.lock'),
    scheduleFile: path.join(SCRIPTS_DIR, 'schedule-config-motivacao.json'),
    logFile: path.join(SCRIPTS_DIR, 'postar-log-motivacao.txt'),
    videosDir: envVideosDir('motivacao'),
    chromeProfile: 'chrome-debug-profile-motivacao',
    enabledPlatforms: ['tiktok', 'facebook'],
    kwaiEnabled: false,
  },
]

export interface QueueVideo {
  path: string
  filename: string
  postedInstagram: boolean
  postedTikTok: boolean
  postedFacebook: boolean
  postedKwai: boolean
  postedShorts: boolean
  instagramDate: string | null
  tiktokDate: string | null
  facebookDate: string | null
  kwaiDate: string | null
  shortsDate: string | null
  error: string | null
}

export interface Queue {
  videos: QueueVideo[]
  currentIndex: number
  dailyCount: number
  dailyCountTikTok: number
  dailyCountFacebook: number
  dailyCountKwai: number
  dailyCountShorts: number
  lastPostDate: string
}

function readJson<T>(file: string, empty: T): T {
  try {
    if (!fs.existsSync(file)) return empty
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return empty
  }
}

export function loadQueue(env: Env): Queue {
  const empty: Queue = {
    videos: [],
    currentIndex: 0,
    dailyCount: 0,
    dailyCountTikTok: 0,
    dailyCountFacebook: 0,
    dailyCountKwai: 0,
    dailyCountShorts: 0,
    lastPostDate: '',
  }
  const q = readJson<Partial<Queue>>(env.queueFile, empty)
  return { ...empty, videos: q.videos ?? [], ...q }
}

export interface ScheduleConfig {
  enabled: boolean
  times: string[]
  timezone: string
  videosPerRun: number
}

export function loadSchedule(env: Env): ScheduleConfig {
  const def: ScheduleConfig = { enabled: true, times: ['11:30', '18:30'], timezone: 'America/Sao_Paulo', videosPerRun: 1 }
  const s = readJson<Partial<ScheduleConfig>>(env.scheduleFile, {})
  return {
    ...def,
    ...s,
    times: Array.isArray(s.times) ? s.times : def.times,
    videosPerRun: Math.max(1, parseInt(String(s.videosPerRun), 10) || 1),
  }
}

export function checkPort(port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (ok: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, '127.0.0.1')
  })
}

export function lockInfo(file: string): { locked: boolean; pid: number | null; ageMs: number | null } {
  try {
    if (!fs.existsSync(file)) return { locked: false, pid: null, ageMs: null }
    const stat = fs.statSync(file)
    const ageMs = Date.now() - stat.mtimeMs
    const content = fs.readFileSync(file, 'utf-8').trim()
    const pid = /^\d+$/.test(content) ? parseInt(content, 10) : null
    return { locked: true, pid, ageMs }
  } catch {
    return { locked: false, pid: null, ageMs: null }
  }
}

export function isProcessing(env: Env): boolean {
  const lock = lockInfo(env.lockFile)
  if (!lock.locked) return false
  if (lock.ageMs === null) return true
  return lock.ageMs < 15 * 60 * 1000
}

function parseLogTs(line: string): Date | null {
  const m = line.match(/\[(\d{2})\/(\d{2})\/(\d{4}),?\s?(\d{2}):(\d{2}):(\d{2})\]/)
  if (!m) return null
  const [dd, mm, yyyy, hh, mi, ss] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number)
  return new Date(yyyy, mm - 1, dd, hh, mi, ss)
}

export interface ActivityEvent {
  id: string
  ts: string
  env: EnvId
  type: 'publish' | 'start' | 'done' | 'error' | 'info' | 'chrome'
  message: string
  video?: string
}

export function loadActivity(env: Env, limit = 40): ActivityEvent[] {
  const events: ActivityEvent[] = []
  try {
    if (!fs.existsSync(env.logFile)) return events
    const lines = fs.readFileSync(env.logFile, 'utf-8').split('\n').filter(Boolean)
    for (let i = Math.max(0, lines.length - Math.max(limit, 100)); i < lines.length; i++) {
      const line = lines[i]
      const ts = parseLogTs(line)
      if (!ts) continue
      const body = line.replace(/^\[[^\]]*\]\s*(?:\[[^\]]*\]\s*)?/, '')
      let type: ActivityEvent['type'] = 'info'
      if (/ERRO|erro fatal|nao confirmado|não confirmado/i.test(body)) type = 'error'
      else if (/Postagem conclu|Concluido!|Concluído/i.test(body)) type = 'done'
      else if (/Iniciando postagem/i.test(body)) type = 'start'
      else if (/Chrome nao encontrado|Chrome não encontrado/i.test(body)) type = 'chrome'
      else if (/publicado com sucesso|Reel postado|video publicado|Compartilhado/i.test(body)) type = 'publish'
      events.push({
        id: `${env.id}-${ts.getTime()}-${i}`,
        ts: ts.toISOString(),
        env: env.id,
        type,
        message: body,
        video: body.match(/([\w\d-]+\.mp4)/i)?.[1],
      })
    }
  } catch {}
  return events
}

function vField(v: QueueVideo, field: string): unknown {
  return (v as unknown as Record<string, unknown>)[field]
}

export function countTodayByPlatform(queue: Queue): Record<PlatformKey, number> {
  const today = new Date().toLocaleDateString('en-CA')
  const counts: Record<PlatformKey, number> = { instagram: 0, tiktok: 0, facebook: 0, shorts: 0 }
  for (const v of queue.videos) {
    for (const p of PLATFORMS) {
      const date = vField(v, p.dateField)
      if (typeof date === 'string' && date.slice(0, 10) === today) counts[p.key]++
    }
  }
  return counts
}

export function successRate(queue: Queue): number {
  let total = 0
  let ok = 0
  for (const v of queue.videos) {
    for (const p of PLATFORMS) {
      const posted = vField(v, p.field)
      if (posted || v.error) {
        total++
        if (posted) ok++
      }
    }
  }
  return total === 0 ? 1 : ok / total
}

export function pendingVideos(env: Env, queue: Queue, onlyExisting = true): QueueVideo[] {
  const enabledFields = env.enabledPlatforms.map((k) => PLATFORMS.find((p) => p.key === k)!.field)
  return queue.videos.filter((v) => {
    const done = enabledFields.every((f) => vField(v, f))
    if (done) return false
    if (onlyExisting && !fs.existsSync(v.path)) return false
    return true
  })
}

export interface NextPublication {
  id: string
  env: EnvId
  time: string
  date: string
  dateISO: string | null
  filename: string | null
  platforms: PlatformKey[]
  status: 'pending' | 'posted' | 'processing'
  video?: QueueVideo | null
}

export function nextPublications(limit = 6): NextPublication[] {
  const now = new Date()
  const out: NextPublication[] = []
  for (const env of ENVS) {
    const schedule = loadSchedule(env)
    if (!schedule.enabled) continue
    const queue = loadQueue(env)
    const pending = pendingVideos(env, queue)
    if (pending.length === 0) continue
    const times = schedule.times.filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    let timeIdx = 0
    for (let day = 0; day < 7 && out.length < limit * 2; day++) {
      const d = new Date(now)
      d.setDate(d.getDate() + day)
      for (const t of times) {
        const [h, m] = t.split(':').map(Number)
        const slot = new Date(d)
        slot.setHours(h, m, 0, 0)
        if (slot.getTime() < now.getTime()) continue
        const video = pending[timeIdx % pending.length]
        timeIdx++
        out.push({
          id: `${env.id}-${slot.getTime()}`,
          env: env.id,
          time: t,
          date: slot.toLocaleDateString('en-CA'),
          dateISO: slot.toISOString(),
          filename: video.filename,
          platforms: env.enabledPlatforms,
          status: slot.getTime() - Date.now() < 30 * 60 * 1000 ? 'processing' : 'pending',
          video,
        })
      }
    }
  }
  return out.sort((a, b) => (a.dateISO ?? '').localeCompare(b.dateISO ?? '')).slice(0, limit)
}

export function platformMap(video: QueueVideo): Record<PlatformKey, boolean> {
  const map: Record<PlatformKey, boolean> = { instagram: false, tiktok: false, facebook: false, shorts: false }
  for (const p of PLATFORMS) map[p.key] = !!vField(video, p.field)
  return map
}