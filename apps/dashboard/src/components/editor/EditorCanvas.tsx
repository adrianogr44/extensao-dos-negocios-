'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface EditorCanvasProps {
  videoUrl: string | null
  overlayUrl: string | null
  config: {
    posX: number
    posY: number
    scale: number
    zoom: number
    overlayX: number
    overlayY: number
    overlayCropTop: number
    overlayCropBottom: number
    opacity: number
    cropTop: number
    cropBottom: number
    bgColor: string
    cropColor: string
    cropOpacity: number
    speed: number
    mirror: boolean
    texts: Array<{ content: string; x: number; y: number; fontSize: number; color: string }>
  }
  onChange: (config: Partial<EditorCanvasProps['config']>) => void
  selectedText: number | null
  onSelectText: (i: number | null) => void
}

const CANVAS_W = 360
const CANVAS_H = 640
const S = CANVAS_W / 1080
const HANDLE = 8

type DragMode = 'video' | 'overlay' | 'crop-top' | 'crop-bottom' | 'text'

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  img: HTMLImageElement | null,
  videoLoaded: boolean,
  overlayLoaded: boolean,
  config: EditorCanvasProps['config'],
  dragMode: DragMode | null,
  selectedText: number | null,
) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.fillStyle = config.bgColor
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // ── Video ──
  if (video && videoLoaded && video.videoWidth) {
    const vScale = config.scale * config.zoom
    const vw = video.videoWidth * vScale * S
    const vh = video.videoHeight * vScale * S
    let vx = (CANVAS_W - vw) / 2 + config.posX * S
    const vy = (CANVAS_H - vh) / 2 + config.posY * S

    if (config.mirror) {
      ctx.save()
      ctx.scale(-1, 1)
      ctx.drawImage(video, -vx - vw, vy, vw, vh)
      ctx.restore()
    } else {
      ctx.drawImage(video, vx, vy, vw, vh)
    }

    // Crop fill
    if (config.cropTop > 0 || config.cropBottom > 0) {
      ctx.save()
      if (config.cropTop > 0) {
        const topY = vy + config.cropTop * vScale * S
        ctx.fillStyle = config.cropColor; ctx.globalAlpha = config.cropOpacity
        ctx.fillRect(vx, vy, vw, topY - vy)
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
        ctx.beginPath(); ctx.moveTo(vx, topY); ctx.lineTo(vx + vw, topY); ctx.stroke(); ctx.setLineDash([])
      }
      if (config.cropBottom > 0) {
        const botY = vy + vh - config.cropBottom * vScale * S
        ctx.fillStyle = config.cropColor; ctx.globalAlpha = config.cropOpacity
        ctx.fillRect(vx, botY, vw, vy + vh - botY)
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
        ctx.beginPath(); ctx.moveTo(vx, botY); ctx.lineTo(vx + vw, botY); ctx.stroke(); ctx.setLineDash([])
      }
      ctx.restore()
    }
  }

  // ── Overlay ──
  if (img && overlayLoaded) {
    const nw = img.naturalWidth; const nh = img.naturalHeight
    const ct = config.overlayCropTop || 0; const cb = config.overlayCropBottom || 0
    const ch = Math.max(1, nh - ct - cb)
    const dw = nw * S; const dh = ch * S
    const ox = config.overlayX * S + (CANVAS_W - dw) / 2
    const oy = config.overlayY * S + (CANVAS_H - dh) / 2
    ctx.save(); ctx.globalAlpha = config.opacity
    ctx.drawImage(img, 0, ct, nw, ch, ox, oy, dw, dh)
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(168,85,247,0.6)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
    ctx.strokeRect(ox, oy, dw, dh); ctx.setLineDash([])
    const hc = (c: string) => { ctx.fillStyle = dragMode === c ? '#fbbf24' : '#a855f7'; ctx.fillRect(ox + dw / 2 - HANDLE / 2, (c === 'crop-top' ? oy : oy + dh) - HANDLE / 2, HANDLE, HANDLE); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(ox + dw / 2 - HANDLE / 2, (c === 'crop-top' ? oy : oy + dh) - HANDLE / 2, HANDLE, HANDLE) }
    if (ct > 0 || config.overlayCropTop === 0) hc('crop-top')
    if (cb > 0 || config.overlayCropBottom === 0) hc('crop-bottom')
    ctx.restore()
  }

  // ── Texts ──
  for (let i = 0; i < config.texts.length; i++) {
    const t = config.texts[i]
    if (!t.content) continue
    const fs = t.fontSize * S
    const lh = fs * 1.3
    ctx.font = `bold ${fs}px Roboto, sans-serif`
    ctx.textBaseline = 'top'
    const lines = t.content.split('\n')
    const tx = t.x * S
    const ty = t.y * S
    let maxW = 0
    for (let li = 0; li < lines.length; li++) {
      ctx.fillStyle = t.color
      ctx.fillText(lines[li], tx, ty + li * lh)
      const w = ctx.measureText(lines[li]).width
      if (w > maxW) maxW = w
    }

    // Selection highlight
    if (selectedText === i) {
      ctx.strokeStyle = '#a855f7'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.strokeRect(tx - 3, ty - 3, maxW + 6, lines.length * lh + 6)
      ctx.setLineDash([])
    }
  }
}

