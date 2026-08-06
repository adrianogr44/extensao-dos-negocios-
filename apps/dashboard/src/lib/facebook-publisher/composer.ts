import { createBrowser } from './browser'
import type { FacebookPublishParams, FacebookPublishResult } from './types'
import { SessionExpiredError } from './types'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildReelsUrl(pageId: string): string {
  if (/^\d+$/.test(pageId)) {
    return `https://www.facebook.com/profile.php?id=${pageId}&sk=reels_tab`
  }
  return `https://www.facebook.com/${pageId}/reels`
}

export async function publishToFacebook(
  params: FacebookPublishParams
): Promise<FacebookPublishResult> {
  const debugDir =
    params.debug
      ? await mkdtemp(join(tmpdir(), 'fb-debug-'))
      : null

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

    const pageUrl = buildReelsUrl(params.pageId)

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(6000)
    await debugSnap('02-reels-tab')

    const isPageReady = await page.$('[role="tablist"], [data-pagelet="ProfileTabs"], [aria-label="Criar reel"], [aria-label="Create reel"]')
    if (!isPageReady) {
      const url = page.url()
      if (url.includes('login') || !url.includes('facebook.com')) {
        throw new SessionExpiredError()
      }
    }

    // 1. Garantir que estamos agindo como a pagina e clicar "Criar reel"
    const criarReel = await ensureCriarReelButton(page, pageUrl)
    if (!criarReel) {
      throw new Error('Botao "Criar reel" nao encontrado na pagina')
    }
    await criarReel.click({ force: true }).catch(() => criarReel.evaluate(el => (el as HTMLElement).click()))
    console.log('[FB Publisher] Criar Reel clicado')
    await sleep(5000)
    await debugSnap('03-creator-opened')

    // 2. Clicar "Carregar" e enviar o video via file chooser (com fallback para input[type=file])
    const carregar = page.locator('div[role="button"]:has-text("Carregar"), div[role="button"]:has-text("Upload")').first()
    if (!(await carregar.isVisible({ timeout: 8000 }).catch(() => false))) {
      throw new Error('Botao "Carregar" nao encontrado')
    }

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null),
      carregar.click().catch(() => { }),
    ])

    if (fileChooser) {
      await fileChooser.setFiles(params.videoPath)
      console.log('[FB Publisher] Video enviado via file chooser')
    } else {
      const fileInput = page.locator('input[type="file"]').first()
      if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fileInput.setInputFiles(params.videoPath)
        console.log('[FB Publisher] Video enviado via input file')
      } else {
        throw new Error('Nao foi possivel abrir o seletor de arquivos')
      }
    }

    await debugSnap('04-upload-started')

    // Aguardar o upload terminar: o botao "Avançar" aparece quando o video foi processado
    const btnNextWait = page.locator('[aria-label="Avançar"]:visible, [aria-label="Next"]:visible').first()
    try {
      await btnNextWait.waitFor({ state: 'visible', timeout: 180_000 })
      console.log('[FB Publisher] Upload concluído (botao Avancar visivel)')
    } catch {
      console.warn('[FB Publisher] Upload timeout esperando "Avançar", continuando mesmo assim')
    }

    await debugSnap('05-upload-complete')
    await sleep(2000)

    // 3. Avancar (2x)
    for (let i = 0; i < 2; i++) {
      const btnNext = page.locator('[aria-label="Avançar"]:visible, [aria-label="Next"]:visible').first()
      if (await btnNext.isVisible({ timeout: 10000 }).catch(() => false)) {
        await btnNext.click({ force: true }).catch(() => btnNext.evaluate(el => (el as HTMLElement).click()))
        console.log(`[FB Publisher] Avancar ${i + 1}`)
        await sleep(5000)
      }
    }
    await debugSnap('06-advanced')

    // 4. Legenda
    const fullDescription = [...params.hashtags, params.description].join('\n')

    const captionBox = page.locator('div[contenteditable="true"]').first()
    if (await captionBox.isVisible({ timeout: 10000 }).catch(() => false)) {
      await captionBox.click()
      await sleep(300)
      await captionBox.fill(fullDescription)
      console.log('[FB Publisher] Legenda inserida')
      await sleep(2000)
    }
    await debugSnap('07-description-filled')

    // 5. Agendamento (best-effort, caso o dialogo de reels ofereca)
    if (params.scheduledFor) {
      const scheduleBtn = page.locator(
        '[aria-label*="Agendar"]:visible, [aria-label*="Schedule"]:visible, div[role="button"]:has-text("Agendar"), div[role="button"]:has-text("Schedule")'
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
          console.warn('[FB Publisher] Could not set scheduled time:', err)
        }
      }
    }

    await debugSnap('08-before-publish')

    // 6. Postar
    const btnPost = page.locator(
      '[aria-label="Postar"]:visible, [aria-label="Publish"]:visible, div[role="button"]:has-text("Postar"), div[role="button"]:has-text("Publish")'
    ).first()
    if (!(await btnPost.isVisible({ timeout: 10000 }).catch(() => false))) {
      throw new Error('Botao "Postar" nao encontrado. Video NAO postado.')
    }
    await btnPost.click({ force: true }).catch(() => btnPost.evaluate(el => (el as HTMLElement).click()))
    console.log('[FB Publisher] Postar clicado!')

    await sleep(30000)
    await debugSnap('09-after-publish')

    const { postId, postUrl } = await extractRealPostId(page, pageUrl)

    return {
      status: params.scheduledFor ? 'scheduled' : 'published',
      postId: postId || `manual-${Date.now()}`,
      postUrl: postUrl || page.url(),
    }
  } finally {
    await close()
  }
}

