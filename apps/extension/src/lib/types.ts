export interface PostReelsConfig {
  apiUrl: string
  minioEndpoint: string
  minioAccessKey: string
  minioSecretKey: string
  minioBucket: string
  concurrency: number
  scrollDelay: number
  maxScrolls: number
  maxDownloads: number
}

export interface ProfileInfo {
  username: string
  fullName: string
  avatarUrl?: string
  postsCount?: number
  followersCount?: number
}

export interface PendingDownload {
  shortcodes: string[]
  videoUrls: Record<string, string>
  niches: Niche[]
  profileUrl: string
  profile?: ProfileInfo
  platform: Platform
}

export interface ReelInfo {
  shortcode: string
  videoUrl: string
  thumbnailUrl?: string
}

export type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'

export interface DownloadTask {
  id: string
  shortcode: string
  videoUrl: string
  nicheId: string
  platform: Platform
  status: 'queued' | 'downloading' | 'uploading' | 'completed' | 'error'
  progress: number
  error?: string
  filename?: string
  createdAt: number
}

export interface Niche {
  id: string
  nome: string
  cor: string | null
}

export const DEFAULT_CONFIG: PostReelsConfig = {
  apiUrl: 'http://localhost:3000',
  minioEndpoint: 'http://localhost:9000',
  minioAccessKey: 'minioadmin',
  minioSecretKey: 'minioadmin',
  minioBucket: 'postreels-downloads',
  concurrency: 3,
  scrollDelay: 1500,
  maxScrolls: 50,
  maxDownloads: 20,
}