export function EditorCanvas({ videoUrl, overlayUrl, config, onChange, selectedText, onSelectText }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayImgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const [dragMode, setDragMode] = useState<DragMode | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [configStart, setConfigStart] = useState({
    posX: 0, posY: 0, overlayX: 0, overlayY: 0,
    overlayCropTop: 0, overlayCropBottom: 0,
  })
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [overlayLoaded, setOverlayLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  const configRef = useRef(config)
  configRef.current = config
  const videoLoadedRef = useRef(videoLoaded); videoLoadedRef.current = videoLoaded
  const overlayLoadedRef = useRef(overlayLoaded); overlayLoadedRef.current = overlayLoaded
  const playingRef = useRef(playing); playingRef.current = playing
  const dragModeRef = useRef(dragMode); dragModeRef.current = dragMode

  function getOverlayRect() {
    const img = overlayImgRef.current; if (!img) return null
    const nw = img.naturalWidth; const nh = img.naturalHeight
    const ct = configRef.current.overlayCropTop || 0; const cb = configRef.current.overlayCropBottom || 0
    const ch = Math.max(1, nh - ct - cb)
    const dw = nw * S; const dh = ch * S
    return { ox: configRef.current.overlayX * S + (CANVAS_W - dw) / 2, oy: configRef.current.overlayY * S + (CANVAS_H - dh) / 2, dw, dh, ct, cb }
  }

  const startDrag = useCallback((mode: DragMode, cx: number, cy: number, extra?: Record<string, number>) => {
    setDragMode(mode)
    setDragStart({ x: cx, y: cy })
    setConfigStart({
      posX: config.posX, posY: config.posY,
      overlayX: config.overlayX, overlayY: config.overlayY,
      overlayCropTop: config.overlayCropTop, overlayCropBottom: config.overlayCropBottom,
      ...extra,
    })
  }, [config])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top

    // Check text clicks (iterate in reverse — topmost first)
    for (let i = config.texts.length - 1; i >= 0; i--) {
      const t = config.texts[i]; if (!t.content) continue
      const lines = t.content.split('\n')
      const ctx2d = canvasRef.current.getContext('2d')
      if (!ctx2d) continue
      const fs = t.fontSize * S; const lh = fs * 1.3
      ctx2d.font = `bold ${fs}px Roboto, sans-serif`
      let maxW = 0
      for (const l of lines) { const w = ctx2d.measureText(l).width; if (w > maxW) maxW = w }
      const tx = t.x * S; const ty = t.y * S
      if (mx >= tx - 3 && mx <= tx + maxW + 3 && my >= ty - 3 && my <= ty + lines.length * lh + 3) {
        onSelectText(i)
        startDrag('text', e.clientX, e.clientY, { textIndex: i } as Record<string, number>)
        return
      }
    }

    // Check overlay crop handles
    const o = getOverlayRect()
    if (o) {
      if (my >= o.oy - 6 && my <= o.oy + 6 && mx >= o.ox + o.dw / 2 - 10 && mx <= o.ox + o.dw / 2 + 10) { startDrag('crop-top', e.clientX, e.clientY); return }
      if (my >= o.oy + o.dh - 6 && my <= o.oy + o.dh + 6 && mx >= o.ox + o.dw / 2 - 10 && mx <= o.ox + o.dw / 2 + 10) { startDrag('crop-bottom', e.clientX, e.clientY); return }
      if (mx >= o.ox && mx <= o.ox + o.dw && my >= o.oy && my <= o.oy + o.dh) { startDrag('overlay', e.clientX, e.clientY); return }
    }
    if (videoLoaded) startDrag('video', e.clientX, e.clientY)
  }, [config, videoLoaded, startDrag, getOverlayRect, onSelectText])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const mode = dragModeRef.current; if (!mode) return
    const dx = (e.clientX - dragStart.x) / S; const dy = (e.clientY - dragStart.y) / S

    if (mode === 'video') onChange({ posX: Math.round(configStart.posX + dx), posY: Math.round(configStart.posY + dy) })
    else if (mode === 'overlay') onChange({ overlayX: Math.round(configStart.overlayX + dx), overlayY: Math.round(configStart.overlayY + dy) })
    else if (mode === 'crop-top') {
      const img = overlayImgRef.current; if (!img) return
      const ov = Math.max(0, Math.round(configStart.overlayCropTop + dy / S))
      if (ov + configStart.overlayCropBottom < img.naturalHeight) onChange({ overlayCropTop: ov })
    } else if (mode === 'crop-bottom') {
      const img = overlayImgRef.current; if (!img) return
      const ob = Math.max(0, Math.round(configStart.overlayCropBottom - dy / S))
      if (configStart.overlayCropTop + ob < img.naturalHeight) onChange({ overlayCropBottom: ob })
    } else if (mode === 'text') {
      const sel = selectedText
      if (sel === null || sel < 0 || sel >= config.texts.length) return
      const t = [...config.texts]
      t[sel] = { ...t[sel], x: Math.round(t[sel].x + dx), y: Math.round(t[sel].y + dy) }
      onChange({ texts: t })
    }
  }, [dragStart, configStart, onChange, selectedText])

  const handleMouseUp = useCallback(() => setDragMode(null), [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return
    if (v.paused) { v.play().catch(() => {}); setPlaying(true) } else { v.pause(); setPlaying(false) }
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current; if (!v) return
    v.muted = !v.muted; setMuted(v.muted)
  }, [])

  useEffect(() => {
    const v = videoRef.current; if (!v) return
    const onEnded = () => setPlaying(false)
    const onPause = () => { if (!v.ended) setPlaying(false) }
    const onPlay = () => setPlaying(true)
    v.addEventListener('ended', onEnded); v.addEventListener('pause', onPause); v.addEventListener('play', onPlay)
    return () => { v.removeEventListener('ended', onEnded); v.removeEventListener('pause', onPause); v.removeEventListener('play', onPlay) }
  }, [])

  // Sync speed to video playbackRate
  useEffect(() => {
    const v = videoRef.current
    if (v) v.playbackRate = config.speed
  }, [config.speed])

  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    function loop() {
      drawFrame(ctx!, videoRef.current, overlayImgRef.current, videoLoadedRef.current, overlayLoadedRef.current, configRef.current, dragModeRef.current, selectedText)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [selectedText])

  return (
    <div ref={containerRef} className="relative mx-auto" style={{ width: CANVAS_W, height: CANVAS_H }}
      onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <video ref={videoRef} src={videoUrl || ''} className="hidden" onLoadedData={() => setVideoLoaded(true)} loop muted={muted} playsInline crossOrigin="anonymous" />
      <img ref={overlayImgRef} src={overlayUrl || ''} alt="" className="hidden" onLoad={() => setOverlayLoaded(true)} crossOrigin="anonymous" />
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="rounded-lg border border-zinc-800"
        onMouseDown={handleCanvasMouseDown} />

      <button className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors" onClick={togglePlay}>
        {!playing && <div className="rounded-full bg-black/60 p-4"><svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg></div>}
      </button>

      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 p-2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
        <button className="pointer-events-auto rounded p-1.5 hover:bg-white/20 transition-colors" onClick={togglePlay}>
          {playing
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>}
        </button>
        <button className="pointer-events-auto rounded p-1.5 hover:bg-white/20 transition-colors" onClick={toggleMute}>
          {muted
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>}
        </button>
      </div>

      {videoLoaded && (
        <button className="absolute top-2 left-2 rounded bg-blue-600/80 px-2 py-1 text-xs text-white hover:bg-blue-600 transition-colors"
          onMouseDown={e => { e.preventDefault(); startDrag('video', e.clientX, e.clientY) }}
          style={{ cursor: dragMode === 'video' ? 'grabbing' : 'grab' }}>
          Arrastar vídeo
        </button>
      )}
      {overlayLoaded && (
        <button className="absolute top-10 left-2 rounded bg-purple-600/80 px-2 py-1 text-xs text-white hover:bg-purple-600 transition-colors"
          onMouseDown={e => { e.preventDefault(); startDrag('overlay', e.clientX, e.clientY) }}
          style={{ cursor: dragMode === 'overlay' ? 'grabbing' : 'grab' }}>
          Arrastar overlay
        </button>
      )}
    </div>
  )
}