async function ensureCriarReelButton(
  page: import('playwright').Page,
  reelsUrl: string
): Promise<import('playwright').Locator | null> {
  const tryFind = async () => {
    const btn = page
      .locator('div[role="button"]:has-text("Criar reel"), div[role="button"]:has-text("Create reel")')
      .first()
    return (await btn.isVisible({ timeout: 5000 }).catch(() => false)) ? btn : null
  }

  let btn = await tryFind()
  if (btn) return btn

  // O Facebook abre a pagina em modo visitante; precisamos alternar para
  // "agir como a pagina" para que o botao "Criar reel" apareca.
  const alternarBanner = page.locator('div[role="button"]:has-text("Alternar")').first()
  if (await alternarBanner.isVisible({ timeout: 5000 }).catch(() => false)) {
    await alternarBanner.click()
    await sleep(3000)

    const switchAction = page.locator('[role="dialog"] [role="button"]:has-text("Alternar")').first()
    if (await switchAction.isVisible({ timeout: 5000 }).catch(() => false)) {
      await switchAction.click({ force: true }).catch(() =>
        switchAction.evaluate(el => (el as HTMLElement).click())
      )
      await sleep(8000)

      // Apos o switch o id da pagina pode mudar; re-navegar para a aba de reels
      let nextUrl = reelsUrl
      const idMatch = page.url().match(/profile\.php\?id=(\d+)/)
      if (idMatch) {
        nextUrl = `https://www.facebook.com/profile.php?id=${idMatch[1]}&sk=reels_tab`
      }
      await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(6000)
      btn = await tryFind()
      if (btn) {
        console.log('[FB Publisher] Alternado para agir como a pagina')
        return btn
      }
    }
  }

  return null
}

async function extractRealPostId(
  page: import('playwright').Page,
  reelsUrl: string
): Promise<{ postId: string | null; postUrl: string | null }> {
  const url = page.url()
  const fromUrl = extractPostId(url)
  if (fromUrl) return { postId: fromUrl, postUrl: url }

  try {
    await page.goto(reelsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(5000)

    const firstReel = await page
      .locator('a[href*="/reel/"], a[href*="/videos/"], a[href*="/watch/"]')
      .first()
      .getAttribute('href', { timeout: 10000 })
      .catch(() => null)

    if (firstReel) {
      const id = extractPostId(firstReel)
      if (id) {
        const full = firstReel.startsWith('http')
          ? firstReel
          : `https://www.facebook.com${firstReel}`
        return { postId: id, postUrl: full }
      }
    }
  } catch (err) {
    console.warn('[FB Publisher] Falha ao extrair postId pós-publicação:', err)
  }

  return { postId: null, postUrl: null }
}

function extractPostId(url: string): string | null {
  const patterns = [
    /\/posts\/([^/?]+)/,
    /\/videos\/([^/?]+)/,
    /\/reel\/([^/?]+)/,
    /fbid=(\d+)/,
    /story_fbid[=:]([^&]+)/,
    /photo\/?\?fbid=(\d+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  const fbId = url.match(/\/(\d{10,})\//)
  if (fbId) return fbId[1]

  return null
}
