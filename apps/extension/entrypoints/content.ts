import { defineContentScript } from 'wxt/utils/define-content-script'
import { getAllReelLinks, extractReelsFromPage, extractProfileInfo, isReelsPage, isProfilePage } from '../src/lib/instagram'
import { DEFAULT_CONFIG } from '../src/lib/types'

export default defineContentScript({
  matches: ['https://www.instagram.com/*'],
  main() {
    let downloadButton: HTMLDivElement | null = null
    let isScanning = false

    function injectToolbar() {
      if (downloadButton) return
      if (!isReelsPage() && !isProfilePage()) return

      downloadButton = document.createElement('div')
      downloadButton.innerHTML = `
        <div style="
          position:fixed;bottom:24px;right:24px;z-index:99999;
          display:flex;flex-direction:column;gap:8px;
          font-family:sans-serif;
        ">
          <button id="pr-scan-btn" style="
            background:#0095f6;color:white;border:none;
            padding:12px 20px;border-radius:8px;
            font-size:14px;font-weight:600;cursor:pointer;
            box-shadow:0 4px 12px rgba(0,149,246,0.4);
            transition:transform 0.2s;
          ">📥 Baixar Reels</button>
          <div id="pr-status" style="
            background:#1a1a2e;color:#e0e0e0;border-radius:8px;
            padding:8px 12px;font-size:12px;display:none;
            max-width:280px;
          "></div>
        </div>
      `

      document.body.appendChild(downloadButton)
      document.getElementById('pr-scan-btn')?.addEventListener('click', startScan)
    }

    function collectReels(): { shortcodes: string[]; videoUrls: Record<string, string> } {
      const reels = extractReelsFromPage()
      const shortcodes: string[] = []
      const videoUrls: Record<string, string> = {}

      for (const reel of reels) {
        shortcodes.push(reel.shortcode)
        if (reel.videoUrl) {
          videoUrls[reel.shortcode] = reel.videoUrl
        }
      }

      return { shortcodes, videoUrls }
    }

    function mergeReels(
      existing: { shortcodes: Set<string>; videoUrls: Record<string, string> },
      incoming: { shortcodes: string[]; videoUrls: Record<string, string> },
    ) {
      for (const sc of incoming.shortcodes) {
        existing.shortcodes.add(sc)
        if (incoming.videoUrls[sc]) {
          existing.videoUrls[sc] = incoming.videoUrls[sc]
        }
      }
    }

    async function readConfig() {
      try {
        const result = await chrome.storage.sync.get('postreelsConfig')
        return { ...DEFAULT_CONFIG, ...result.postreelsConfig }
      } catch {
        return DEFAULT_CONFIG
      }
    }

    async function startScan() {
      if (isScanning) return
      isScanning = true

      const statusEl = document.getElementById('pr-status')
      if (!statusEl) return
      statusEl.style.display = 'block'
      statusEl.textContent = '🔍 Iniciando varredura...'

      const config = await readConfig()

      const shortcodes = new Set<string>()
      const videoUrls: Record<string, string> = {}

      mergeReels({ shortcodes, videoUrls }, collectReels())
      statusEl.textContent = `🔍 Encontrados ${shortcodes.size} vídeos... Rolando página`

      let scrollCount = 0
      const noNewLimit = 5

      while (shortcodes.size < config.maxDownloads && scrollCount < config.maxScrolls) {
        const before = shortcodes.size

        window.scrollBy(0, 1500)
        await new Promise(r => setTimeout(r, config.scrollDelay))

        mergeReels({ shortcodes, videoUrls }, collectReels())

        if (shortcodes.size === before) {
          if (++scrollCount >= noNewLimit) break
          continue
        }

        statusEl.textContent = `🔍 Encontrados ${shortcodes.size} vídeos... Rolando (${scrollCount + 1}/${config.maxScrolls})`
        scrollCount = 0 // reset no-new counter when we find new ones
      }

      statusEl.textContent = `✅ ${shortcodes.size} vídeos encontrados!`

      // Capture profile info
      const profile = extractProfileInfo()

      let niches: Array<{ id: string; nome: string }> = []

      try {
        const res = await fetch('http://localhost:3000/api/nichos', {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            niches = data.data
          }
        }
      } catch (err) {
        console.warn('[Content] Aviso ao carregar nichos (será recarregado no popup):', err)
      }

      chrome.runtime.sendMessage(
        {
          type: 'DOWNLOAD_REELS',
          payload: {
            shortcodes: Array.from(shortcodes),
            videoUrls,
            profileUrl: window.location.href,
            niches,
            profile,
            platform: 'INSTAGRAM',
          },
        },
        (response: any) => {
          console.log('[Content] Resposta do background:', response)
          if (response?.success) {
            statusEl.textContent = `✅ ${shortcodes.size} vídeos encontrados! Verifique o popup da extensão.`
          } else {
            statusEl.textContent = `❌ Erro ao enviar para download`
          }
        }
      )

      isScanning = false
    }

    function tryInject() {
      if (isReelsPage() || isProfilePage()) {
        injectToolbar()
      }
    }

    tryInject()

    const observer = new MutationObserver(() => {
      if (!downloadButton || !document.body.contains(downloadButton)) {
        downloadButton = null
        tryInject()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    let lastUrl = location.href
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        setTimeout(tryInject, 1000)
      }
    })
    urlObserver.observe(document.body, { childList: true, subtree: true })
  },
})
