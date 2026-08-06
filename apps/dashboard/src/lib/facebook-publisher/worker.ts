import { prisma } from '@/lib/prisma'
import { downloadFile } from '@/lib/minio'
import { publishToFacebook } from './composer'
import { getSessionCookies } from './session'
import { SessionExpiredError } from './types'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { nanoid } from 'nanoid'

const INTERVAL_MS = 60_000

let intervalId: ReturnType<typeof setInterval> | null = null
let isProcessing = false

export function startFacebookScrapeWorker() {
  if (intervalId) return
  console.log('[FB Publisher] Worker iniciado')
  processDuePublications()
  intervalId = setInterval(processDuePublications, INTERVAL_MS)
}

export function stopFacebookScrapeWorker() {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
  console.log('[FB Publisher] Worker parado')
}

async function processDuePublications() {
  if (isProcessing) {
    console.log('[FB Publisher] Já processando, ignorando tick')
    return
  }
  isProcessing = true

  try {
    const publications = await prisma.publication.findMany({
      where: {
        method: 'SCRAPE',
        status: 'SCHEDULED',
        platforms: { has: 'FACEBOOK' },
        metaAccountId: { not: null },
        scheduledFor: { lte: new Date() },
      },
      include: {
        metaAccount: {
          include: { facebookSession: true },
        },
      },
    })

    if (publications.length === 0) return

    console.log(`[FB Publisher] ${publications.length} publicação(ões) para processar`)

    for (const pub of publications) {
      try {
        await publishSingle(pub)
      } catch (err) {
        console.error(`[FB Publisher] Falha na publicação ${pub.id}:`, err)

        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'

        if (err instanceof SessionExpiredError) {
          if (pub.metaAccount?.facebookSession) {
            await prisma.facebookSession.update({
              where: { id: pub.metaAccount.facebookSession.id },
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
  } catch (err) {
    console.error('[FB Publisher] Erro no worker:', err)
  } finally {
    isProcessing = false
  }
}

async function publishSingle(
  pub: any
) {
  if (!pub.metaAccount?.facebookSession) {
    throw new Error('Nenhuma sessão Facebook conectada para esta conta')
  }

  if (!pub.metaAccount) {
    throw new Error('Publicação sem conta Meta associada')
  }

  if (pub.metaAccount.facebookSession.status !== 'active') {
    throw new Error('Sessão Facebook expirada ou não conectada')
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

  const tmpDir = await mkdtemp(join(tmpdir(), 'fb-pub-'))
  const ext = video.filename?.split('.').pop() || 'mp4'
  const videoPath = join(tmpDir, `${nanoid()}.${ext}`)

  try {
    const lastRender = video.renderJobs?.[0]
    const hasRender = lastRender?.status === 'completed' && !!lastRender.outputKey

    if (hasRender && lastRender.outputKey) {
      await downloadFile('postreels-renders', lastRender.outputKey, videoPath)
      console.log(`[FB Publisher] Usando vídeo EDITADO (render ${lastRender.id})`)
    } else {
      await downloadFile(video.minioBucket, video.minioKey, videoPath)
      console.log('[FB Publisher] Sem render concluído, usando vídeo original')
    }

    const cookies = await getSessionCookies(pub.metaAccount.id)
    if (cookies.length === 0) {
      throw new Error('Não foi possível recuperar cookies da sessão')
    }

    const proxy = process.env.FB_SCRAPE_PROXY
    const debug = process.env.FB_SCRAPE_DEBUG === 'true'

    const result = await publishToFacebook({
      cookies,
      pageId: pub.metaAccount.facebookPageId,
      videoPath,
      description: pub.description,
      hashtags: JSON.parse(pub.hashtags || '[]'),
      scheduledFor:
        pub.scheduledFor > new Date() ? pub.scheduledFor : undefined,
      proxy,
      debug,
    })

    await prisma.publication.update({
      where: { id: pub.id },
      data: {
        status:
          result.status === 'scheduled' ? 'SCHEDULED' : 'PUBLISHED',
        metaPostId: result.postId,
        metaInsightsUrl: result.postUrl || null,
        publishedAt:
          result.status === 'published' ? new Date() : null,
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
      `[FB Publisher] Publicado: ${pub.id} -> ${result.status} (${result.postId})`
    )
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => { })
  }
}
