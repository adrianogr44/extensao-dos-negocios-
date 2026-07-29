const btn = document.getElementById('btn')
const urlInput = document.getElementById('url')
const limitInput = document.getElementById('limit')
const statusEl = document.getElementById('status')
const progressBar = document.getElementById('progressBar')
const progressFill = document.getElementById('progressFill')

let currentTabId = null

function log(msg, type = 'info') {
  const d = document.createElement('div')
  d.className = `item ${type}`
  d.textContent = msg
  statusEl.appendChild(d)
  statusEl.scrollTop = statusEl.scrollHeight
}

function extractUsername(input) {
  const v = input.trim()
  if (!v) return ''
  try {
    const url = new URL(v.startsWith('http') ? v : 'https://' + v)
    const parts = url.pathname.replace(/\/$/, '').split('/')
    return parts.find(p => p && p !== 'reels' && p !== 'tagged') || parts[parts.length - 1] || ''
  } catch {
    return v.replace(/^@/, '')
  }
}

btn.addEventListener('click', async () => {
  const username = extractUsername(urlInput.value)
  if (!username) {
    log('Digite um link ou username valido', 'err')
    return
  }

  btn.disabled = true
  btn.textContent = '⏳ Processando...'
  statusEl.innerHTML = ''
  progressBar.style.display = 'block'

  const maxCount = parseInt(limitInput.value) || 0
  const profileUrl = `https://www.instagram.com/${username}/`

  // Find or create Instagram tab
  const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' })

  if (tabs.length > 0) {
    currentTabId = tabs[0].id
    await chrome.tabs.update(currentTabId, { url: profileUrl, active: true })
  } else {
    const tab = await chrome.tabs.create({ url: profileUrl, active: true })
    currentTabId = tab.id
  }

  // Wait for page to load then inject script
  await waitForLoad(currentTabId)
  await delay(3000)

  let result
  try {
    const progressListener = (msg) => {
      if (msg.source === 'fr_progress') {
        progressFill.style.width = msg.percent + '%'
        if (msg.text) log(msg.text, msg.type || 'info')
      }
    }
    chrome.runtime.onMessage.addListener(progressListener)

    result = await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: baixarReelsFromPage,
      args: [username, maxCount],
    })

    chrome.runtime.onMessage.removeListener(progressListener)
  } catch (err) {
    log('Erro ao executar: ' + err.message, 'err')
  }

  const finalResult = result?.[0]?.result
  if (finalResult?.success) {
    log(`✅ ${finalResult.success}`, 'ok')
  } else if (finalResult?.error) {
    log(`❌ ${finalResult.error}`, 'err')
  }

  btn.disabled = false
  btn.textContent = '🔽 Baixar Reels'
})

function waitForLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
    setTimeout(resolve, 20000)
  })
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ===== INJECTED FUNCTION =====
function baixarReelsFromPage(username, maxCount) {
  // Everything must be inside this function (executeScript serializes it)
  const BASE = 'https://www.instagram.com'

  function getCSRF() {
    const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
    return m ? m[1] : ''
  }

  function apiHeaders() {
    return {
      'X-IG-App-ID': '936619743392459',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRFToken': getCSRF(),
      'Referer': `${BASE}/${username}/`,
    }
  }

  function fetchWithTimeout(url, opts, ms = 15000) {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), ms)
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id))
  }

  function sendProgress(pct, text, type) {
    try { chrome.runtime.sendMessage({ source: 'fr_progress', percent: pct, text, type }) } catch {}
  }

  return (async () => {
    try {
      sendProgress(5, `🎬 Buscando reels de @${username}...`, 'ok')

      // Step 1: get user ID
      let userId = null
      try {
        const r = await fetchWithTimeout(`${BASE}/api/v1/users/web_profile_info/?username=${username}`, {
          credentials: 'include', headers: apiHeaders()
        })
        if (r.ok) {
          const d = await r.json()
          userId = d?.data?.user?.id
        }
      } catch {}

      if (!userId) {
        try {
          const html = await fetchWithTimeout(`${BASE}/${username}/`, { credentials: 'include' }).then(r => r.text())
          const m = html.match(new RegExp('"username":"' + username + '"[^}]*"pk":(\\d+)', 'i'))
            || html.match(new RegExp('"username":"' + username + '"[^}]*"id":"(\\d+)"', 'i'))
          if (m) userId = m[1]
        } catch {}
      }

      if (!userId) {
        sendProgress(100, '❌ Nao foi possivel obter o ID do usuario', 'err')
        return { error: 'Falha ao obter ID do usuario' }
      }

      sendProgress(10, `✅ User ID: ${userId}`, 'ok')

      // Step 2: fetch all reels via clips API
      const allUrls = []
      let cursor = null
      let pages = 0
      const hardCap = maxCount > 0 ? maxCount : 1000
      const maxPages = maxCount > 0 ? Math.ceil(maxCount / 50) + 2 : 30

      while (allUrls.length < hardCap && pages < maxPages) {
        pages++
        const body = new URLSearchParams({
          target_user_id: userId,
          include_feed_video: 'true',
          page_size: '50'
        })
        if (cursor) body.set('max_id', cursor)

        try {
          const resp = await fetchWithTimeout(`${BASE}/api/v1/clips/user/`, {
            method: 'POST',
            credentials: 'include',
            headers: { ...apiHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
          })

          if (!resp.ok) {
            const txt = await resp.text().catch(() => '')
            sendProgress(50, `API retornou ${resp.status}: ${txt.slice(0, 100)}`, 'err')
            break
          }

          const d = await resp.json()
          const items = d.items || []
          let found = 0

          for (const item of items) {
            let videoUrl = null
            if (item.video_versions?.length > 0) videoUrl = item.video_versions[0].url
            else if (item.media?.video_versions?.length > 0) videoUrl = item.media.video_versions[0].url
            else if (item.clip?.video_versions?.length > 0) videoUrl = item.clip.video_versions[0].url
            if (!videoUrl) {
              const str = JSON.stringify(item)
              const m = str.match(/https:[^"']+\.mp4[^"']*/)
              if (m) videoUrl = m[0].replace(/\\u0026/g, '&')
            }
            if (videoUrl) {
              allUrls.push(videoUrl)
              found++
            }
          }

          sendProgress(
            10 + Math.round((pages / maxPages) * 40),
            `Pagina ${pages}: +${found} videos (total ${allUrls.length})`,
            found > 0 ? 'ok' : 'info'
          )

          cursor = d.paging_info?.max_id
          if (!cursor || !items.length) break
        } catch (err) {
          sendProgress(50, `Erro na pagina ${pages}: ${err.message}`, 'err')
          break
        }
      }

      const unique = [...new Set(allUrls)]
      const finalUrls = maxCount > 0 ? unique.slice(0, maxCount) : unique

      if (finalUrls.length === 0) {
        sendProgress(100, '❌ Nenhum video encontrado', 'err')
        return { error: 'Nenhum video encontrado' }
      }

      sendProgress(50, `📦 ${finalUrls.length} videos. Iniciando downloads...`, 'ok')

      // Step 3: download each video
      let successCount = 0
      for (let i = 0; i < finalUrls.length; i++) {
        const filename = `reel_${username}_${i + 1}.mp4`
        try {
          chrome.runtime.sendMessage({ type: 'DOWNLOAD', url: finalUrls[i], filename })
          successCount++
          sendProgress(
            50 + Math.round(((i + 1) / finalUrls.length) * 45),
            `✓ [${i + 1}/${finalUrls.length}] ${filename}`,
            'ok'
          )
        } catch (err) {
          sendProgress(
            50 + Math.round(((i + 1) / finalUrls.length) * 45),
            `✗ [${i + 1}/${finalUrls.length}] Erro: ${err.message}`,
            'err'
          )
        }
      }

      sendProgress(100, `✅ ${successCount}/${finalUrls.length} videos baixados!`, 'ok')
      return { success: `${successCount}/${finalUrls.length} videos baixados em Downloads/FabricaReels/` }
    } catch (err) {
      sendProgress(100, `❌ Erro fatal: ${err.message}`, 'err')
      return { error: err.message }
    }
  })()
}

// Export for executeScript
window.baixarReelsFromPage = baixarReelsFromPage
