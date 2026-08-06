import { createBrowser } from './browser'
import { decryptToken, encryptToken } from '@/lib/meta/encryption'
import { prisma } from '@/lib/prisma'
import type { FacebookPublishParams, LoginPollResult, QrLoginResult } from './types'
import { writeFile } from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const SESSION_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 2_000
const IS_DEBUG = process.env.FB_SCRAPE_DEBUG === 'true'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function saveSession(fbSession: any, browser: any, cookies: any[]) {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || ''
  const cookieStr = JSON.stringify(cookies)
  const encrypted = encryptToken(cookieStr, encryptionKey)

  const cUser = cookies.find(c => c.name === 'c_user')
  const fbUserId = cUser?.value

  await prisma.facebookSession.update({
    where: { id: fbSession.id },
    data: {
      encryptedCookies: encrypted,
      status: 'active',
      loggedInAs: 'Conectado',
      fbUserId: fbUserId || null,
      lastUsedAt: new Date(),
    },
  })

  await browser.close()
}

interface ActiveLogin {
  browser: Awaited<ReturnType<typeof createBrowser>>
  startedAt: number
  metaAccountId: string
  debugDir: string | null
}

const activeLogins = new Map<string, ActiveLogin>()

export async function initLogin(metaAccountId: string): Promise<QrLoginResult> {
  const existing = activeLogins.get(metaAccountId)
  if (existing) {
    if (existing.debugDir) await rm(existing.debugDir, { recursive: true, force: true }).catch(() => {})
    await existing.browser.close()
    activeLogins.delete(metaAccountId)
  }

  const debugDir = IS_DEBUG ? await mkdtemp(join(tmpdir(), 'fb-login-')) : null

  const debugSnap = async (name: string) => {
    if (!debugDir) return
    try {
      await page.screenshot({ path: join(debugDir, `${name}.png`), fullPage: true })
    } catch {}
  }

  const fbSession = await prisma.facebookSession.upsert({
    where: { metaAccountId },
    create: { metaAccountId, status: 'requires_login', encryptedCookies: '' },
    update: { status: 'requires_login' },
  })

  const browser = await createBrowser({
    proxy: process.env.FB_SCRAPE_PROXY,
    debug: IS_DEBUG,
  })

  const { page, context } = browser

  await page.goto('https://facebook.com', {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  await debugSnap('01-login-page')

  const qrSelector = 'img[alt*="QR"], img[src*="qr"], [data-visualcompletion="ignore-dynamic"] img'
  let qrSrc = ''

  try {
    await page.waitForSelector(qrSelector, { timeout: 15000 })
    qrSrc = await page.getAttribute(qrSelector, 'src') || ''
    await debugSnap('02-qr-code-found')
    if (!qrSrc) qrSrc = ''
  } catch {
    await debugSnap('02-no-qr-checking-session')
    const cookies = await context.cookies()
    const fbCookies = cookies.filter(c => c.name.includes('c_user') || c.name === 'xs')
    if (fbCookies.length >= 2) {
      await saveSession(fbSession, browser, cookies)
      return { sessionId: fbSession.id, qrCode: '' }
    }

    const hasEmailField = await page.$('input[name="email"], input[autocomplete="username"], input[id="email"]')
    if (hasEmailField) {
      const email = process.env.FB_SCRAPE_USERNAME
      const password = process.env.FB_SCRAPE_PASSWORD
      if (email && password) {
        console.log('[FB Session] Logging in with email/password...')
        await debugSnap('03-login-form')
        await hasEmailField.fill(email)
        const passField = await page.$('input[name="pass"], input[autocomplete="current-password"], input[id="pass"]')
        if (passField) await passField.fill(password)
        await debugSnap('04-credentials-filled')

        const loginBtn = await page.$(
          'button#loginbutton, button[name="login"], button[type="submit"], [data-testid="royal_login_button"], div[aria-label="Entrar"], div[aria-label="Log in"]'
        ) || await page.locator(
          '[role="button"]:has-text("Entrar"), [role="button"]:has-text("Log in")'
        ).first().isVisible()
          .then(v => v ? page.locator('[role="button"]:has-text("Entrar"), [role="button"]:has-text("Log in")').first() : null)

        if (loginBtn) {
          await loginBtn.click()
        } else {
          await debugSnap('04-no-login-button')
          console.log('[FB Session] Botão de login não encontrado, tentando submit do formulário...')
          await page.evaluate(() => {
            const form = document.querySelector('#login_form, form[action*="login"]')
            if (form) (form as HTMLFormElement).submit()
          })
        }

        await sleep(30000)
        await debugSnap('05-after-login-click')
        const postLoginCookies = await context.cookies()
        const postLoginFb = postLoginCookies.filter(c => c.name.includes('c_user') || c.name === 'xs')
        if (postLoginFb.length >= 2) {
          await saveSession(fbSession, browser, postLoginCookies)
          return { sessionId: fbSession.id, qrCode: '' }
        }
        activeLogins.set(metaAccountId, { browser, startedAt: Date.now(), metaAccountId, debugDir })
        if (debugDir) console.log(`[FB Session] Aguardando confirmação do login (debug: ${debugDir})`)
        return { sessionId: fbSession.id, qrCode: '' }
      }
      await browser.close()
      throw new Error(
        'Facebook exibiu formulário de login (sem QR code). ' +
        'Configure FB_SCRAPE_USERNAME e FB_SCRAPE_PASSWORD no .env ou faça login manual.'
      )
    }
  }

  if (qrSrc) {
    activeLogins.set(metaAccountId, {
      browser,
      startedAt: Date.now(),
      metaAccountId,
      debugDir,
    })
    if (debugDir) console.log(`[FB Session] Debug screenshots: ${debugDir}`)
    return { sessionId: fbSession.id, qrCode: qrSrc }
  }

  await browser.close()
  if (debugDir) console.log(`[FB Session] Debug screenshots: ${debugDir}`)
  throw new Error('Não foi possível obter QR code nem formulário de login do Facebook')
}

export async function pollLogin(
  metaAccountId: string
): Promise<LoginPollResult> {
  const login = activeLogins.get(metaAccountId)
  if (!login) {
    const fbSession = await prisma.facebookSession.findUnique({
      where: { metaAccountId },
    })
    if (!fbSession) return { status: 'expired' }

    return {
      status: fbSession.status as 'active' | 'expired' | 'requires_login',
      loggedInAs: fbSession.loggedInAs || undefined,
      fbUserId: fbSession.fbUserId || undefined,
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
    activeLogins.delete(metaAccountId)
    return { status: 'expired' }
  }

  const cookies = await context.cookies()
  const fbCookies = cookies.filter(
    c => c.name === 'c_user' || c.name === 'xs'
  )

  if (fbCookies.length >= 2) {
    await debugSnap('03-login-success')
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || ''
    const cookieStr = JSON.stringify(cookies)
    const encrypted = encryptToken(cookieStr, encryptionKey)

    const cUser = cookies.find(c => c.name === 'c_user')
    const fbUserId = cUser?.value

    const page = browser.page
    const loggedInAs = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="al:android:app_name"]')
      return meta?.getAttribute('content') || 'Conta do Facebook'
    }).catch(() => 'Conta do Facebook')

    await prisma.facebookSession.update({
      where: { metaAccountId },
      data: {
        encryptedCookies: encrypted,
        status: 'active',
        loggedInAs,
        fbUserId: fbUserId || null,
        lastUsedAt: new Date(),
      },
    })

    if (debugDir) {
      console.log(`[FB Session] Debug screenshots: ${debugDir}/*.png`)
      await rm(debugDir, { recursive: true, force: true }).catch(() => {})
    }
    await browser.close()
    activeLogins.delete(metaAccountId)

    return {
      status: 'active',
      loggedInAs,
      fbUserId,
    }
  }

  return { status: 'requires_login' }
}

export async function disconnectSession(metaAccountId: string): Promise<void> {
  const login = activeLogins.get(metaAccountId)
  if (login) {
    await login.browser.close()
    activeLogins.delete(metaAccountId)
  }

  await prisma.facebookSession.update({
    where: { metaAccountId },
    data: { status: 'requires_login', encryptedCookies: '' },
  })
}

export async function getSessionCookies(
  metaAccountId: string
): Promise<FacebookPublishParams['cookies']> {
  const fbSession = await prisma.facebookSession.findUnique({
    where: { metaAccountId },
  })

  if (!fbSession || fbSession.status !== 'active' || !fbSession.encryptedCookies) {
    return []
  }

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || ''
  const decrypted = decryptToken(fbSession.encryptedCookies, encryptionKey)
  return JSON.parse(decrypted)
}
