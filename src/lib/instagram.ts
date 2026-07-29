import { InstagramConfig } from './types'

export async function postToInstagram(
  config: InstagramConfig,
  videoPath: string,
  caption: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://graph.instagram.com/v22.0/me/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoPath,
        caption,
        access_token: config.password,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Erro ao postar' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function publishMedia(creationId: string, accessToken: string) {
  const response = await fetch(
    `https://graph.instagram.com/v22.0/${creationId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    }
  )
  return response.json()
}
