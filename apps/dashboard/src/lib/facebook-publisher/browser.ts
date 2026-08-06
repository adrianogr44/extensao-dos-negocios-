import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const PLAYWRIGHT_PATH = require.resolve('playwright')

export interface BrowserOptions {
  proxy?: string
  cookies?: readonly { name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None' }[]
  debug?: boolean
  tmpDir?: string
}

export async function createBrowser(options: BrowserOptions = {}): Promise<{
  browser: Browser
  context: BrowserContext
  page: Page
  close: () => Promise<void>
}> {
  const browser = await chromium.launch({
    headless: !options.debug,
    proxy: options.proxy ? { server: options.proxy } : undefined,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  })

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })

  if (options.cookies?.length) {
    await context.addCookies(options.cookies)
  }

  const page = await context.newPage()

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    })
    Object.defineProperty(navigator, 'languages', {
      get: () => ['pt-BR', 'pt', 'en-US', 'en'],
    })
  })

  return {
    browser,
    context,
    page,
    close: async () => {
      try {
        await context.close()
      } catch { }
      try {
        await browser.close()
      } catch { }
    },
  }
}

export async function saveCookies(context: BrowserContext) {
  return context.cookies()
}

export function getPlaywrightPath(): string {
  return PLAYWRIGHT_PATH
}
