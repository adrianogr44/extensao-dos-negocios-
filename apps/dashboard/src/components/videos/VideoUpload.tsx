'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface VideoUploadProps {
  nicheId: string
  profileId?: string | null
  platform?: string
  onUploaded?: () => void | Promise<void>
}

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv', '.mpeg', '.mpg', '.3gp',
])

function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  const name = file.name.toLowerCase()
  const dot = name.lastIndexOf('.')
  if (dot === -1) return false
  return VIDEO_EXTENSIONS.has(name.slice(dot))
}

export function VideoUpload({ nicheId, profileId, platform, onUploaded }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    setError('')

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('nicheId', nicheId)
      if (profileId) formData.append('profileId', profileId)
      if (platform) formData.append('platform', platform)

      try {
        const res = await fetch('/api/videos/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (!data.success) {
          setError(data.error || 'Erro ao enviar vídeo.')
        }
      } catch {
        setError('Erro ao enviar vídeo.')
      }
    }

    setUploading(false)
    if (onUploaded) await onUploaded()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    await uploadFiles(Array.from(files))
    e.target.value = ''
  }

  async function handleFolderUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const videos = Array.from(files).filter(isVideoFile)
    if (!videos.length) {
      setError('Nenhum vídeo encontrado na pasta selecionada.')
    }
    await uploadFiles(videos)
    e.target.value = ''
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button size="sm" variant="default" className="relative cursor-pointer">
        {uploading ? 'Enviando...' : '⇪ Upload vídeo'}
        <input
          type="file"
          accept="video/*"
          multiple
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleUpload}
          disabled={uploading}
        />
      </Button>
      <Button size="sm" variant="secondary" className="relative cursor-pointer" title="Envia automaticamente todos os vídeos da pasta">
        {uploading ? 'Enviando...' : '📁 Pasta'}
        <input
          type="file"
          accept="video/*,.videos"
          multiple
          {...({ webkitdirectory: '', directory: '' } as any)}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleFolderUpload}
          disabled={uploading}
        />
      </Button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}