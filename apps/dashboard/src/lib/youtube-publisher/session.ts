import { createBrowser } from '@/lib/scrape-browser'
import type { CookieInput } from '@/lib/scrape-browser'
import { decryptToken, encryptToken } from '@/lib/meta/encryption'
import { prisma } from '@/lib/prisma'
import type { LoginPollResult, QrLoginResult } from './types'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const SESSION_TIMEOUT_MS = 120_000
const IS_DEBUG = process.env.YOUTUBE_SCRAPE_DEBUG === 'true'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface ActiveLogin {
  browser: Awaited<ReturnType<typeof createBrowser>>
  startedAt: number
  youtubeAccountId: string
  debugDir: string | null
}

const activeLogins = new Map<string, ActiveLogin>()

function hasGoogleSession(cookies: any[]): boolean {
  return cookies.some(c => c.name === 'SID' || c.name === 'SAPISID' || c.name === '__Secure-1PAPISID')
}

function extractGoogleUserId(cookies: any[]): string | null {
  const sid = cookies.find(c => c.name === 'SID')
  return sid ? sid.value : null
}

async function saveSession(sessionId: string, accountId: string, cookies: any[]) {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || ''
  const cookieStr = JSON.stringify(cookies)
  const encrypted = encryptToken(cookieStr, encryptionKey)

  const googleUserId = extractGoogleUserId(cookies)

  await prisma.youtubeSession.update({
    where: { id: sessionId },
    data: {
      encryptedCookies: encrypted,
      status: 'active',
      loggedInAs: 'Conectado',
      googleUserId: googleUserId || null,
      lastUsedAt: new Date(),
    },
  })

  await prisma.youtubeAccount.update({
    where: { id: accountId },
    data: { isActive: true, lastSyncedAt: new Date() },
  }).catch(() => {})
}

export async function initLogin(youtubeAccountId: string): Promise<QrLoginResult> {
  const existing = activeLogins.get(youtubeAccountId)
  if (existing) {
    if (existing.debugDir) await rm(existing.debugDir, { recursive: true, force: true }).catch(() => {})
    await existing.browser.close()
    activeLogins.delete(youtubeAccountId)
  }

  const debugDir = IS_DEBUG ? await mkdtemp(join(tmpdir(), 'yt-login-')) : null

  const debugSnap = async (name: string) => {
    if (!debugDir) return
    try {
      await page.screenshot({ path: join(debugDir, `${name}.png`), fullPage: true })
    } catch {}
  }

  const account = await prisma.youtubeAccount.findUnique({
    where: { id: youtubeAccountId },
  })
  if (!account) throw new Error('Conta YouTube não encontrada')

  const ytSession = await prisma.youtubeSession.upsert({
    where: { youtubeAccountId },
    create: { youtubeAccountId, status: 'requires_login', encryptedCookies: '' },
    update: { status: 'requires_login' },
  })

  const browser = await createBrowser({
    proxy: process.env.YOUTUBE_SCRAPE_PROXY,
    debug: IS_DEBUG,
  })

  const { page, context } = browser

  await page.goto('https://studio.youtube.com', {
    waitUntil: 'networkidle',
    timeout: 60000,
  }).catch(() => {})

  await sleep(5000)
  await debugSnap('01-studio')

  // Se já existir sessão Google nos cookies, salvar e retornar
  const initialCookies = await context.cookies()
  if (hasGoogleSession(initialCookies)) {
    await saveSession(ytSession.id, youtubeAccountId, initialCookies)
    return { sessionId: ytSession.id, qrCode: '' }
  }

  // Caso o Studio redirecione para o login do Google, tentar credenciais env
  const currentUrl = page.url()
  if (currentUrl.includes('accounts.google.com')) {
    const email = process.env.YOUTUBE_SCRAPE_USERNAME
    const password = process.env.YOUTUBE_SCRAPE_PASSWORD
    if (email && password) {
      await debugSnap('02-google-login')
      const emailInput = page.locator('input[type="email"], input[name="identifier"]').first()
      if (await emailInput.isVisible({ timeout: 15000 }).catch(() => false)) {
        await emailInput.fill(email)
        const nextBtn = page.locator('button:has-text("Próxima"), button:has-text("Next")').first()
        if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await nextBtn.click()
          await sleep(3000)
        }
        const passInput = page.locator('input[type="password"]').first()
        if (await passInput.isVisible({ timeout: 15000 }).catch(() => false)) {
          await passInput.fill(password)
          const signInBtn = page.locator('button:has-text("Entrar"), button:has-text("Sign in")').first()
          if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click()
          }
        }
        await sleep(10000)
        await debugSnap('03-after-login')
        const postLoginCookies = await context.cookies()
        if (hasGoogleSession(postLoginCookies)) {
          await saveSession(ytSession.id, youtubeAccountId, postLoginCookies)
          return { sessionId: ytSession.id, qrCode: '' }
        }
      }
    }

    // Sem credenciais configuradas, manter o browser aberto para login manual
    activeLogins.set(youtubeAccountId, { browser, startedAt: Date.now(), youtubeAccountId, debugDir })
    if (debugDir) console.log(`[YT Session] Aguardando confirmação do login (debug: ${debugDir})`)
    return { sessionId: ytSession.id, qrCode: '' }
  }

  // Página inesperada: manter aberto para o usuário resolver
  activeLogins.set(youtubeAccountId, { browser, startedAt: Date.now(), youtubeAccountId, debugDir })
  if (debugDir) console.log(`[YT Session] Debug screenshots: ${debugDir}`)
  return { sessionId: ytSession.id, qrCode: '' }
}

