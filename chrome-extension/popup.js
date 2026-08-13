const btn = document.getElementById('btn')
const urlInput = document.getElementById('url')
const limitInput = document.getElementById('limit')
const platformSelect = document.getElementById('platform')
const limitWrap = document.getElementById('limitWrap')
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

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function waitForLoad(tabId, timeoutMs = 25000) {
  return new Promise(async (resolve) => {
    const check = async () => {
      try {
        const tab = await chrome.tabs.get(tabId)
        if (tab.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener)
          clearTimeout(timer)
          resolve()
          return true
        }
      } catch {}
      return false
    }
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        clearTimeout(timer)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
    const timer = setTimeout(resolve, timeoutMs)
    await check()
  })
}

function openOrReuseTab(url) {
  return new Promise(async (resolve) => {
    const tabs = await chrome.tabs.query({ url })
    if (tabs.length > 0) {
      currentTabId = tabs[0].id
      await chrome.tabs.update(currentTabId, { url, active: true })
      resolve(currentTabId)
    } else {
      const tab = await chrome.tabs.create({ url, active: true })
      currentTabId = tab.id
      resolve(tab.id)
    }
  })
}

function detectPlatform(input) {
  const v = input.trim()
  if (!v) return platformSelect.value
  try {
    const h = new URL(v.startsWith('http') ? v : 'https://' + v).hostname.replace(/^www\./, '')
    if (h.includes('instagram.com')) return 'instagram'
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube'
    if (h.includes('tiktok.com')) return 'tiktok'
  } catch {}
  return platformSelect.value
}

function platformPlaceholder(p) {
  if (p === 'youtube') return 'https://www.youtube.com/shorts/ABcdEfGhIjk'
  if (p === 'tiktok') return 'https://www.tiktok.com/@usuario/video/1234567890'
  return 'https://www.instagram.com/perfil/'
}

function updateUI() {
  const p = platformSelect.value
  limitWrap.style.display = p === 'instagram' ? 'block' : 'none'
  urlInput.placeholder = platformPlaceholder(p)
  if (p === 'instagram') btn.textContent = '🔽 Baixar Reels'
  if (p === 'youtube') btn.textContent = '🔽 Baixar Shorts'
  if (p === 'tiktok') btn.textContent = '🔽 Baixar Vídeo'
}

urlInput.addEventListener('input', () => {
  const detected = detectPlatform(urlInput.value)
  if (detected !== platformSelect.value) {
    platformSelect.value = detected
    updateUI()
  }
})

platformSelect.addEventListener('change', updateUI)
updateUI()

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

function youtubeVideoId(input) {
  const v = input.trim()
  try {
    const url = new URL(v.startsWith('http') ? v : 'https://' + v)
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1).split('/')[0] || null
    if (url.pathname.includes('/shorts/')) {
      const m = url.pathname.match(/\/shorts\/([A-Za-z0-9_-]{6,})/)
      if (m) return m[1]
    }
    if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null
    if (url.pathname.startsWith('/watch')) return url.searchParams.get('v')
  } catch {}
  return null
}

function youtubePageUrl(videoId, isShorts) {
  return isShorts
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`
}

function tiktokVideoInfo(input) {
  const v = input.trim()
  const m = v.match(/https?:\/\/(www\.)?tiktok\.com\/@([^/]+)\/video\/(\d+)/)
  return m ? { handle: m[2], itemId: m[3], url: `https://www.tiktok.com/@${m[2]}/video/${m[3]}` } : null
}

function setupProgress() {
  statusEl.innerHTML = ''
  progressBar.style.display = 'block'
  progressFill.style.width = '0%'
  const listener = (msg) => {
    if (msg.source === 'fr_progress') {
      progressFill.style.width = msg.percent + '%'
      if (msg.text) log(msg.text, msg.type || 'info')
    }
  }
  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}

function sendDownload(url, filename, referer) {
  return new Promise((resolve) => {
    const msg = { type: 'DOWNLOAD', url, filename }
    if (referer) msg.headers = [{ header: 'Referer', value: referer }]
    chrome.runtime.sendMessage(msg, (resp) => resolve(resp || {}))
  })
}

async function extractInTab(tabId, fn, maxWaitMs) {
  let result
  try {
    result = await chrome.scripting.executeScript({
      target: { tabId },
      func: fn,
      args: [maxWaitMs],
    })
  } catch (err) {
    log('Erro ao executar script: ' + err.message, 'err')
    return null
  }
  return result?.[0]?.result || null
}

