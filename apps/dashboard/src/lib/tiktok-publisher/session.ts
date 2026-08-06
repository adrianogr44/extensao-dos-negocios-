import { createBrowser } from '@/lib/scrape-browser'
import type { CookieInput } from '@/lib/scrape-browser'
import { decryptToken, encryptToken } from '@/lib/meta/encryption'
import { prisma } from '@/lib/prisma'
import type { LoginPollResult, QrLoginResult } from './types'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const SESSION_TIMEOUT_MS = 120_000
const IS_DEBUG = process.env.TIKTOK_SCRAPE_DEBUG === 'true'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface ActiveLogin {
  browser: Awaited<ReturnType<typeof createBrowser>>
  startedAt: number
  tiktokAccountId: string
  debugDir: string | null
}

const activeLogins = new Map<string, ActiveLogin>()

async function saveSession(sessionId: string, accountId: string, cookies: any[]) {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || ''
  const cookieStr = JSON.stringify(cookies)
  const encrypted = encryptToken(cookieStr, encryptionKey)

  const sessionCookie = cookies.find(c => c.name === 'sessionid')
  const ttUserId = sessionCookie?.value

  await prisma.tiktokSession.update({
    where: { id: sessionId },
    data: {
      encryptedCookies: encrypted,
      status: 'active',
      loggedInAs: 'Conectado',
      ttUserId: ttUserId || null,
      lastUsedAt: new Date(),
    },
  })

  await prisma.tiktokAccount.update({
    where: { id: accountId },
    data: { isActive: true, lastSyncedAt: new Date() },
  }).catch(() => {})
}

export async function initLogin(tiktokAccountId: string): Promise<QrLoginResult> {
  const existing = activeLogins.get(tiktokAccountId)
  if (existing) {
    if (existing.debugDir) await rm(existing.debugDir, { recursive: true, force: true }).catch(() => {})
    await existing.browser.close()
    activeLogins.delete(tiktokAccountId)
  }

  const debugDir = IS_DEBUG ? await mkdtemp(join(tmpdir(), 'tt-login-')) : null

  const debugSnap = async (name: string) => {
    if (!debugDir) return
    try {
      await page.screenshot({ path: join(debugDir, `${name}.png`), fullPage: true })
    } catch {}
  }

  const account = await prisma.tiktokAccount.findUnique({
    where: { id: tiktokAccountId },
  })
  if (!account) throw new Error('Conta TikTok não encontrada')

  const ttSession = await prisma.tiktokSession.upsert({
    where: { tiktokAccountId },
    create: { tiktokAccountId, status: 'requires_login', encryptedCookies: '' },
    update: { status: 'requires_login' },
  })

  const browser = await createBrowser({
    proxy: process.env.TIKTOK_SCRAPE_PROXY,
    debug: IS_DEBUG,
  })

  const { page, context } = browser

  await page.goto('https://www.tiktok.com/login', {
    waitUntil: 'networkidle',
    timeout: 30000,
  }).catch(() => {})

  await sleep(3000)
  await debugSnap('01-login-page')

  // Tenta obter o QR code (painel de login do TikTok oferece "Usar QR code")
  const qrSelector = 'img[alt*="QR"], img[src*="qrcode"], [data-e2e="qr-code"] img, [id*="qr"] img'
  let qrSrc = ''

  try {
    const qrToggle = page.locator('div[role="button"]:has-text("QR"), button:has-text("QR"), [data-e2e*="qr"]').first()
    if (await qrToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await qrToggle.click()
      await sleep(2000)
    }
  } catch {}

  try {
    await page.waitForSelector(qrSelector, { timeout: 10000 })
    qrSrc = (await page.locator(qrSelector).first().getAttribute('src')) || ''
    if (!qrSrc) qrSrc = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
      const qr = imgs.find(i => (i.src || '').includes('data:image'))
      return qr?.src || ''
    })
    await debugSnap('02-qr-code-found')
  } catch {
    await debugSnap('02-no-qr')
  }

  if (qrSrc) {
    activeLogins.set(tiktokAccountId, {
      browser,
      startedAt: Date.now(),
      tiktokAccountId,
      debugDir,
    })
    if (debugDir) console.log(`[TT Session] Debug screenshots: ${debugDir}`)
    return { sessionId: ttSession.id, qrCode: qrSrc }
  }

  // Fallback: verificar sessão existente nos cookies
  const cookies = await context.cookies()
  const sessionCookie = cookies.find(c => c.name === 'sessionid')
  if (sessionCookie) {
    await saveSession(ttSession.id, tiktokAccountId, cookies)
    return { sessionId: ttSession.id, qrCode: '' }
  }

  // Fallback: login por email/password se configurado
  const hasEmailField = await page.$('input[name="email"], input[autocomplete="username"], input[name="username"]')
  if (hasEmailField) {
    const email = process.env.TIKTOK_SCRAPE_USERNAME
    const password = process.env.TIKTOK_SCRAPE_PASSWORD
    if (email && password) {
      await debugSnap('03-login-form')
      await hasEmailField.fill(email)
      const passField = await page.$('input[type="password"]')
      if (passField) await passField.fill(password)
      const loginBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Log in")').first()
      if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await loginBtn.click()
      }
      await sleep(30000)
      const postLoginCookies = await context.cookies()
      const postSession = postLoginCookies.find(c => c.name === 'sessionid')
      if (postSession) {
        await saveSession(ttSession.id, tiktokAccountId, postLoginCookies)
        return { sessionId: ttSession.id, qrCode: '' }
      }
      activeLogins.set(tiktokAccountId, { browser, startedAt: Date.now(), tiktokAccountId, debugDir })
      return { sessionId: ttSession.id, qrCode: '' }
    }
    await browser.close()
    throw new Error(
      'TikTok exibiu formulário de login (sem QR code). Configure TIKTOK_SCRAPE_USERNAME e TIKTOK_SCRAPE_PASSWORD no .env ou faça login manual.'
    )
  }

  await browser.close()
  if (debugDir) console.log(`[TT Session] Debug screenshots: ${debugDir}`)
  throw new Error('Não foi possível obter QR code nem formulário de login do TikTok')
}

