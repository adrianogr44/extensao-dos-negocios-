import type { CookieInput } from '@/lib/scrape-browser'

export interface YouTubePublishParams {
  cookies: readonly CookieInput[]
  videoPath: string
  description: string
  hashtags: string[]
  scheduledFor?: Date
  proxy?: string
  debug?: boolean
}

export interface YouTubePublishResult {
  status: 'published' | 'scheduled'
  videoId: string
  videoUrl?: string
}

export interface QrLoginResult {
  sessionId: string
  qrCode: string
}

export interface LoginPollResult {
  status: 'active' | 'requires_login' | 'expired'
  loggedInAs?: string
  googleUserId?: string
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Sessão do YouTube expirada')
    this.name = 'SessionExpiredError'
  }
}
