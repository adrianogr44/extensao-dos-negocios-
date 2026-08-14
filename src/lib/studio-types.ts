export interface PlatformToday {
  key: string
  label: string
  short: string
  today: number
  limit: number
  posted: number
}

export interface CurrentVideo {
  filename: string
  platformState: {
    key: string
    label: string
    short: string
    done: boolean
    date: string | null
  }[]
  error: string | null
}

export interface EnvVideo {
  filename: string
  status: 'publicado' | 'parcial' | 'pendente' | 'erro'
  platforms: { key: string; label: string; short: string; done: boolean }[]
  dates: string[]
  error: string | null
}

export interface StudioEnvironment {
  id: 'futebol' | 'motivacao'
  nome: string
  color: string
  port: number
  chromeProfile: string
  chromeMode: 'headless' | 'windowed'
  videosDir: string
  platforms: PlatformToday[]
  schedule: string[]
  scheduleEnabled: boolean
  timezone: string
  videosPerRun: number
  online: boolean
  processing: boolean
  lock: { locked: boolean; pid: number | null; ageMs: number | null }
  queue: {
    total: number
    pending: number
    publishedToday: number
    lastPostDate: string
    daily: { instagram: number; tiktok: number; facebook: number; shorts: number }
  }
  currentVideo: CurrentVideo | null
  videos: EnvVideo[]
}

export interface ActivityEvent {
  id: string
  ts: string
  env: string
  type: 'publish' | 'start' | 'done' | 'error' | 'info' | 'chrome'
  message: string
  video?: string
}

export interface NextPublication {
  id: string
  env: 'futebol' | 'motivacao'
  time: string
  date: string
  dateISO: string | null
  filename: string | null
  platforms: string[]
  status: 'pending' | 'posted' | 'processing'
  video?: QueueVideoInfo | null
}

export interface QueueVideoInfo {
  filename: string
  platformState: { key: string; label: string; short: string; done: boolean; error?: string }[]
}

export interface StudioData {
  ts: string
  summary: {
    publishedToday: number
    pending: number
    scheduled: number
    success: number
    publishedTotal: number
    erroTotal: number
  }
  platforms: Record<
    string,
    { today: number; limit: number }
  >
  current: {
    env: 'futebol' | 'motivacao'
    video: CurrentVideo | null
  } | null
  environments: StudioEnvironment[]
  activity: ActivityEvent[]
  upcoming: NextPublication[]
}

export const EMPTY_STUDIO: StudioData = {
  ts: '',
  summary: { publishedToday: 0, pending: 0, scheduled: 0, success: 100, publishedTotal: 0, erroTotal: 0 },
  platforms: { instagram: { today: 0, limit: 5 }, tiktok: { today: 0, limit: 5 }, facebook: { today: 0, limit: 5 }, shorts: { today: 0, limit: 5 } },
  current: null,
  environments: [],
  activity: [],
  upcoming: [],
}

export interface NextEvent {
  id: string
  env: 'futebol' | 'motivacao'
  time: string
  date: string
  dateISO: string | null
  filename: string | null
  platforms: string[]
  status: 'pending' | 'processing'
}