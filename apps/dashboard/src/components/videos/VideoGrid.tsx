'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface RenderJob {
  id: string
  outputKey: string | null
  status: string
}

interface Video {
  id: string
  filename: string
  thumbnail: string | null
  status: string
  durationMs: number | null
  minioBucket: string
  minioKey: string
  renderJobs?: RenderJob[]
}

interface VideoGridProps {
  videos: Video[]
  nicheId: string
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'default' | 'destructive' | 'outline' | 'secondary' }> = {
  downloaded: { label: 'Baixado', variant: 'success' },
  processing: { label: 'Processando', variant: 'warning' },
  completed: { label: 'Pronto', variant: 'default' },
  error: { label: 'Erro', variant: 'destructive' },
}

export function VideoGrid({ videos, nicheId }: VideoGridProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [showEdited, setShowEdited] = useState(false)

  const hasAnyRender = videos.some(v => v.renderJobs?.[0]?.outputKey != null)

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selected.size === videos.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(videos.map(v => v.id)))
    }
  }, [videos, selected])

  const deleteVideo = useCallback(async (id: string) => {
    if (!confirm('Excluir este vídeo?')) return
    setDeleting(prev => new Set(prev).add(id))
    await fetch(`/api/videos/${id}`, { method: 'DELETE' })
    router.refresh()
  }, [router])

  const deleteSelected = useCallback(async () => {
    if (!confirm(`Excluir ${selected.size} vídeo(s)?`)) return
    setDeleting(new Set(selected))
    await Promise.all(Array.from(selected).map(id =>
      fetch(`/api/videos/${id}`, { method: 'DELETE' })
    ))
    setSelected(new Set())
    router.refresh()
  }, [selected, router])

  const deleteAll = useCallback(async () => {
    if (!confirm(`Excluir TODOS os ${videos.length} vídeos?`)) return
    setDeleting(new Set(videos.map(v => v.id)))
    await fetch(`/api/nichos/${nicheId}/videos`, { method: 'DELETE' })
    router.refresh()
  }, [videos, nicheId, router])

  if (!videos.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-800">
        <p className="text-sm text-zinc-500">Nenhum vídeo neste nicho ainda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={toggleSelectAll}
          className="rounded px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          {selected.size === videos.length ? 'Desmarcar todos' : `Selecionar todos (${videos.length})`}
        </button>
        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
          >
            Excluir selecionados ({selected.size})
          </button>
        )}
        <button
          onClick={deleteAll}
          className="rounded border border-red-800 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950 transition-colors"
        >
          Excluir todos
        </button>

        <div className="ml-auto" />

        {hasAnyRender && (
          <button
            onClick={() => setShowEdited(v => !v)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              showEdited
                ? 'bg-primary text-white'
                : 'border border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {showEdited ? 'Editado' : 'Original'}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {videos.map(video => {
          const status = statusConfig[video.status] || statusConfig.downloaded
          const isSelected = selected.has(video.id)
          const isDeleting = deleting.has(video.id)
          const lastRender = video.renderJobs?.[0]
          const hasRender = lastRender?.outputKey != null
          const isEdited = showEdited && hasRender

          return (
            <div key={video.id} className={`relative group ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}>
              <Link href={`/editor/${video.id}`}>
                <Card className={`overflow-hidden transition-colors hover:border-zinc-700 ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
                  <div className="relative aspect-[9/16] bg-zinc-800">
                    {isEdited ? (
                      <video
                        src={`/api/videos/stream/postreels-renders/${lastRender!.outputKey}`}
                        className="h-full w-full object-cover"
                        autoPlay muted loop playsInline
                      />
                    ) : video.thumbnail ? (
                      <img
                        src={`/api/videos/stream/${video.minioBucket}/${video.thumbnail}`}
                        alt={video.filename}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-600">
                        Sem preview
                      </div>
                    )}

                    {hasRender && (
                      <div className={`absolute bottom-1 right-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isEdited
                          ? 'bg-primary text-white'
                          : 'bg-black/60 text-zinc-300'
                      }`}>
                        {isEdited ? 'Editado' : 'Original'}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium">{video.filename}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    {video.durationMs && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {Math.floor(video.durationMs / 1000 / 60)}:{(video.durationMs / 1000 % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>

              <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.preventDefault(); toggleSelect(video.id) }}
                  className={`rounded p-1.5 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-black/60 text-white hover:bg-black/80'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    {isSelected
                      ? <polyline points="20 6 9 17 4 12" />
                      : <rect x="3" y="3" width="18" height="18" rx="3" />
                    }
                  </svg>
                </button>
              </div>

              {hasRender && (
                <button
                  onClick={e => { e.preventDefault(); window.open(`/api/videos/download/${video.id}`) }}
                  className="absolute top-9 right-2 rounded bg-emerald-600/80 p-1.5 text-white opacity-0 group-hover:opacity-100 hover:bg-emerald-600 transition-opacity"
                  title="Baixar vídeo editado"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              )}
              <button
                onClick={e => { e.preventDefault(); deleteVideo(video.id) }}
                className="absolute top-2 right-2 rounded bg-red-600/80 p-1.5 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
