export interface ReelInfo {
  shortcode: string
  videoUrl: string
  thumbnailUrl?: string
}

export function extractReelsFromPage(): ReelInfo[] {
  const reels: ReelInfo[] = []
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/reel/"]')
  const seen = new Set<string>()

  links.forEach(link => {
    const match = link.href.match(/\/reel\/([^/?]+)/)
    if (!match) return
    const shortcode = match[1]
    if (seen.has(shortcode)) return
    seen.add(shortcode)

    const video = link.querySelector<HTMLVideoElement>('video')
    reels.push({
      shortcode,
      videoUrl: video?.src || video?.querySelector('source')?.src || '',
      thumbnailUrl: video?.poster || undefined,
    })
  })

  return reels
}

export function getAllReelLinks(): string[] {
  const links = new Set<string>()
  document.querySelectorAll<HTMLAnchorElement>('a[href*="/reel/"]').forEach(a => {
    const match = a.href.match(/\/reel\/([^/?]+)/)
    if (match) links.add(match[1])
  })
  return [...links]
}

export function extractProfileInfo() {
  const url = window.location.pathname
  const username = url.split('/').filter(Boolean)[0] || ''
  const nameEl = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
  const fullName = nameEl?.content || username

  let avatarUrl: string | undefined

  const metaSelectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'link[rel="image_src"]',
  ]
  for (const sel of metaSelectors) {
    const el = document.querySelector<HTMLMetaElement | HTMLLinkElement>(sel)
    if (el) {
      const src = (el as HTMLMetaElement).content || (el as HTMLLinkElement).href
      if (src && !src.includes('emoji')) { avatarUrl = src; break }
    }
  }

  if (!avatarUrl) {
    const img = document.querySelector<HTMLImageElement>('img[data-visualcompletion="ignore-dynamic"]')
    if (img?.src && !img.src.includes('data:')) avatarUrl = img.src
  }

  return { username, fullName, avatarUrl }
}

export function isReelsPage(): boolean {
  return window.location.pathname.includes('/reels/')
}

export function isProfilePage(): boolean {
  const parts = window.location.pathname.split('/').filter(Boolean)
  return parts.length >= 1 && !parts.includes('reel') && !parts.includes('reels') && !parts.includes('stories')
}
