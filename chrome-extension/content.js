// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'BAIXAR_REELS') {
    baixarReels(message.username, message.maxCount)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }))
    return true  // Keep channel open for async
  }
})

async function baixarReels(username, maxCount) {
  const status = createStatusUI()
  status.log(`Iniciando download de reels de @${username}...`, 'ok')

  // Step 1: Get user ID from profile page data
  status.log('Buscando dados do perfil...', 'info')
  let userId = await extractUserId(username)

  if (!userId) {
    return { error: 'Nao foi possivel obter o ID do usuario' }
  }

  status.log(`User ID: ${userId}`, 'ok')

  // Step 2: Fetch all media
  status.log('Buscando midias...', 'info')
  const allItems = []
  let cursor = null

    try {
      while (allItems.length < 200) {
        let url = `https://www.instagram.com/api/v1/clips/user/`
        const body = new URLSearchParams({ target_user_id: userId })
        if (cursor) body.set('max_id', cursor)

        const resp = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString()
        })

        if (!resp.ok) {
          status.log(`API retornou ${resp.status}. Tentando metodo alternativo...`, 'err')
          break
        }

        const data = await resp.json()
        const items = data.items || []
        allItems.push(...items)
        cursor = data.paging_info?.max_id
        if (!cursor || items.length === 0) break
      }
    } catch (err) {
      status.log(`Erro na API: ${err.message}`, 'err')
      // Try alternative: extract from page
      try {
        const pageResp = await fetch(`https://www.instagram.com/${username}/`, {
          credentials: 'include'
        })
        const html = await pageResp.text()
        // Try to find media in preloaded JSON (video_versions)
        const versionMatches = html.matchAll(/"video_versions":\[({"url":"[^"]+".*?})\]/g)
        const urls = []
        for (const m of versionMatches) {
          try {
            const versions = JSON.parse(`[${m[1]}]`)
            const best = versions.sort((a, b) => (b.width || 0) - (a.width || 0))[0]
            if (best?.url) urls.push(best.url.replace(/\\u0026/g, '&'))
          } catch {}
        }
        // Also try DASH manifest URLs in page JSON
        if (urls.length === 0) {
          const dashMatches = html.match(/"video_dash_manifest":"([^"]+)"/g)
          for (const dm of dashMatches || []) {
            try {
              const xml = JSON.parse('"' + dm.match(/"video_dash_manifest":"([^"]+)"/)[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"') + '"')
              // Simple DASH parsing inline
              const urlMatch = xml.match(/<Representation[^>]*width="(\d+)"[^>]*>[\s\S]*?<BaseURL>([^<]+)<\/BaseURL>/)
              if (urlMatch) urls.push(urlMatch[2])
            } catch {}
          }
        }
        if (urls.length > 0) {
          status.log(`Encontrados ${urls.length} videos via scraping`, 'ok')
          const toDownload = maxCount > 0 ? urls.slice(0, maxCount) : urls
          await downloadAll(toDownload, username, 0, status)
          return { message: `${toDownload.length} videos baixados com sucesso!` }
        }
      } catch {}
      return { error: 'Nao foi possivel acessar o perfil' }
    }

  // Filter for reels/videos
  const reels = allItems.filter(item => item.media_type === 2 || item.media_type === 4)

  if (reels.length === 0) {
    return { error: 'Nenhum reel encontrado neste perfil.' }
  }

  let toDownload = reels
  if (maxCount > 0) toDownload = reels.slice(0, maxCount)

  status.log(`${toDownload.length} reels encontrados. Obtendo URLs dos videos...`, 'ok')

  // Helper: extract best quality from DASH manifest XML
  function extractBestFromDash(xml) {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')
      const representations = doc.querySelectorAll('Representation')
      let best = null
      for (const rep of representations) {
        const width = parseInt(rep.getAttribute('width')) || 0
        const height = parseInt(rep.getAttribute('height')) || 0
        const urlEl = rep.querySelector('BaseURL')
        if (urlEl && (!best || width > best.width)) {
          best = { url: urlEl.textContent.trim(), width, height }
        }
      }
      return best?.url || null
    } catch { return null }
  }

  // Step 3: Get video URLs and download
  const videoUrls = []

  for (let i = 0; i < toDownload.length; i++) {
    const reel = toDownload[i]
    let videoUrl = null

    // Method 1: Try DASH manifest first (highest quality source)
    if (reel.video_dash_manifest) {
      videoUrl = extractBestFromDash(reel.video_dash_manifest)
    }

    // Method 2: Pick the highest quality video version
    if (!videoUrl && reel.video_versions && reel.video_versions.length > 0) {
      const sorted = [...reel.video_versions].sort((a, b) => (b.width || 0) - (a.width || 0))
      videoUrl = sorted[0].url
    }

    // Method 3: Fetch individual post page for video URL (with DASH)
    if (!videoUrl) {
      status.log(`[${i + 1}/${toDownload.length}] Buscando URL do reel ${reel.code}...`, 'info')
      try {
        const infoResp = await fetch(
          `https://www.instagram.com/api/v1/media/${reel.id}/info/`,
          {
            credentials: 'include',
            headers: {
              'X-IG-App-ID': '936619743392459',
              'X-Requested-With': 'XMLHttpRequest',
            }
          }
        )
        if (infoResp.ok) {
          const infoData = await infoResp.json()
          const media = infoData.items?.[0]
          if (media?.video_dash_manifest) {
            videoUrl = extractBestFromDash(media.video_dash_manifest)
          }
          if (!videoUrl && media?.video_versions?.length > 0) {
            const sorted = [...media.video_versions].sort((a, b) => (b.width || 0) - (a.width || 0))
            videoUrl = sorted[0].url
          }
        }
      } catch {}
    }

    // Method 4: Navigate to post page and extract
    if (!videoUrl) {
      try {
        const postResp = await fetch(`https://www.instagram.com/p/${reel.code}/`, {
          credentials: 'include'
        })
        const postHtml = await postResp.text()
        const ogMatch = postHtml.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/)
        if (ogMatch) videoUrl = ogMatch[1]
      } catch {}
    }

    if (videoUrl) {
      videoUrls.push({ url: videoUrl, code: reel.code })
      status.log(`[${i + 1}/${toDownload.length}] ✓ URL obtida`, 'ok')
    } else {
      status.log(`[${i + 1}/${toDownload.length}] ✗ URL nao encontrada para ${reel.code}`, 'err')
    }
  }

  if (videoUrls.length === 0) {
    return { error: 'Nenhum video URL encontrado.' }
  }

  status.log(`Iniciando download de ${videoUrls.length} videos...`, 'ok')

  // Send to background script for download
  for (let i = 0; i < videoUrls.length; i++) {
    const { url, code } = videoUrls[i]
    const filename = `reel_${username}_${i + 1}.mp4`

    chrome.runtime.sendMessage({
      type: 'DOWNLOAD',
      url: url,
      filename: filename
    })

    status.log(`[${i + 1}/${videoUrls.length}] ✓ ${filename}`, 'ok')
  }

  status.log(`✅ Download concluido! ${videoUrls.length} videos baixados.`, 'ok')

  return { message: `${videoUrls.length} reels baixados de @${username}!` }
}