export async function pollLogin(tiktokAccountId: string): Promise<LoginPollResult> {
  const login = activeLogins.get(tiktokAccountId)
  if (!login) {
    const ttSession = await prisma.tiktokSession.findUnique({
      where: { tiktokAccountId },
    })
    if (!ttSession) return { status: 'expired' }

    return {
      status: ttSession.status as 'active' | 'expired' | 'requires_login',
      loggedInAs: ttSession.loggedInAs || undefined,
      ttUserId: ttSession.ttUserId || undefined,
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
    activeLogins.delete(tiktokAccountId)
    return { status: 'expired' }
  }

  const cookies = await context.cookies()
  const sessionCookie = cookies.find(c => c.name === 'sessionid')

  if (sessionCookie) {
    await debugSnap('03-login-success')
    const ttSession = await prisma.tiktokSession.findUnique({
      where: { tiktokAccountId },
    })
    if (ttSession) {
      await saveSession(ttSession.id, tiktokAccountId, cookies)
    }

    if (debugDir) {
      console.log(`[TT Session] Debug screenshots: ${debugDir}/*.png`)
      await rm(debugDir, { recursive: true, force: true }).catch(() => {})
    }
    await browser.close()
    activeLogins.delete(tiktokAccountId)

    return { status: 'active', loggedInAs: 'Conectado', ttUserId: sessionCookie.value }
  }

  return { status: 'requires_login' }
}

export async function disconnectSession(tiktokAccountId: string): Promise<void> {
  const login = activeLogins.get(tiktokAccountId)
  if (login) {
    await login.browser.close()
    activeLogins.delete(tiktokAccountId)
  }

  await prisma.tiktokSession.update({
    where: { tiktokAccountId },
    data: { status: 'requires_login', encryptedCookies: '' },
  })
}

export async function getSessionCookies(
  tiktokAccountId: string
): Promise<readonly CookieInput[]> {
  const ttSession = await prisma.tiktokSession.findUnique({
    where: { tiktokAccountId },
  })

  if (!ttSession || ttSession.status !== 'active' || !ttSession.encryptedCookies) {
    return []
  }

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || ''
  const decrypted = decryptToken(ttSession.encryptedCookies, encryptionKey)
  return JSON.parse(decrypted)
}
