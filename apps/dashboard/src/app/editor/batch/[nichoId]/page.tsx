'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Video {
  id: string
  filename: string
  status: string
  thumbnail: string | null
}

export default function BatchEditorPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const profileId = searchParams.get('profileId')
  const [videos, setVideos] = useState<Video[]>([])
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/videos?nicheId=${params.nichoId}`)
      const data = await res.json()
      if (data.success) {
        setVideos(data.data)
        if (data.data.length > 0) setSelectedVideo(data.data[0].id)
      }
      setLoading(false)
    }
    load()
  }, [params.nichoId])

  async function replicateToAll() {
    if (!selectedVideo) return
    // Get current video's edit config
    const configRes = await fetch(`/api/videos/${selectedVideo}/edit-config`)
    const configData = await configRes.json()
    if (!configData.success || !configData.data) {
      alert('Salve uma configuração primeiro')
      return
    }

    // Replicate to all
    await fetch(`/api/editor/replicate/${params.nichoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData.data),
    })

    alert('Configuração replicada para todos os vídeos!')
  }

  if (loading) return <div className="p-8 text-zinc-400">Carregando...</div>

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(
            profileId ? `/nichos/${params.nichoId}/perfil/${profileId}` : `/nichos/${params.nichoId}`
          )}>
            ← Voltar
          </Button>
          <h1 className="text-lg font-bold">Edição em Lote</h1>
          <span className="text-sm text-zinc-400">({videos.length} vídeos)</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={replicateToAll}>
            Replicar edição para todos
          </Button>
          <Button onClick={async () => {
            await fetch(`/api/editor/render/batch/${params.nichoId}`, { method: 'POST' })
            alert('Renderização em lote iniciada!')
          }}>
            Renderizar todos
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Video list sidebar */}
        <div className="w-64 overflow-y-auto border-r border-zinc-800 bg-zinc-950">
          {videos.map(video => (
            <button
              key={video.id}
              onClick={() => setSelectedVideo(video.id)}
              className={`w-full border-b border-zinc-800 p-3 text-left text-sm transition-colors hover:bg-zinc-900 ${
                selectedVideo === video.id ? 'bg-zinc-800' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{video.filename}</span>
                <Badge variant={
                  video.status === 'completed' ? 'default'
                  : video.status === 'error' ? 'destructive'
                  : 'warning'
                }>
                  {video.status}
                </Badge>
              </div>
            </button>
          ))}
        </div>

        {/* Editor content */}
        <div className="flex flex-1 items-center justify-center">
          {selectedVideo ? (
            <div className="text-center">
              <p className="mb-4 text-zinc-400">
                Editando: <span className="font-medium text-zinc-200">
                  {videos.find(v => v.id === selectedVideo)?.filename}
                </span>
              </p>
              <Button onClick={() => router.push(`/editor/${selectedVideo}`)}>
                Abrir editor completo
              </Button>
            </div>
          ) : (
            <p className="text-zinc-500">Nenhum vídeo neste nicho</p>
          )}
        </div>
      </div>
    </div>
  )
}
