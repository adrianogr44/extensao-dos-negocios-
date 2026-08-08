'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

interface Niche {
  id: string
  nome: string
}

interface ProfileOption {
  id: string
  username: string
  platform: string
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

export default function UploadToEditorPage() {
  const router = useRouter()
  const [niches, setNiches] = useState<Niche[]>([])
  const [nicheId, setNicheId] = useState('')
  const [newNicheName, setNewNicheName] = useState('')
  const [newNicheColor, setNewNicheColor] = useState('#0ea5e9')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [platform, setPlatform] = useState('INSTAGRAM')
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [profileId, setProfileId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadNiches = useCallback(async () => {
    const res = await fetch('/api/nichos')
    const data = await res.json()
    const list: Niche[] = data.success ? data.data : []
    setNiches(list)
    if (!nicheId && list.length > 0) setNicheId(list[0].id)
  }, [nicheId])

  useEffect(() => { loadNiches() }, [])

  useEffect(() => {
    if (!nicheId) {
      setProfiles([])
      setProfileId('')
      return
    }
    let active = true
    fetch(`/api/nichos/${nicheId}/profiles`)
      .then(r => r.json())
      .then(data => {
        if (!active) return
        const list: ProfileOption[] = Array.isArray(data) ? data : []
        setProfiles(list)
        if (profileId && !list.some(p => p.id === profileId)) setProfileId('')
      })
      .catch(() => { if (active) setProfiles([]) })
    return () => { active = false }
  }, [nicheId, platform])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return

    let target = nicheId
    if (!target) {
      if (!newNicheName.trim()) {
        setError('Selecione um nicho ou digite o nome de um novo.')
        return
      }
      const res = await fetch('/api/nichos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: newNicheName.trim(), cor: newNicheColor }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message || 'Erro ao criar nicho.')
        return
      }
      target = data.data.id
      setNicheId(target)
    }

    const videos = Array.from(files).filter(isVideoFile)
    if (!videos.length) {
      setError('Nenhum arquivo de vídeo nos selecionados.')
      return
    }
    setUploading(true)
    setError('')
    setProgress(`Enviando 0/${videos.length}...`)

    const uploadedIds: string[] = []
    for (let i = 0; i < videos.length; i++) {
      setProgress(`Enviando ${i + 1}/${videos.length}: ${videos[i].name}`)
      const formData = new FormData()
      formData.append('file', videos[i])
      formData.append('nicheId', target)
      formData.append('platform', platform)
      if (profileId) formData.append('profileId', profileId)
      try {
        const res = await fetch('/api/videos/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) uploadedIds.push(data.data.id)
        else setError(data.error || `Erro ao enviar ${videos[i].name}`)
      } catch {
        setError(`Erro ao enviar ${videos[i].name}`)
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (uploadedIds.length) {
      router.push(`/editor/${uploadedIds[0]}`)
    } else {
      setError('Nenhum vídeo foi enviado.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enviar vídeo para o editor</h1>
        <p className="text-sm text-zinc-400">
          Escolha um nicho (ou crie um novo), selecione os vídeos e você será levado direto para o
          editor de overlay e legendas. Nenhum perfil é necessário.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Plataforma dos vídeos
          </label>
          <Select
            value={platform}
            onChange={e => setPlatform(e.target.value)}
            options={[
              { value: 'INSTAGRAM', label: 'Instagram' },
              { value: 'FACEBOOK', label: 'Facebook' },
              { value: 'YOUTUBE', label: 'YouTube' },
            ]}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Perfil (opcional — para o vídeo aparecer no perfil)
          </label>
          <Select
            value={profileId}
            onChange={e => setProfileId(e.target.value)}
            options={[
              { value: '', label: '— Sem perfil —' },
              ...profiles
                .filter(p => !platform || p.platform === platform)
                .map(p => ({ value: p.id, label: `@${p.username}` })),
            ]}
          />
          {profiles.length === 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              Nenhum perfil neste nicho — o vídeo ficará sem perfil.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Nicho
          </label>
          <Select
            value={nicheId}
            onChange={e => setNicheId(e.target.value)}
            options={niches.map(n => ({ value: n.id, label: n.nome }))}
          />
          {niches.length === 0 && (
            <p className="mt-1 text-xs text-zinc-500">Nenhum nicho ainda — crie um abaixo.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            OU criar novo nicho
          </label>
          <div className="flex gap-2">
            <Input value={newNicheName} onChange={e => setNewNicheName(e.target.value)}
              placeholder="Nome do novo nicho" />
            <div className="flex items-center gap-2 shrink-0">
              <label className="block w-8 h-8 cursor-pointer overflow-hidden rounded border border-zinc-700"
                style={{ backgroundColor: newNicheColor }}
                title="Cor do nicho">
                <input type="color" value={newNicheColor}
                  onChange={e => setNewNicheColor(e.target.value)}
                  className="opacity-0 w-8 h-8 cursor-pointer" />
              </label>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {progress && !uploading && <p className="text-xs text-zinc-400">{progress}</p>}

        <Button size="default" className="relative w-full cursor-pointer" disabled={uploading}>
          {uploading ? `📤 ${progress || 'Enviando...'}` : '📁 Selecionar pasta / vídeos'}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            {...({ webkitdirectory: '', directory: '' } as any)}
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={handleUpload}
            disabled={uploading}
          />
        </Button>
      </div>
    </div>
  )
}