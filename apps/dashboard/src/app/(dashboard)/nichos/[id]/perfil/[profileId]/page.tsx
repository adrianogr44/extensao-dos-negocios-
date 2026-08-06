'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { VideoGrid } from '@/components/videos/VideoGrid'

interface Overlay {
  id: string
  filename: string
  url: string
}

const platformMeta: Record<string, { label: string, color: string }> = {
  INSTAGRAM: { label: 'IG', color: '#e1306c' },
  FACEBOOK: { label: 'FB', color: '#1877f2' },
  YOUTUBE: { label: 'YT', color: '#ff4e50' },
}

interface Profile {
  id: string
  platform: string
  username: string
  fullName: string | null
  avatarUrl: string | null
  overlay: Overlay | null
  videos: Array<Record<string, unknown>>
  _count: { videos: number }
  nicheId: string
}

export default function ProfileVideosPage() {
  const params = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [allOverlays, setAllOverlays] = useState<Overlay[]>([])
  const [loading, setLoading] = useState(true)
  const [renderingAll, setRenderingAll] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)

  async function load() {
    const profileRes = await fetch(`/api/perfil/${params.profileId}`)
    const profileData = await profileRes.json()
    if (profileData.success) {
      setProfile(profileData.data)
      const overlayRes = await fetch(`/api/overlay/list?nicheId=${profileData.data.nicheId || ''}`)
      const overlayData = await overlayRes.json()
      if (overlayData.success) setAllOverlays(overlayData.data)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [params.profileId])

  async function renderAll() {
    if (!profile?.videos.length) return
    setRenderingAll(true)
    const videoIds = profile.videos.map((v: any) => v.id)
    const res = await fetch(`/api/editor/render/batch/profile/${params.profileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds }),
    })
    const data = await res.json()
    if (data.success) {
      router.push(`/editor/batch/${profile.nicheId}?profileId=${params.profileId}`)
    }
  }

  async function downloadAll() {
    const completed = (profile?.videos || []).filter((v: any) => v.renderJobs?.[0]?.outputKey)
    setDownloadingAll(true)
    for (const video of completed) {
      await new Promise(r => setTimeout(r, 300))
      window.open(`/api/videos/download/${video.id}`)
    }
    setDownloadingAll(false)
  }

  async function deleteProfile() {
    if (!confirm(`Remover perfil @${profile?.username} e todos os seus vídeos?`)) return
    const res = await fetch(`/api/perfil/${params.profileId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push(`/nichos/${params.id}`)
    }
  }

  async function setOverlay(overlayId: string | null) {
    await fetch(`/api/perfil/${params.profileId}/overlay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overlayId }),
    })
    load()
  }

  if (loading) return <div className="text-zinc-400">Carregando...</div>
  if (!profile) return <div className="text-zinc-400">Perfil não encontrado</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push(`/nichos/${params.id}`)}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Voltar para nicho
        </button>

        <Button variant="destructive" size="sm" onClick={deleteProfile}>
          Remover perfil
        </Button>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt=""
            className="h-12 w-12 rounded-full border border-zinc-700 object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-lg text-zinc-500">
            {profile.username[0]?.toUpperCase()}
          </div>
        )}
        <div className="text-sm">
          <p className="font-semibold text-zinc-200">{profile.fullName || profile.username}</p>
          <p className="text-zinc-500">@{profile.username}</p>
          <p className="mt-1 text-xs text-zinc-400">{profile._count.videos} vídeos</p>
        </div>
        <div className="ml-auto shrink-0">
          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: platformMeta[profile.platform]?.color || '#666' }}>
            {platformMeta[profile.platform]?.label || profile.platform?.slice(0, 2) || 'N/A'}
          </span>
        </div>
      </div>

      {/* Overlay selector */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <label className="block text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-2">
          Overlay padrão do perfil
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setOverlay(null)}
            className={`rounded border px-3 py-1.5 text-xs transition-colors ${
              !profile.overlay
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}>
            Nenhum
          </button>
          {allOverlays.map(ov => (
            <button key={ov.id} onClick={() => setOverlay(ov.id)}
              className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                profile.overlay?.id === ov.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}>
              {ov.filename}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={renderAll}
          disabled={renderingAll}
        >
          {renderingAll ? 'Renderizando...' : 'Renderizar todos'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={downloadAll}
          disabled={downloadingAll}
        >
          {downloadingAll ? 'Baixando...' : '⬇ Baixar todos'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push(`/editor/batch/${profile.nicheId}?profileId=${params.profileId}`)}
        >
          Renderizações
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { load(); router.refresh() }}
        >
          ↻ Atualizar
        </Button>
      </div>

      <VideoGrid videos={profile.videos as Array<{ id: string; filename: string; thumbnail: string | null; status: string; durationMs: number | null; minioBucket: string; minioKey: string }>} nicheId={profile.nicheId} />
    </div>
  )
}
