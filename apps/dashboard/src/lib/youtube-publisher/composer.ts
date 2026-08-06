import { createBrowser } from '@/lib/scrape-browser'
import type { YouTubePublishParams, YouTubePublishResult } from './types'
import { SessionExpiredError } from './types'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function clickVisible(
  page: import('playwright').Page,
  selectors: string[],
  timeout = 3000
): Promise<boolean> {
  for (const sel of selectors) {
    const el = page.locator(sel).first()
    if (await el.isVisible({ timeout }).catch(() => false)) {
      await el.click()
      return true
    }
  }
  return false
}

export async function publishToYouTube(
  params: YouTubePublishParams
): Promise<YouTubePublishResult> {
  const debugDir = params.debug ? await mkdtemp(join(tmpdir(), 'yt-debug-')) : null

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

    await page.goto('https://studio.youtube.com', {
      waitUntil: 'load',
      timeout: 60000,
    }).catch(() => {})

    await sleep(5000)

    const currentUrl = page.url()
    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('/login')) {
      throw new SessionExpiredError()
    }

    await debugSnap('02-studio')

    // 1. Abrir o menu de criação
    const created = await clickVisible(
      page,
      ['ytcp-button#create-icon', 'ytcp-button:has-text("Criar")', 'ytcp-button:has-text("Create")'],
      10000
    )
    if (!created) throw new Error('Botão de criar não encontrado no YouTube Studio')
    await sleep(3000)
    await debugSnap('03-create')

    // 2. Selecionar "Enviar vídeos" / "Upload videos"
    const uploadSelected = await clickVisible(
      page,
      ['ytcp-ve:has-text("Enviar vídeos")', 'ytcp-ve:has-text("Upload videos")', 'tp-yt-paper-item:has-text("Upload")'],
      5000
    )
    if (!uploadSelected) throw new Error('Opção de upload não encontrada')
    await sleep(3000)
    await debugSnap('04-upload-dialog')

    // 3. Enviar o vídeo
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.waitFor({ state: 'attached', timeout: 30000 }).catch(() => {})
    await sleep(1000)
    await fileInput.setInputFiles(params.videoPath)
    console.log('[YT Publisher] Video enviado, aguardando processamento...')
    await sleep(30000)
    await debugSnap('05-uploaded')

    // 4. Título (descrição completa com hashtags)
    const titleEl = page.locator('#title-textarea').first()
    await titleEl.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {})
    if (await titleEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const fullTitle = [...params.hashtags, params.description].join(' ')
      await page.evaluate((text) => {
        const host = document.querySelector('#title-textarea')
        if (!host) return
        const editable = host.querySelector('#textbox') || host.querySelector('[contenteditable]')
        if (editable) {
          editable.textContent = ''
          editable.textContent = text
          editable.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
          editable.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, fullTitle)
      console.log(`[YT Publisher] Titulo inserido (${fullTitle.substring(0, 40)}...)`)
      await sleep(2000)
    }
    await debugSnap('06-title')

    // 5. "Não é conteúdo para crianças"
    await clickVisible(
      page,
      ['tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]', '[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'],
      5000
    )
    await sleep(1000)
    await debugSnap('07-kids')

    // 6. Avançar pelas etapas de detalhes/verificação
    let nextStep = 1
    while (nextStep <= 3) {
      const found = await clickVisible(
        page,
        ['#next-button', 'ytcp-button#next-button', 'ytcp-button:has-text("Próxima")', 'ytcp-button:has-text("Next")'],
        5000
      )
      if (found) {
        console.log(`[YT Publisher] Proximo ${nextStep} clicado`)
        await sleep(4000)
        await debugSnap(`08-next-${nextStep}`)
        nextStep++
      } else {
        break
      }
    }

    await debugSnap('09-visibility')

    // 7. Visibilidade: Público
    await clickVisible(
      page,
      [
        'tp-yt-paper-radio-button[name="PUBLIC"]',
        '[name="PUBLIC"]',
        'tp-yt-paper-radio-button:has-text("Público")',
        'tp-yt-paper-radio-button:has-text("Public")',
      ],
      3000
    )
    await sleep(1000)
    await debugSnap('10-before-publish')

    // 8. Publicar
    const published = await clickVisible(
      page,
      ['#done-button', 'ytcp-button#done-button', 'ytcp-button:has-text("Publicar")', 'ytcp-button:has-text("Publish")'],
      5000
    )

    if (!published) {
      await debugSnap('11-no-publish-button')
      throw new Error('Botão Publicar não encontrado no YouTube Studio')
    }

    console.log('[YT Publisher] Publicar clicado! Aguardando...')
    await sleep(30000)
    await debugSnap('12-after-publish')

    const videoId = await extractVideoId(page)
    return {
      status: params.scheduledFor ? 'scheduled' : 'published',
      videoId: videoId || `manual-${Date.now()}`,
      videoUrl: videoId ? `https://youtu.be/${videoId}` : page.url(),
    }
  } finally {
    await close()
  }
}

async function extractVideoId(page: import('playwright').Page): Promise<string | null> {
  // URL de sucesso no Studio: https://studio.youtube.com/video/{id}/edit
  const url = page.url()
  const match = url.match(/studio\.youtube\.com\/video\/([^/?#]+)/)
  if (match) return match[1]

  // Fallback: aguardar navegação para a página de edição do vídeo
  try {
    await page.waitForURL(/studio\.youtube\.com\/video\/.+/, { timeout: 30000 }).catch(() => {})
    const m = page.url().match(/studio\.youtube\.com\/video\/([^/?#]+)/)
    if (m) return m[1]
  } catch (err) {
    console.warn('[YT Publisher] Falha ao extrair videoId pós-publicação:', err)
  }

  return null
}