async function baixarVideoUnico(platform, pageUrl) {
  btn.disabled = true
  const cleanup = setupProgress()

  const tabId = await openOrReuseTab(pageUrl)
  await waitForLoad(tabId)
  await delay(1200)

  const extractor = platform === 'youtube' ? extrairYouTubeDaPagina : extrairTikTokDaPagina
  let data = await extractInTab(tabId, extractor, 15000)

  if (!data?.url && platform === 'youtube') {
    const videoId = youtubeVideoId(pageUrl)
    if (videoId) {
      log('Tentando pagina do embed do YouTube...', 'info')
      const embed = `https://www.youtube.com/embed/${videoId}?autoplay=1`
      const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' })
      if (tabs.length > 0) currentTabId = tabs[0].id
      await chrome.tabs.update(currentTabId, { url: embed, active: true })
      await waitForLoad(currentTabId)
      await delay(2500)
      data = await extractInTab(currentTabId, extractor, 15000)
    }
  }

  if (data?.url) {
    const resp = await sendDownload(data.url, data.filename, data.referer)
    if (resp.success) log(`✅ Download iniciado: ${data.filename}`, 'ok')
    else log(`❌ Falha no download: ${resp.error || 'erro desconhecido'}`, 'err')
  } else if (data?.error) {
    log('❌ ' + data.error, 'err')
  } else {
    log('❌ Nao foi possivel extrair a URL do video', 'err')
  }

  cleanup()
  progressFill.style.width = '100%'
  btn.disabled = false
  btn.textContent = platform === 'youtube' ? '🔽 Baixar Shorts' : '🔽 Baixar Vídeo'
}

btn.addEventListener('click', async () => {
  const input = urlInput.value.trim()
  const detected = detectPlatform(input)
  const platform = detected !== platformSelect.value ? detected : platformSelect.value

  if (platform === 'instagram') {
    await baixarReelsInstagram()
    return
  }

  if (platform === 'youtube') {
    const videoId = youtubeVideoId(input)
    if (!videoId) {
      log('❌ Informe um link valido de Shorts ou video do YouTube (ex: youtube.com/shorts/ID)', 'err')
      return
    }
    const isShorts = input.includes('shorts')
    await baixarVideoUnico('youtube', youtubePageUrl(videoId, isShorts))
    return
  }

  const info = tiktokVideoInfo(input)
  if (!info) {
    log('❌ Informe um link valido de video do TikTok (@usuario/video/ID)', 'err')
    return
  }
  await baixarVideoUnico('tiktok', info.url)
})

async function baixarReelsInstagram() {
  const username = extractUsername(urlInput.value)
  if (!username) {
    log('Digite um link ou username valido', 'err')
    return
  }

  btn.disabled = true
  const progressListener = (msg) => {
    if (msg.source === 'fr_progress') {
      progressFill.style.width = msg.percent + '%'
      if (msg.text) log(msg.text, msg.type || 'info')
    }
  }
  chrome.runtime.onMessage.addListener(progressListener)

  const maxCount = parseInt(limitInput.value) || 0
  const profileUrl = `https://www.instagram.com/${username}/`

  const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' })
  if (tabs.length > 0) {
    currentTabId = tabs[0].id
    await chrome.tabs.update(currentTabId, { url: profileUrl, active: true })
  } else {
    const tab = await chrome.tabs.create({ url: profileUrl, active: true })
    currentTabId = tab.id
  }

  statusEl.innerHTML = ''
  progressBar.style.display = 'block'
  btn.textContent = '⏳ Processando...'

  await waitForLoad(currentTabId)
  await delay(3000)

  let result
  try {
    result = await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: baixarReelsFromPage,
      args: [username, maxCount],
    })
  } catch (err) {
    log('Erro ao executar: ' + err.message, 'err')
  }

  chrome.runtime.onMessage.removeListener(progressListener)

  const finalResult = result?.[0]?.result
  if (finalResult?.success) {
    log('✅ ' + finalResult.success, 'ok')
  } else if (finalResult?.error) {
    log('❌ ' + finalResult.error, 'err')
  }

  progressFill.style.width = '100%'
  btn.disabled = false
  btn.textContent = '🔽 Baixar Reels'
}

/* ================================================================
   FUNCOES INJETADAS NA PAGINA (executeScript serializa tudo)
   ================================================================ */

