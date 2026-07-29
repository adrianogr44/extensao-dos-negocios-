import type { ReelInfo } from './types'

export function extractReelsFromPage(): ReelInfo[] {
  const reels: ReelInfo[] = []
  const seen = new Set<string>()

  const links = document.querySelectorAll('a[href*="/reel/"]')

  links.forEach(link => {
    const href = link.getAttribute('href')
    if (!href) return

    const match = href.match(/\/reel\/([^/?]+)/)
    if (!match || seen.has(match[1])) return
    seen.add(match[1])

    const shortcode = match[1]

    let videoUrl = ''
    let thumbnailUrl: string | undefined

    let current: Element | null = link
    while (current && !videoUrl) {
      const video = current.querySelector('video')
      if (video) {
        const source = video.querySelector('source[type="video/mp4"]')
        if (source) {
          videoUrl = source.getAttribute('src') || ''
        }
        if (!videoUrl && video.src) {
          videoUrl = video.src
        }
        if (!videoUrl) {
          const dataSrc = video.getAttribute('data-src')
          if (dataSrc) videoUrl = dataSrc
        }
        thumbnailUrl = video.getAttribute('poster') || undefined
        break
      }
      const img = current.querySelector('img[src*="cdninstagram"]')
      if (img && !thumbnailUrl) {
        thumbnailUrl = img.getAttribute('src') || undefined
      }
      current = current.parentElement
    }

    reels.push({
      shortcode,
      videoUrl,
      thumbnailUrl,
    })
  })

  return reels
}

export function getAllReelLinks(): string[] {
  const links = document.querySelectorAll('a[href*="/reel/"]')
  const shortcodes = new Set<string>()
  links.forEach(link => {
    const href = link.getAttribute('href')
    if (!href) return
    const match = href.match(/\/reel\/([^/?]+)/)
    if (match) shortcodes.add(match[1])
  })
  return Array.from(shortcodes)
}

export function extractProfileInfo() {
  const info = { username: '', fullName: '', avatarUrl: '', postsCount: 0, followersCount: 0 }

  // username from URL
  const pathParts = window.location.pathname.split('/').filter(Boolean)
  if (pathParts.length > 0) info.username = pathParts[0]

  // Try JSON-LD (structured data injected by Instagram)
  const ldScript = document.querySelector('script[type="application/ld+json"]')
  if (ldScript) {
    try {
      const ld = JSON.parse(ldScript.textContent || '{}')
      if (ld.name) info.fullName = ld.name
      if (ld.url) info.username = ld.url.split('/').filter(Boolean).pop() || info.username
      if (ld.description) {
        const postMatch = ld.description.match(/([\d,.]+)\s*[Pp]ublicaç/)
        const followerMatch = ld.description.match(/([\d,.]+)\s*[Ss]eguidor/)
        if (postMatch) info.postsCount = parseCount(postMatch[1])
        if (followerMatch) info.followersCount = parseCount(followerMatch[1])
      }
    } catch {}
  }

  // Fallback: scrape meta tags and visible elements
  if (!info.fullName) {
    const metaTitle = document.querySelector('meta[property="og:title"]')
    if (metaTitle) info.fullName = metaTitle.getAttribute('content')?.split('(')[0]?.trim() || ''
  }

  // Avatar: try multiple selectors used by Instagram's current DOM
  const avatarSelectors = [
    'meta[property="og:image"]',
    'img[alt*="' + info.username + '"]',
    'img[data-testid="user-avatar"]',
    'header img[src*="scontent"]',
    'img[src*="scontent"][src*="cdninstagram"]',
    'section main img[src*="scontent"]',
    'article header img[src*="scontent"]',
  ]
  for (const sel of avatarSelectors) {
    const el = document.querySelector(sel)
    if (el) {
      const src = sel === 'meta[property="og:image"]'
        ? (el as HTMLMetaElement).content
        : (el as HTMLImageElement).src
      if (src && src.startsWith('http')) {
        info.avatarUrl = src
        break
      }
    }
  }

  return info
}

function parseCount(str: string): number {
  return parseInt(str.replace(/[,.]/g, '')) || 0
}

export function isReelsPage(): boolean {
  return window.location.pathname.includes('/reels/')
}

export function isProfilePage(): boolean {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts.length === 0) return false
  const first = parts[0]
  if (first === 'explore' || first === 'reel' || first === 'p' || first === 'stories' || first === 'direct') return false
  return parts.length <= 2
}