async function extractUserId(username) {
  // Method 1: Try API
  try {
    const resp = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        credentials: 'include',
        headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
        }
      }
    )
    if (resp.ok) {
      const data = await resp.json()
      if (data?.data?.user?.id) return data.data.user.id
    }
  } catch {}

  // Method 2: Scrape from page HTML
  try {
    const resp = await fetch(`https://www.instagram.com/${username}/`, {
      credentials: 'include'
    })
    const html = await resp.text()

    // Try to find user_id in embedded JSON
    const jsonBlocks = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)
    if (jsonBlocks) {
      for (const block of jsonBlocks) {
        try {
          const text = block.replace(/<script[^>]*type="application\/json"[^>]*>/, '').replace(/<\/script>/, '')
          const data = JSON.parse(text)
          const str = JSON.stringify(data)
          // Look for user_id near the username
          const re = new RegExp('"username":"' + username + '"[^}]*"id":"(\\d+)"', 'i')
          const m = str.match(re)
          if (m) return m[1]
        } catch {}
      }
    }

    // Method 3: Search in raw HTML
    const re = new RegExp('"username":"' + username + '"[^}]*"pk":(\\d+)', 'i')
    const m = html.match(re)
    if (m) return m[1]
  } catch {}

  return null
}

function downloadAll(urls, username, startIndex, status) {
  return Promise.all(urls.map((url, i) => {
    return new Promise((resolve) => {
      const filename = `reel_${username}_${startIndex + i + 1}.mp4`
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD',
        url: url,
        filename: filename
      }, resolve)
    })
  }))
}

function createStatusUI() {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:10px;right:10px;width:400px;max-height:400px;overflow-y:auto;background:#18181b;color:#f4f4f5;padding:12px;border-radius:8px;z-index:999999;font-family:system-ui;font-size:12px;box-shadow:0 4px 20px rgba(0,0,0,0.5);'

  const header = document.createElement('div')
  header.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#c084fc;font-size:14px;'
  header.textContent = '📦 Fabrica de Reels'
  container.appendChild(header)

  document.body.appendChild(container)

  return {
    log: (msg, type = 'info') => {
      const el = document.createElement('div')
      el.style.cssText = 'padding:2px 0;border-bottom:1px solid #27272a;'
      const colors = { info: '#a1a1aa', ok: '#4ade80', err: '#f87171' }
      el.style.color = colors[type] || colors.info
      el.textContent = msg
      container.appendChild(el)
      container.scrollTop = container.scrollHeight
    }
  }
}