function extrairYouTubeDaPagina(maxWait) {
  function sendProgress(pct, text, type) {
    try { chrome.runtime.sendMessage({ source: 'fr_progress', percent: pct, text, type }) } catch {}
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  function sanitizeFileName(s) {
    return (s || 'video').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
  }

  function scoreUrl(u) {
    const m = u.match(/itag=(\d+)/)
    const itag = m ? parseInt(m[1], 10) : 0
    const hasMp4 = /mime=video(?:%2f|\/)mp4/i.test(u)
    const order = {
      18: 1000, 22: 1500, 59: 1600, 134: 1100, 135: 1200, 136: 1300, 137: 1400, 138: 1500,
      160: 1010, 242: 1210, 243: 1310, 244: 1410, 247: 1510, 248: 1610, 271: 1800, 272: 1900, 313: 2000
    }
    return (order[itag] || 0) + (hasMp4 ? 100 : 0)
  }

  function collectUrls() {
    const urls = []
    try {
      for (const e of performance.getEntriesByType('resource')) {
        const n = e.name
        if (!n.includes('googlevideo.com')) continue
        if (!/videoplayback|initplayback/.test(n)) continue
        if (/[?&]range=/i.test(n)) continue
        urls.push(n)
      }
    } catch {}
    try {
      const pr = window.ytInitialPlayerResponse
      const list = [...(pr?.streamingData?.formats || []), ...(pr?.streamingData?.adaptiveFormats || [])]
      for (const f of list) {
        if (f?.url && f.url.includes('googlevideo.com') && !/[?&]range=/i.test(f.url)) urls.push(f.url)
      }
    } catch {}
    const v = document.querySelector('video')
    if (v) {
      for (const s of [v.currentSrc, v.src]) {
        if (s && !s.startsWith('blob:') && s.includes('googlevideo.com')) urls.push(s)
      }
    }
    return urls
  }

  return (async () => {
    sendProgress(20, '🎬 Aguardando o video carregar...', 'info')
    const title = (document.title || '').replace(/\s*-\s*YouTube\s*$/i, '').trim() || 'shorts'
    const deadline = Date.now() + maxWait
    let best = null

    while (Date.now() < deadline) {
      const urls = collectUrls()
      if (urls.length) {
        best = urls.sort((a, b) => scoreUrl(b) - scoreUrl(a))[0]
        if (scoreUrl(best) > 0) break
      }
      await sleep(400)
    }

    if (!best) {
      sendProgress(100, '❌ URL do video nao encontrada', 'err')
      return { error: 'URL do video nao encontrada. Abra o Shorts, aguarde carregar e tente novamente.' }
    }

    sendProgress(70, '✅ URL obtida. Iniciando download...', 'ok')
    const filename = 'shorts_' + sanitizeFileName(title).slice(0, 60) + '.mp4'
    return { url: best, filename, referer: 'https://www.youtube.com/' }
  })().catch(err => ({ error: err.message }))
}

function extrairTikTokDaPagina(maxWait) {
  function sendProgress(pct, text, type) {
    try { chrome.runtime.sendMessage({ source: 'fr_progress', percent: pct, text, type }) } catch {}
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  function pickUrl(p) {
    return p && typeof p === 'object' && Array.isArray(p.urlList) ? p.urlList[0] : (typeof p === 'string' ? p : '')
  }

  function fromGlobalData() {
    try {
      const U = window.__UNIVERSAL_DATA_FOR_REHYDRATION__
      const item = U?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct
      if (item?.video) {
        const v = item.video
        return {
          play: pickUrl(v.playAddr),
          download: (typeof v.downloadAddr === 'string' && v.downloadAddr && v.downloadAddr !== '#') ? v.downloadAddr : '',
          desc: String(item.desc || '')
        }
      }
    } catch {}
    try {
      const S = window.SIGI_STATE
      for (const k in S?.ItemModule || {}) {
        const v = S.ItemModule[k]
        if (v?.video) {
          return {
            play: pickUrl(v.video.playAddr),
            download: (typeof v.video.downloadAddr === 'string' && v.video.downloadAddr && v.video.downloadAddr !== '#') ? v.video.downloadAddr : '',
            desc: String(v.desc || '')
          }
        }
      }
    } catch {}
    return null
  }

  function fromVideoElement() {
    try {
      const v = document.querySelector('video')
      if (!v) return ''
      for (const s of [v.currentSrc, v.src]) {
        if (s && !s.startsWith('blob:') && /tiktokcdn|bytecdn|ttwstatic|tiktokv/.test(s)) return s
      }
    } catch {}
    return ''
  }

  async function fromApiItem() {
    try {
      const m = location.pathname.match(/\/video\/(\d+)/)
      if (!m) return null
      const r = await fetch(
        `https://www.tiktok.com/api/item/detail/?itemId=${m[1]}&aid=1988&app_language=en&language=en&verifyFp=verify_undefined`,
        { credentials: 'include', headers: { 'Referer': location.href } }
      )
      if (!r.ok) return null
      const d = await r.json()
      const item = d?.itemInfo?.itemStruct
      if (!item?.video) return null
      const v = item.video
      return {
        play: pickUrl(v.playAddr),
        download: (typeof v.downloadAddr === 'string' && v.downloadAddr && v.downloadAddr !== '#') ? v.downloadAddr : '',
        desc: String(item.desc || '')
      }
    } catch {}
    return null
  }

  return (async () => {
    sendProgress(20, '🎬 Lendo dados do video do TikTok...', 'info')
    const deadline = Date.now() + maxWait
    let data = fromGlobalData()

    while (!data && Date.now() < deadline) {
      data = fromGlobalData()
      if (!data) await sleep(400)
    }

    if (!data) data = await fromApiItem()

    let url = (data && (data.download || data.play)) || ''
    const comMarcaDagua = !data?.download && !!data?.play
    if (!url) url = fromVideoElement()

    if (!url) {
      sendProgress(100, '❌ URL do video nao encontrada', 'err')
      return { error: 'Nao foi possivel obter a URL do video. Abra o video pelo TikTok e tente novamente.' }
    }

    sendProgress(70, comMarcaDagua ? 'ℹ️ Video com marca d agua (o criador desativou download sem marca). Baixando...' : '✅ URL obtida. Iniciando download...', comMarcaDagua ? 'info' : 'ok')
    const desc = (data?.desc || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'tiktok'
    const filename = 'tiktok_' + desc.slice(0, 60) + '.mp4'
    return { url, filename, referer: 'https://www.tiktok.com/' }
  })().catch(err => ({ error: err.message }))
}

// ===== INJECTED FUNCTION (Instagram) =====
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
      'X-ASBD-Id': '129477',
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

      let userId = null
      let problema = ''

      // Metodo 1: API web_profile_info (requer login)
      let apiBody = ''
      try {
        const r = await fetchWithTimeout(`${BASE}/api/v1/users/web_profile_info/?username=${username}`, {
          credentials: 'include', headers: apiHeaders()
        })
        apiBody = await r.text().catch(() => '')
        if (!r.ok) {
          problema = `API respondeu ${r.status}${apiBody ? ': ' + apiBody.replace(/"/g, "'").slice(0, 160) : ''}`
        } else {
          try {
            const d = JSON.parse(apiBody)
            const msg = d && (d.message || '')
            if (msg) problema = `Instagram: ${msg.slice(0, 80)}`
            userId = d?.data?.user?.id
          } catch {
            problema = 'API retornou resposta invalida'
          }
        }
      } catch (err) {
        problema = `Erro de rede na API: ${err.message}`
      }

      // Metodo 2: JSON do perfil (?__a=1)
      if (!userId) {
        try {
          const r = await fetchWithTimeout(`${BASE}/${username}/?__a=1&__d=dis`, {
            credentials: 'include', headers: apiHeaders()
          })
          if (r.ok) {
            const d = await r.json()
            userId = d?.graphql?.user?.id || d?.data?.user?.id || d?.user?.id
            if (!userId) problema = 'Perfil nao retornou dados (?__a=1)'
          } else {
            problema = `${BASE}/${username}/ respondeu ${r.status}`
          }
        } catch {}
      }

      // Metodo 3: procurar o ID no HTML da pagina (a pagina logada SEMPRE tem o id no JSON embutido)
      if (!userId) {
        try {
          const pageUrl = `${BASE}/${username}/`
          const r = await fetchWithTimeout(pageUrl, { credentials: 'include' })
          const html = await r.text()
          const blocks = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g) || []
          const hay = blocks.join('\n') + '\n' + html
          const idx = hay.indexOf(`"username":"${username}"`)
          if (idx !== -1) {
            const before = hay.slice(Math.max(0, idx - 3000), idx)
            const ids = [...before.matchAll(/"id":"(\d+)"/g)]
            if (ids.length) userId = ids[ids.length - 1][1]
          } else {
            problema = 'A pagina do perfil nao contem dados do usuario (perfil privado, inexistente ou pagina de login)'
          }
        } catch (err) {
          problema = `Erro ao ler a pagina do perfil: ${err.message}`
        }
      }

      // Metodo 4: busca interna do Instagram
      if (!userId) {
        try {
          const r = await fetchWithTimeout(`${BASE}/web/search/topsearch/?query=${username}&count=5`, {
            credentials: 'include', headers: apiHeaders()
          })
          if (r.ok) {
            const d = await r.json()
            for (const u of d?.users || []) {
              if ((u?.user?.username || '').toLowerCase() === username.toLowerCase()) {
                userId = u?.user?.pk || u?.user?.id
                break
              }
            }
            if (!userId) problema = 'Perfil nao encontrado nem na busca do Instagram'
          } else {
            problema = `Busca respondeu ${r.status}`
          }
        } catch {}
      }

      if (!userId) {
        const hint = problema || 'Nao foi possivel obter o ID do usuario.'
        sendProgress(100, `❌ Nao foi possivel obter o ID do usuario — ${hint}`, 'err')
        return { error: `Falha ao obter o ID do usuario. ${hint}` }
      }

      sendProgress(10, `✅ User ID: ${userId}`, 'ok')

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