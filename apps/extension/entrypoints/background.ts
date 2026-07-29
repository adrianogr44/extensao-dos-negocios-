import { defineBackground } from 'wxt/utils/define-background'
import { DownloadManager } from '../src/lib/downloader'
import { DEFAULT_CONFIG, type DownloadTask, type Niche, type PendingDownload, type ProfileInfo } from '../src/lib/types'

let downloadManager: DownloadManager | null = null
let tasks: DownloadTask[] = []
let currentNiches: Niche[] = []
let pendingDownload: PendingDownload | null = null

async function getConfig() {
  const result = await chrome.storage.sync.get('postreelsConfig')
  return { ...DEFAULT_CONFIG, ...result.postreelsConfig }
}

function broadcastToPopup(message: any) {
  console.log('[Background] Enviando para popup:', message.type)
  chrome.runtime.sendMessage(message).catch(() => {
    console.log('[Background] Popup não está aberto')
  })
}

function broadcastTasks() {
  broadcastToPopup({ type: 'TASKS_UPDATED', payload: tasks })
}

async function startDownloads(shortcodes: string[], videoUrls: Record<string, string>, nicheId: string, profile?: ProfileInfo, platform: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' = 'INSTAGRAM', redownload: boolean = false) {
  const config = await getConfig()

  let filteredShortcodes = shortcodes
  if (!redownload) {
    try {
      const res = await fetch(`${config.apiUrl}/api/videos/check-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcodes, nicheId, platform }),
      })
      const data = await res.json()
      if (data.success && data.data?.existing?.length) {
        const existingSet = new Set<string>(data.data.existing)
        filteredShortcodes = shortcodes.filter(sc => !existingSet.has(sc))
        const skipped = shortcodes.length - filteredShortcodes.length
        if (skipped > 0) {
          console.log(`[Background] Pulando ${skipped} vídeos já existentes na base`)
        }
      }
    } catch (err) {
      console.error('[Background] Erro ao verificar vídeos existentes:', err)
    }
  }

  if (filteredShortcodes.length === 0) {
    console.log('[Background] Nenhum vídeo novo para baixar')
    broadcastTasks()
    return
  }

  const limit = config.maxDownloads || filteredShortcodes.length
  const toDownload = filteredShortcodes.slice(0, limit)

  const newTasks: DownloadTask[] = toDownload.map(sc => ({
    id: crypto.randomUUID(),
    shortcode: sc,
    videoUrl: videoUrls[sc] || `https://www.${platform.toLowerCase()}.com/${platform === 'YOUTUBE' ? 'shorts' : 'reel'}/${sc}/`,
    nicheId,
    platform,
    status: 'queued',
    progress: 0,
    createdAt: Date.now(),
  }))

  tasks.push(...newTasks)
  console.log('[Background] Tarefas criadas:', newTasks.length)
  broadcastTasks()

  downloadManager = new DownloadManager(config, (updatedTask) => {
    const idx = tasks.findIndex(t => t.id === updatedTask.id)
    if (idx !== -1) {
      tasks[idx] = { ...updatedTask }
      broadcastTasks()
    }
  })

  downloadManager.addTasks(newTasks, profile)
}

export default defineBackground(() => {
  console.log('[Background] Iniciado')

  chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    console.log('[Background] Mensagem:', message.type)

    switch (message.type) {
      case 'DOWNLOAD_REELS': {
        const { shortcodes, videoUrls, niches, profileUrl, profile, platform = 'INSTAGRAM' } = message.payload
        console.log('[Background] Recebido DOWNLOAD_REELS:', shortcodes.length, 'vídeos')
        currentNiches = niches || []
        pendingDownload = { shortcodes, videoUrls, niches: niches || [], profileUrl, profile, platform }

        chrome.action.setBadgeText({ text: String(shortcodes.length) })
        chrome.action.setBadgeBackgroundColor({ color: '#0095f6' })

        broadcastToPopup({
          type: 'PENDING_DOWNLOAD_UPDATED',
          payload: pendingDownload
        })

        sendResponse({ success: true })
        break
      }
      case 'START_DOWNLOAD': {
        const { shortcodes, videoUrls, nicheId, profile, platform = 'INSTAGRAM', redownload = false } = message.payload
        console.log('[Background] Iniciando download de', shortcodes.length, 'vídeos')
        pendingDownload = null
        chrome.action.setBadgeText({ text: '' })
        startDownloads(shortcodes, videoUrls, nicheId, profile, platform, redownload)
        sendResponse({ success: true })
        break
      }
      case 'GET_PENDING_DOWNLOAD': {
        console.log('[Background] GET_PENDING_DOWNLOAD -', !!pendingDownload ? 'tem' : 'vazio')
        sendResponse({ success: true, data: pendingDownload })
        break
      }
      case 'GET_TASKS': {
        console.log('[Background] GET_TASKS -', tasks.length, 'tarefas')
        sendResponse({ success: true, data: tasks })
        break
      }
      case 'CANCEL_TASK': {
        const { id } = message.payload
        downloadManager?.cancelTask(id)
        tasks = tasks.filter(t => t.id !== id)
        broadcastTasks()
        sendResponse({ success: true })
        break
      }
      case 'CANCEL_ALL': {
        downloadManager?.cancelAll()
        tasks = tasks.filter(t => t.status === 'completed' || t.status === 'error')
        broadcastTasks()
        sendResponse({ success: true })
        break
      }
      case 'CLEAR_COMPLETED': {
        tasks = tasks.filter(t => t.status === 'queued' || t.status === 'downloading')
        broadcastTasks()
        sendResponse({ success: true })
        break
      }
      case 'GET_NICHES': {
        if (!currentNiches || currentNiches.length === 0) {
          fetch('http://localhost:3000/api/nichos')
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                currentNiches = data.data
                sendResponse({ success: true, data: currentNiches })
              } else {
                sendResponse({ success: true, data: [] })
              }
            })
            .catch(err => {
              console.error('[Background] Erro ao carregar nichos:', err)
              sendResponse({ success: true, data: [] })
            })
          return true
        } else {
          sendResponse({ success: true, data: currentNiches })
        }
        break
      }
      case 'GET_CONFIG': {
        getConfig().then(config => sendResponse({ success: true, data: config }))
        return true
      }
      case 'SAVE_CONFIG': {
        getConfig().then(currentConfig => {
          const updatedConfig = { ...currentConfig, ...message.payload }
          console.log('[Background] Salvando config:', updatedConfig)
          chrome.storage.sync.set({ postreelsConfig: updatedConfig }, () => {
            sendResponse({ success: true, data: updatedConfig })
          })
        })
        return true
      }
      default:
        sendResponse({ success: false, error: 'Unknown type' })
    }
  })
})
