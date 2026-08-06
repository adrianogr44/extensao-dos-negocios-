import { prisma } from '@/lib/prisma'
import { downloadFile } from '@/lib/minio'
import { publishToYouTube } from './composer'
import { getSessionCookies } from './session'
import { SessionExpiredError } from './types'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { nanoid } from 'nanoid'
import { notifyPublicationBatch, type PublicationNotifyItem } from '@/lib/telegram'

const INTERVAL_MS = 60_000

let intervalId: ReturnType<typeof setInterval> | null = null
let isProcessing = false

export function startYouTubeScrapeWorker() {
  if (intervalId) return
  console.log('[YT Publisher] Worker iniciado')
  processDuePublications()
  intervalId = setInterval(processDuePublications, INTERVAL_MS)
}

export function stopYouTubeScrapeWorker() {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
  console.log('[YT Publisher] Worker parado')
}

async function processDuePublications() {
  if (isProcessing) {
    console.log('[YT Publisher] Já processando, ignorando tick')
    return
  }
  isProcessing = true

  try {
    const publications = await prisma.publication.findMany({
      where: {
        method: 'SCRAPE',
        status: 'SCHEDULED',
        platforms: { has: 'YOUTUBE' },
        youtubeAccountId: { not: null },
        scheduledFor: { lte: new Date() },
      },
      include: {
        youtubeAccount: {
          include: { youtubeSession: true },
        },
      },
    })

    if (publications.length === 0) return

    const notifyItems: PublicationNotifyItem[] = []

    console.log(`[YT Publisher] ${publications.length} publicação(ões) para processar`)

    for (const pub of publications) {
      try {
        await publishSingle(pub)
        notifyItems.push({ platform: 'YOUTUBE', scheduledFor: pub.scheduledFor, success: true })
      } catch (err) {
        console.error(`[YT Publisher] Falha na publicação ${pub.id}:`, err)

        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'

        notifyItems.push({
          platform: 'YOUTUBE',
          scheduledFor: pub.scheduledFor,
          success: false,
          error: errorMessage,
        })

        if (err instanceof SessionExpiredError) {
          if (pub.youtubeAccount?.youtubeSession) {
            await prisma.youtubeSession.update({
              where: { id: pub.youtubeAccount.youtubeSession.id },
              data: { status: 'expired' },
            })
          }
        }

        await prisma.publication.update({
          where: { id: pub.id },
          data: {
            status: 'FAILED',
            errorMessage,
            retryCount: { increment: 1 },
            lastRetryAt: new Date(),
          },
        })

        await prisma.publicationLog.create({
          data: {
            publicationId: pub.id,
            action: 'FAILED',
            metaResponse: JSON.stringify({ error: errorMessage }),
          },
        })
      }
    }

    await notifyPublicationBatch(notifyItems)
  } catch (err) {
    console.error('[YT Publisher] Erro no worker:', err)
  } finally {
    isProcessing = false
  }
}

async function publishSingle(pub: any) {
  if (!pub.youtubeAccount?.youtubeSession) {
    throw new Error('Nenhuma sessão YouTube conectada para esta conta')
  }

  if (pub.youtubeAccount.youtubeSession.status !== 'active') {
    throw new Error('Sessão YouTube expirada ou não conectada')
  }

  const video = await prisma.video.findUnique({
    where: { id: pub.videoId },
    include: {
      renderJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!video) throw new Error('Vídeo não encontrado')

  const tmpDir = await mkdtemp(join(tmpdir(), 'yt-pub-'))
  const ext = video.filename?.split('.').pop() || 'mp4'
  const videoPath = join(tmpDir, `${nanoid()}.${ext}`)

  try {
    const lastRender = video.renderJobs?.[0]
    const hasRender = lastRender?.status === 'completed' && !!lastRender.outputKey

    if (hasRender && lastRender.outputKey) {
      await downloadFile('postreels-renders', lastRender.outputKey, videoPath)
      console.log(`[YT Publisher] Usando vídeo EDITADO (render ${lastRender.id})`)
    } else {
      await downloadFile(video.minioBucket, video.minioKey, videoPath)
      console.log('[YT Publisher] Sem render concluído, usando vídeo original')
    }

    const cookies = await getSessionCookies(pub.youtubeAccountId!)
    if (cookies.length === 0) {
      throw new Error('Não foi possível recuperar cookies da sessão')
    }

    const proxy = process.env.YOUTUBE_SCRAPE_PROXY
    const debug = process.env.YOUTUBE_SCRAPE_DEBUG === 'true'

    const result = await publishToYouTube({
      cookies,
      videoPath,
      description: pub.description,
      hashtags: JSON.parse(pub.hashtags || '[]'),
      scheduledFor: pub.scheduledFor > new Date() ? pub.scheduledFor : undefined,
      proxy,
      debug,
    })

    await prisma.publication.update({
      where: { id: pub.id },
      data: {
        status: result.status === 'scheduled' ? 'SCHEDULED' : 'PUBLISHED',
        metaPostId: result.videoId,
        metaInsightsUrl: result.videoUrl || null,
        publishedAt: result.status === 'published' ? new Date() : null,
      },
    })

    await prisma.publicationLog.create({
      data: {
        publicationId: pub.id,
        action: result.status === 'scheduled' ? 'SCHEDULED' : 'PUBLISHED',
        metaResponse: JSON.stringify(result),
      },
    })

    console.log(
      `[YT Publisher] Publicado: ${pub.id} -> ${result.status} (${result.videoId})`
    )
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => { })
  }
}
