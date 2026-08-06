export interface FacebookPublishParams {
  cookies: readonly { name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None' }[]
  pageId: string
  videoPath: string
  description: string
  hashtags: string[]
  scheduledFor?: Date
  proxy?: string
  debug?: boolean
}

export interface FacebookPublishResult {
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
  fbUserId?: string
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Sessão do Facebook expirada')
    this.name = 'SessionExpiredError'
  }
}
