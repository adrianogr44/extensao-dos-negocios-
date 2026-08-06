import type { CookieInput } from '@/lib/scrape-browser'

export interface TikTokPublishParams {
  cookies: readonly CookieInput[]
  videoPath: string
  description: string
  hashtags: string[]
  scheduledFor?: Date
  proxy?: string
  debug?: boolean
}

export interface TikTokPublishResult {
  status: 'published' | 'scheduled'
  postId: string
  postUrl?: string
}

export interface QrLoginResult {
  sessionId: string
  qrCode: string
}

export interface LoginPollResult {
  status: 'active' | 'requires_login' | 'expired'
  loggedInAs?: string
  ttUserId?: string
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Sessão do TikTok expirada')
    this.name = 'SessionExpiredError'
  }
}
