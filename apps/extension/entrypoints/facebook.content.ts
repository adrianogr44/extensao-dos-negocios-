import { defineContentScript } from 'wxt/utils/define-content-script'
import { extractReelsFromPage, extractProfileInfo, isReelsPage, isProfilePage } from '../src/lib/facebook'
import { DEFAULT_CONFIG } from '../src/lib/types'

export default defineContentScript({
  matches: ['https://www.facebook.com/*'],
  main() {
    let downloadButton: HTMLDivElement | null = null
    let isScanning = false

    function createButton() {
      if (downloadButton) return

      downloadButton = document.createElement('div')
      downloadButton.id = 'postreels-download-btn'
      downloadButton.textContent = 'Baixar Reels'
      Object.assign(downloadButton.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '999999',
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        fontFamily: 'system-ui, sans-serif',
      })
      downloadButton.addEventListener('mouseenter', () => {
        if (downloadButton) {
          downloadButton.style.transform = 'scale(1.05)'
          downloadButton.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)'
        }
      })
      downloadButton.addEventListener('mouseleave', () => {
        if (downloadButton) {
          downloadButton.style.transform = 'scale(1)'
          downloadButton.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'
        }
      })

      downloadButton.addEventListener('click', handleDownload)
      document.body.appendChild(downloadButton)
    }

    async function handleDownload() {
      if (isScanning) return
      isScanning = true
      if (downloadButton) downloadButton.textContent = 'Escaneando...'

      try {
        const storage = await chrome.storage.sync.get(DEFAULT_CONFIG)
        const config = { ...DEFAULT_CONFIG, ...storage }
        const reels = extractReelsFromPage()
        const shortcodes = reels.map(r => r.shortcode)
        const videoUrls: Record<string, string> = {}
        reels.forEach(r => { videoUrls[r.shortcode] = r.videoUrl })

        if (shortcodes.length === 0) {
          if (downloadButton) downloadButton.textContent = 'Nenhum Reel encontrado'
          setTimeout(() => { if (downloadButton) downloadButton.textContent = 'Baixar Reels' }, 2000)
          isScanning = false
          return
        }

        const profile = extractProfileInfo()

        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_REELS',
          payload: {
            shortcodes,
            videoUrls,
            profileUrl: window.location.href,
            niches: [],
            profile,
            platform: 'FACEBOOK',
          },
        })
      } catch (err) {
        console.error('[Facebook Content] Error:', err)
      } finally {
        isScanning = false
        if (downloadButton) downloadButton.textContent = 'Baixar Reels'
      }
    }

    function checkPage() {
      if (isReelsPage() || isProfilePage()) {
        createButton()
      } else {
        downloadButton?.remove()
        downloadButton = null
      }
    }

    checkPage()
    const observer = new MutationObserver(checkPage)
    observer.observe(document.body, { childList: true, subtree: true })
  },
})
