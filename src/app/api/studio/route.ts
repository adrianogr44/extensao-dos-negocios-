import { NextResponse } from 'next/server'
import {
  ENVS,
  PLATFORMS,
  loadQueue,
  loadSchedule,
  checkPort,
  lockInfo,
  isProcessing,
  loadActivity,
  countTodayByPlatform,
  successRate,
  pendingVideos,
  nextPublications,
  type Env,
  type QueueVideo,
} from '@/lib/studio-data'

export const dynamic = 'force-dynamic'

const DAILY_LIMITS: Record<string, number> = {
  futebol: 5,
  motivacao: 5,
}

function vf(v: QueueVideo, field: string): unknown {
  return (v as unknown as Record<string, unknown>)[field]
}

function platformUse(v: QueueVideo, key: string): boolean {
  return !!vf(v, PLATFORMS.find((p) => p.key === key)!.field)
}

function videoStatus(env: Env, v: QueueVideo): string {
  const done = env.enabledPlatforms.filter((k) => platformUse(v, k))
  if (v.error) return 'erro'
  if (done.length === env.enabledPlatforms.length) return 'publicado'
  if (done.length > 0) return 'parcial'
  return 'pendente'
}

function buildEnvironment(env: Env) {
  const queue = loadQueue(env)
  const schedule = loadSchedule(env)
  const lock = lockInfo(env.lockFile)
  const processing = isProcessing(env)
  const today = new Date().toLocaleDateString('en-CA')
  const todayCounts = countTodayByPlatform(queue)
  const pending = pendingVideos(env, queue)
  const publishedToday = queue.videos.filter(
    (v) =>
      v.instagramDate?.slice(0, 10) === today ||
      v.tiktokDate?.slice(0, 10) === today ||
      v.facebookDate?.slice(0, 10) === today ||
      v.shortsDate?.slice(0, 10) === today
  ).length

  const currentVideo = pending[0] ?? null

  return {
    id: env.id,
    nome: env.nome,
    color: env.color,
    port: env.port,
    chromeProfile: env.chromeProfile,
    videosDir: env.videosDir,
    platforms: env.enabledPlatforms.map((key) => {
      const p = PLATFORMS.find((pp) => pp.key === key)!
      return {
        key,
        label: p.label,
        short: p.short,
        today: todayCounts[key] ?? 0,
        limit: DAILY_LIMITS[env.id] ?? 5,
        posted: queue.videos.filter((v) => platformUse(v, key)).length,
      }
    }),
    schedule: schedule.times,
    scheduleEnabled: schedule.enabled,
    timezone: schedule.timezone,
    videosPerRun: schedule.videosPerRun,
    online: lock.locked ? true : undefined,
    processing,
    lock: {
      locked: lock.locked,
      pid: lock.pid,
      ageMs: lock.ageMs,
    },
    queue: {
      total: queue.videos.length,
      pending: pending.length,
      publishedToday,
      lastPostDate: queue.lastPostDate,
      daily: {
        instagram: queue.dailyCount,
        tiktok: queue.dailyCountTikTok,
        facebook: queue.dailyCountFacebook,
        shorts: queue.dailyCountShorts,
      },
    },
    currentVideo: currentVideo
      ? {
          filename: currentVideo.filename,
          platformState: PLATFORMS.map((p) => ({ key: p.key, label: p.label, short: p.short, done: !!vf(currentVideo, p.field), date: (vf(currentVideo, p.dateField) ?? null) as string | null })),
          error: currentVideo.error,
        }
      : null,
    videos: queue.videos.map((v) => ({
      filename: v.filename,
      status: videoStatus(env, v),
      platforms: PLATFORMS.map((p) => ({ key: p.key, label: p.label, short: p.short, done: !!vf(v, p.field) })),
      dates: PLATFORMS.map((p) => vf(v, p.dateField)).filter(Boolean) as string[],
      error: v.error,
    })),
  }
}

export async function GET() {
  const [futebolOnline, motivacaoOnline] = await Promise.all([checkPort(9222), checkPort(9223)])
  const envs = ENVS.map((env) => {
    const data = buildEnvironment(env)
    return {
      ...data,
      online: env.id === 'futebol' ? futebolOnline : motivacaoOnline,
    }
  })

  const futebol = envs.find((e) => e.id === 'futebol')!
  const motivacao = envs.find((e) => e.id === 'motivacao')!

  const activity = [...loadActivity(ENVS[0]), ...loadActivity(ENVS[1])]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 40)

  const publishedTotal = futebol.videos.filter((v) => v.status === 'publicado').length + motivacao.videos.filter((v) => v.status === 'publicado').length
  const pendingTotal = futebol.queue.pending + motivacao.queue.pending
  const publishedToday = futebol.queue.publishedToday + motivacao.queue.publishedToday
  const erroTotal = futebol.videos.filter((v) => v.status === 'erro').length + motivacao.videos.filter((v) => v.status === 'erro').length

  const success = Math.round(((successRate(loadQueue(ENVS[0])) * (loadQueue(ENVS[0]).videos.length || 1)) + (successRate(loadQueue(ENVS[1])) * (loadQueue(ENVS[1]).videos.length || 1))) / Math.max(1, loadQueue(ENVS[0]).videos.length + loadQueue(ENVS[1]).videos.length) * 100)

  const upcoming = nextPublications(6)

  return NextResponse.json({
    ts: new Date().toISOString(),
    summary: {
      publishedToday,
      pending: pendingTotal,
      scheduled: upcoming.length,
      success,
      publishedTotal,
      erroTotal,
    },
    platforms: {
      instagram: { today: futebol.platforms.find((p) => p.key === 'instagram')?.today ?? 0, limit: futebol.platforms.find((p) => p.key === 'instagram')?.limit ?? 5 },
      tiktok: { today: (futebol.platforms.find((p) => p.key === 'tiktok')?.today ?? 0) + (motivacao.platforms.find((p) => p.key === 'tiktok')?.today ?? 0), limit: (futebol.platforms.find((p) => p.key === 'tiktok')?.limit ?? 5) + (motivacao.platforms.find((p) => p.key === 'tiktok')?.limit ?? 5) },
      facebook: { today: (futebol.platforms.find((p) => p.key === 'facebook')?.today ?? 0) + (motivacao.platforms.find((p) => p.key === 'facebook')?.today ?? 0), limit: (futebol.platforms.find((p) => p.key === 'facebook')?.limit ?? 5) + (motivacao.platforms.find((p) => p.key === 'facebook')?.limit ?? 5) },
      shorts: { today: futebol.platforms.find((p) => p.key === 'shorts')?.today ?? 0, limit: futebol.platforms.find((p) => p.key === 'shorts')?.limit ?? 5 },
    },
    current: futebol.processing || motivacao.processing
      ? {
          env: futebol.processing ? 'futebol' : 'motivacao',
          video: (futebol.processing ? futebol : motivacao).currentVideo,
        }
      : null,
    environments: envs,
    activity,
    upcoming,
  })
}