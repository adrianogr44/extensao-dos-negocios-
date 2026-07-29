export interface ReelInfo {
  shortcode: string
  videoUrl: string
  thumbnailUrl?: string
}

export function extractShortsFromPage(): ReelInfo[] {
  const shorts: ReelInfo[] = []
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/shorts/"]')
  const seen = new Set<string>()

  links.forEach(link => {
    const match = link.href.match(/\/shorts\/([^/?&]+)/)
    if (!match) return
    const shortcode = match[1]
    if (seen.has(shortcode)) return
    seen.add(shortcode)

    shorts.push({
      shortcode,
      videoUrl: `https://www.youtube.com/shorts/${shortcode}`,
      thumbnailUrl: undefined,
    })
  })

  return shorts
}

export function getAllShortsLinks(): string[] {
  const links = new Set<string>()
  document.querySelectorAll<HTMLAnchorElement>('a[href*="/shorts/"]').forEach(a => {
    const match = a.href.match(/\/shorts\/([^/?&]+)/)
    if (match) links.add(match[1])
  })
  return [...links]
}

export function extractProfileInfo() {
  const url = window.location.pathname
  const username = url.split('/').filter(Boolean)[0]?.replace('@', '') || ''
  const nameEl = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
  const fullName = nameEl?.content?.replace(' - YouTube', '') || username
  const avatarEl = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')
  const avatarUrl = avatarEl?.content || undefined
  return { username, fullName, avatarUrl }
}

export function isShortsPage(): boolean {
  return window.location.pathname.includes('/shorts')
}

export function isChannelPage(): boolean {
  const parts = window.location.pathname.split('/').filter(Boolean)
  return parts.some(p => p.startsWith('@')) && !parts.includes('shorts')
}
