'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import { ControlsPanel } from '@/components/editor/ControlsPanel'
import { OverlaySelector, type OverlayOption } from '@/components/editor/OverlaySelector'
import { Button } from '@/components/ui/button'

interface EditConfig {
  posX: number
  posY: number
  scale: number
  zoom: number
  volume: number
  rotation: number
  overlayX: number
  overlayY: number
  overlayCropTop: number
  overlayCropBottom: number
  opacity: number
  overlayBehind: boolean
  cropTop: number
  cropBottom: number
  bgColor: string
  cropColor: string
  cropOpacity: number
  speed: number
  mirror: boolean
  eqEnabled: boolean
  eqBrightness: number
  eqContrast: number
  eqSaturation: number
  grain: boolean
  grainAmount: number
  frameDrop: boolean
  zoomBreathing: boolean
  zoomBreathAmount: number
  texts: Array<{ content: string; x: number; y: number; fontSize: number; color: string }>
}

interface Profile {
  id: string
}

interface Video {
  id: string
  filename: string
  minioKey: string
  minioBucket: string
  thumbnail: string | null
  status: string
  niche: { id: string; nome: string }
  profileId: string | null
  caption: string | null
  generatedCaption: string | null
}

const defaultConfig: EditConfig = {
  posX: 0, posY: 0, scale: 1, zoom: 1, volume: 1, rotation: 0,
  overlayX: 0, overlayY: 0, overlayCropTop: 0, overlayCropBottom: 0, opacity: 1, overlayBehind: false,
  cropTop: 0, cropBottom: 0, bgColor: '#000000', cropColor: '#000000', cropOpacity: 1,
  speed: 1, mirror: false,
  eqEnabled: false, eqBrightness: 1, eqContrast: 1, eqSaturation: 1,
  grain: false, grainAmount: 0,
  frameDrop: false,
  zoomBreathing: false, zoomBreathAmount: 0,
  texts: [],
}

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const [video, setVideo] = useState<Video | null>(null)
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
  const [overlays, setOverlays] = useState<OverlayOption[]>([])
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [config, setConfig] = useState<EditConfig>(defaultConfig)
  const [saving, setSaving] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedText, setSelectedText] = useState<number | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [replicatingCaptions, setReplicatingCaptions] = useState(false)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)
  const [renderOutputKey, setRenderOutputKey] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const videoRes = await fetch(`/api/videos/${params.videoId}`)
      const videoData = await videoRes.json()

      if (videoData.success) {
        setVideo(videoData.data)
        setVideoUrl(`/api/videos/stream/${videoData.data.minioBucket}/${videoData.data.minioKey}`)
        setProfileId(videoData.data.profileId || null)

        if (videoData.data.editConfigs) {
          const ec = videoData.data.editConfigs
          setConfig({
            posX: ec.posX || 0, posY: ec.posY || 0,
            scale: ec.scale || 1, zoom: ec.zoom || 1,
            volume: ec.volume || 1, rotation: ec.rotation || 0,
            overlayX: ec.overlayX || 0, overlayY: ec.overlayY || 0,
            overlayCropTop: ec.overlayCropTop || 0, overlayCropBottom: ec.overlayCropBottom || 0,
            opacity: ec.opacity || 1,
            overlayBehind: ec.overlayBehind ?? false,
            cropTop: ec.cropTop || 0, cropBottom: ec.cropBottom || 0,
            bgColor: ec.bgColor || '#000000',
            cropColor: ec.cropColor || '#000000',
            cropOpacity: ec.cropOpacity ?? 1,
            speed: ec.speed ?? 1,
            mirror: ec.mirror ?? false,
            eqEnabled: ec.eqEnabled ?? false,
            eqBrightness: ec.eqBrightness ?? 1,
            eqContrast: ec.eqContrast ?? 1,
            eqSaturation: ec.eqSaturation ?? 1,
            grain: ec.grain ?? false,
            grainAmount: ec.grainAmount ?? 0,
            frameDrop: ec.frameDrop ?? false,
            zoomBreathing: ec.zoomBreathing ?? false,
            zoomBreathAmount: ec.zoomBreathAmount ?? 0,
            texts: ec.texts || [],
          })
          if (ec.overlayId) setSelectedOverlayId(ec.overlayId)
        }

        // Load overlays do nicho do vídeo (nicho + globais)
        const overlayRes = await fetch(`/api/overlay/list?nicheId=${videoData.data.niche?.id || ''}`)
        const overlayData = await overlayRes.json()
        const overlayList: OverlayOption[] = overlayData.success ? overlayData.data : []
        setOverlays(overlayList)

        // Resolve overlay inicial: editor > perfil > padrão do nicho > global
        let chosen: OverlayOption | null = null
        const ec = videoData.data.editConfigs
        if (ec?.overlayId) {
          chosen = overlayList.find(o => o.id === ec.overlayId) || null
        }
        if (!chosen && videoData.data.profileId) {
          const profileRes = await fetch(`/api/perfil/${videoData.data.profileId}`)
          const profileData = await profileRes.json()
          const po = profileData.success ? profileData.data?.overlay : null
          if (po) {
            const poUrl = `/api/videos/stream/postreels-overlays/${po.minioKey}`
            chosen = { id: po.id, filename: po.filename, url: poUrl, isDefault: po.isDefault, nicheId: po.nicheId }
            if (!overlayList.some(o => o.id === po.id)) {
              setOverlays(prev => [...prev, chosen!])
            }
          }
        }
        if (!chosen) {
          chosen = overlayList.find(o => o.isDefault && o.nicheId === videoData.data.niche?.id) || null
        }
        if (!chosen) {
          chosen = overlayList.filter(o => o.nicheId === null).sort((a, b) => ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1))[0] || null
        }
        setOverlayUrl(chosen?.url || '')
        if (selectedOverlayId === null && chosen) setSelectedOverlayId(chosen.id)
      }

      setLoading(false)
    }
    load()
  }, [params.videoId])

  const handleConfigChange = useCallback((key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleCanvasChange = useCallback((partial: Partial<EditConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }))
  }, [])

  const [saveError, setSaveError] = useState<string | null>(null)

  function handleSelectOverlay(id: string | null) {
    setSelectedOverlayId(id)
    const ov = overlays.find(o => o.id === id)
    setOverlayUrl(ov ? ov.url : '')
  }

  async function saveConfig(replicate = false) {
    setSaving(true)
    setSaveError(null)
    const url = replicate
      ? (profileId
          ? `/api/editor/replicate/perfil/${profileId}`
          : `/api/editor/replicate/${video?.niche.id}`)
      : `/api/videos/${params.videoId}/edit-config`

    const body = { ...config, overlayId: selectedOverlayId }

    const res = await fetch(url, {
      method: replicate ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
      setSaveError(err.error?.message || err.error || `Erro ${res.status}`)
    }
    setSaving(false)
  }

  async function replicateCaptions() {
    setReplicatingCaptions(true)
    setSaveError(null)
    const url = profileId
      ? `/api/editor/caption/batch/profile/${profileId}`
      : `/api/editor/caption/batch/niche/${video?.niche.id}`
    const res = await fetch(url, { method: 'POST' })
    const data = await res.json()
    if (!data.success) {
      setSaveError(data.error || 'Erro ao replicar legendas')
    } else {
      alert(`Legendas geradas: ${data.data.processed} vídeos (${data.data.errors} erros)`)
    }
    setReplicatingCaptions(false)
  }

  async function generateCaption() {
    setGenerating(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/editor/caption/${params.videoId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Refresh video data to show new caption
        const videoRes = await fetch(`/api/videos/${params.videoId}`)
        const videoData = await videoRes.json()
        if (videoData.success) {
          setVideo(videoData.data)
          if (videoData.data.editConfigs?.texts) {
            setConfig(prev => ({ ...prev, texts: videoData.data.editConfigs.texts }))
          }
        }
      } else {
        setSaveError(data.error || 'Erro ao gerar legenda')
      }
    } catch {
      setSaveError('Erro ao gerar legenda')
    }
    setGenerating(false)
  }

  async function renderVideo() {
    setRendering(true)
    setRenderStatus('queued')
    setRenderOutputKey(null)
    const res = await fetch(`/api/editor/render/${params.videoId}`, { method: 'POST' })
    const data = await res.json()
    if (!data.success) {
      setRenderStatus('error')
      setRendering(false)
      return
    }
    // Poll render status
    const poll = setInterval(async () => {
      const statusRes = await fetch(`/api/debug/render-status/${params.videoId}`)
      const statusData = await statusRes.json()
      if (statusData.success && statusData.data.length > 0) {
        const latest = statusData.data[0]
        setRenderStatus(latest.status)
        if (latest.status === 'completed') {
          setRenderOutputKey(latest.outputKey)
          setRendering(false)
          clearInterval(poll)
        } else if (latest.status === 'error') {
          setRendering(false)
          clearInterval(poll)
        }
      }
    }, 2000)
  }

  if (loading) return <div className="flex items-center justify-center p-12 text-zinc-400">Carregando...</div>
  if (!video) return <div className="p-12 text-zinc-400">Vídeo não encontrado</div>

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(
            video.profileId ? `/nichos/${video.niche.id}/perfil/${video.profileId}` : `/nichos/${video.niche.id}`
          )}>
            ← Voltar
          </Button>
          <h1 className="text-lg font-bold">{video.filename}</h1>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{video.niche.nome}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 items-center justify-center bg-zinc-950">
          <EditorCanvas
            videoUrl={videoUrl}
            overlayUrl={overlayUrl}
            config={config}
            onChange={handleCanvasChange}
            selectedText={selectedText}
            onSelectText={setSelectedText}
          />
        </div>

        <div className="w-80 overflow-y-auto border-l border-zinc-800 p-6">
          <div className="mb-4">
            <h4 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Overlay do vídeo
            </h4>
            <OverlaySelector
              overlays={overlays}
              selectedOverlayId={selectedOverlayId}
              onSelect={handleSelectOverlay}
            />
          </div>

          <ControlsPanel
            config={config}
            onChange={handleConfigChange}
            onSave={() => saveConfig(false)}
            onReplicate={() => saveConfig(true)}
            onReplicateCaptions={replicateCaptions}
            onRender={renderVideo}
            saving={saving}
            rendering={rendering}
            selectedText={selectedText}
            onSelectText={setSelectedText}
          />

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Legenda</h4>
              <Button variant="secondary" size="sm" onClick={generateCaption} disabled={generating}>
                {generating ? 'Gerando...' : 'Gerar Legenda'}
              </Button>
            </div>
            {video.caption && (
              <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2">
                <p className="text-[10px] text-zinc-600 mb-1">Do vídeo (OCR):</p>
                <p className="text-xs text-zinc-400 line-clamp-4">{video.caption}</p>
              </div>
            )}
            {video.generatedCaption && (
              <div className="rounded border border-purple-900/50 bg-purple-950/20 p-2">
                <p className="text-[10px] text-purple-400 mb-1">Gerada por IA:</p>
                <p className="text-xs text-zinc-300 line-clamp-4">{video.generatedCaption}</p>
              </div>
            )}
          </div>

          {renderStatus && (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-2">
                Renderização
              </p>
              {renderStatus === 'queued' && (
                <p className="text-xs text-yellow-400">⏳ Na fila...</p>
              )}
              {renderStatus === 'processing' && (
                <p className="text-xs text-blue-400">🔄 Renderizando...</p>
              )}
              {renderStatus === 'completed' && renderOutputKey && (
                <div className="space-y-2">
                  <p className="text-xs text-emerald-400">✅ Concluído!</p>
                  <a
                    href={`/api/videos/download/${params.videoId}`}
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    ⬇ Baixar vídeo
                  </a>
                </div>
              )}
              {renderStatus === 'error' && (
                <p className="text-xs text-red-400">❌ Erro na renderização</p>
              )}
            </div>
          )}

          {saveError && (
            <p className="px-6 pb-2 text-xs text-red-400">{saveError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