export async function pollLogin(youtubeAccountId: string): Promise<LoginPollResult> {
  const login = activeLogins.get(youtubeAccountId)
  if (!login) {
    const ytSession = await prisma.youtubeSession.findUnique({
      where: { youtubeAccountId },
    })
    if (!ytSession) return { status: 'expired' }

    return {
      status: ytSession.status as 'active' | 'expired' | 'requires_login',
      loggedInAs: ytSession.loggedInAs || undefined,
      googleUserId: ytSession.googleUserId || undefined,
    }
  }

  const { browser, startedAt, debugDir } = login
  const { context, page } = browser

  const debugSnap = async (name: string) => {
    if (!debugDir) return
    try {
      await page.screenshot({ path: join(debugDir, `${name}.png`), fullPage: true })
    } catch {}
  }

  if (Date.now() - startedAt > SESSION_TIMEOUT_MS) {
    await debugSnap('timeout')
    await browser.close()
    if (debugDir) await rm(debugDir, { recursive: true, force: true }).catch(() => {})
    activeLogins.delete(youtubeAccountId)
    return { status: 'expired' }
  }

  const cookies = await context.cookies()

  if (hasGoogleSession(cookies)) {
    await debugSnap('03-login-success')
    const ytSession = await prisma.youtubeSession.findUnique({
      where: { youtubeAccountId },
    })
    if (ytSession) {
      await saveSession(ytSession.id, youtubeAccountId, cookies)
    }

    if (debugDir) {
      console.log(`[YT Session] Debug screenshots: ${debugDir}/*.png`)
      await rm(debugDir, { recursive: true, force: true }).catch(() => {})
    }
    await browser.close()
    activeLogins.delete(youtubeAccountId)

    return {
      status: 'active',
      loggedInAs: 'Conectado',
      googleUserId: extractGoogleUserId(cookies) || undefined,
    }
  }

  return { status: 'requires_login' }
}

export async function disconnectSession(youtubeAccountId: string): Promise<void> {
  const login = activeLogins.get(youtubeAccountId)
  if (login) {
    await login.browser.close()
    activeLogins.delete(youtubeAccountId)
  }

  await prisma.youtubeSession.update({
    where: { youtubeAccountId },
    data: { status: 'requires_login', encryptedCookies: '' },
  })
}

export async function getSessionCookies(
  youtubeAccountId: string
): Promise<readonly CookieInput[]> {
  const ytSession = await prisma.youtubeSession.findUnique({
    where: { youtubeAccountId },
  })

  if (!ytSession || ytSession.status !== 'active' || !ytSession.encryptedCookies) {
    return []
  }

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || ''
  const decrypted = decryptToken(ytSession.encryptedCookies, encryptionKey)
  return JSON.parse(decrypted)
}
