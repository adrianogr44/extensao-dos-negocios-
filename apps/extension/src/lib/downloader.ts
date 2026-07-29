import type { DownloadTask, PostReelsConfig, ProfileInfo } from './types'

type TaskCallback = (task: DownloadTask) => void

export class DownloadManager {
  private queue: DownloadTask[] = []
  private active = new Map<string, AbortController>()
  private config: PostReelsConfig
  private onUpdate: TaskCallback
  private running = 0
  private profile: ProfileInfo | null = null

  constructor(config: PostReelsConfig, onUpdate: TaskCallback) {
    this.config = config
    this.onUpdate = onUpdate
  }

  addTasks(tasks: DownloadTask[], profile?: ProfileInfo) {
    if (profile) this.profile = profile
    this.queue.push(...tasks)
    this.processQueue()
  }

  private async processQueue() {
    while (this.running < this.config.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) break
      this.running++
      this.downloadTask(task).finally(() => {
        this.running--
        this.processQueue()
      })
    }
  }

  private async downloadTask(task: DownloadTask) {
    const controller = new AbortController()
    this.active.set(task.id, controller)

    try {
      console.log('[Downloader] Iniciando download:', task.shortcode)
      task.status = 'downloading'
      this.onUpdate(task)

      const platform = task.platform || 'INSTAGRAM'
      const url = `${this.config.apiUrl}/api/videos/download`
      console.log('[Downloader] Chamando endpoint:', url)

      const body: Record<string, unknown> = {
        shortcode: task.shortcode,
        nicheId: task.nicheId,
        platform,
      }
      if (this.profile) body.profile = this.profile

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      console.log('[Downloader] Resposta recebida:', response.status, response.statusText)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log('[Downloader] Download concluído:', task.shortcode)
      task.filename = data.data.filename
      task.status = 'completed'
      task.progress = 100
      this.onUpdate(task)
    } catch (err) {
      const errMsg = (err as Error).message
      console.error('[Downloader] Erro:', errMsg)
      if ((err as Error).name === 'AbortError') return
      task.status = 'error'
      task.error = errMsg
      this.onUpdate(task)
    } finally {
      this.active.delete(task.id)
    }
  }


  cancelTask(id: string) {
    const controller = this.active.get(id)
    if (controller) {
      controller.abort()
      this.active.delete(id)
    }
    this.queue = this.queue.filter(t => t.id !== id)
  }

  cancelAll() {
    this.active.forEach(c => c.abort())
    this.active.clear()
    this.queue = []
  }
}
