import { createBrowser } from '@/lib/scrape-browser'
import type { TikTokPublishParams, TikTokPublishResult } from './types'
import { SessionExpiredError } from './types'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function publishToTikTok(
  params: TikTokPublishParams
): Promise<TikTokPublishResult> {
  const debugDir = params.debug ? await mkdtemp(join(tmpdir(), 'tt-debug-')) : null

  let debugSnap = async (name: string) => {
    if (!debugDir) return
    try {
      await page.screenshot({ path: join(debugDir!, `${name}.png`), fullPage: true })
    } catch { }
  }

  const { browser, context, page, close } = await createBrowser({
    proxy: params.proxy,
    cookies: params.cookies,
    debug: params.debug,
  })

  try {
    await debugSnap('01-initial')

    await page.goto('https://www.tiktok.com/upload', {
      waitUntil: 'networkidle',
      timeout: 60000,
    }).catch(() => {})

    await sleep(5000)

    // Verificar se está logado: se cair no login ou feed, a sessão não está ativa
    const currentUrl = page.url()
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      throw new SessionExpiredError()
    }

    await debugSnap('02-upload-page')

    // 1. Enviar o vídeo via input[type=file]
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.waitFor({ state: 'attached', timeout: 30000 }).catch(() => {})
    await sleep(1000)
    await fileInput.setInputFiles(params.videoPath)
    console.log('[TT Publisher] Video enviado, aguardando processamento...')
    await sleep(5000)
    await debugSnap('03-uploaded')

    // 2. Legenda
    await page.waitForSelector('div[contenteditable="true"]', { timeout: 30000 }).catch(() => {})
    await sleep(2000)

    const captionBox = page.locator('div[contenteditable="true"]').first()
    if (await captionBox.isVisible({ timeout: 15000 }).catch(() => false)) {
      const fullDescription = [...params.hashtags, params.description].join('\n')
      await captionBox.click()
      await sleep(500)
      await captionBox.fill('')
      await sleep(300)
      await captionBox.fill(fullDescription)
      console.log('[TT Publisher] Legenda inserida')
      await sleep(1000)
    }
    await debugSnap('04-description-filled')

    // 3. Agendamento (best-effort, se o dialogo oferecer)
    if (params.scheduledFor) {
      const scheduleBtn = page.locator(
        'div[role="button"]:has-text("Agendar"), div[role="button"]:has-text("Schedule"), [data-e2e="post-schedule"]'
      ).first()
      if (await scheduleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await scheduleBtn.click()
        await sleep(1500)
        try {
          const dateInput = page.locator(
            'input[type="datetime-local"], input[aria-label*="data"], input[aria-label*="date"]'
          ).first()
          if (await dateInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            const year = params.scheduledFor.getFullYear()
            const month = String(params.scheduledFor.getMonth() + 1).padStart(2, '0')
            const day = String(params.scheduledFor.getDate()).padStart(2, '0')
            const hours = String(params.scheduledFor.getHours()).padStart(2, '0')
            const minutes = String(params.scheduledFor.getMinutes()).padStart(2, '0')
            const formatted = `${year}-${month}-${day}T${hours}:${minutes}`
            await dateInput.fill(formatted)
          }
        } catch (err) {
          console.warn('[TT Publisher] Could not set scheduled time:', err)
        }
      }
    }

    await debugSnap('05-before-publish')

    // 4. Postar
    const postBtn = page.locator('button:has-text("Post"), button:has-text("Publicar"), [data-e2e="post_video_button"]').first()
    if (await postBtn.isVisible({ timeout: 60000 }).catch(() => false)) {
      await postBtn.click({ force: true }).catch(() => postBtn.evaluate(el => (el as HTMLElement).click()))
      console.log('[TT Publisher] Publicar clicado!')
      await sleep(5000)
      await debugSnap('06-after-publish')

      const postId = await extractPostId(page)
      return {
        status: params.scheduledFor ? 'scheduled' : 'published',
        postId: postId || `manual-${Date.now()}`,
        postUrl: page.url(),
      }
    }

    throw new Error('Não foi possível encontrar o botão de publicar no TikTok')
  } finally {
    await close()
  }
}

async function extractPostId(page: import('playwright').Page): Promise<string | null> {
  const url = page.url()
  const match = url.match(/\/video\/(\d+)/)
  if (match) return match[1]

  try {
    await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(3000)
    const href = await page
      .locator('a[href*="/video/"]')
      .first()
      .getAttribute('href', { timeout: 10000 })
      .catch(() => null)
    if (href) {
      const m = href.match(/\/video\/(\d+)/)
      if (m) return m[1]
    }
  } catch (err) {
    console.warn('[TT Publisher] Falha ao extrair postId pós-publicação:', err)
  }

  return null
}
