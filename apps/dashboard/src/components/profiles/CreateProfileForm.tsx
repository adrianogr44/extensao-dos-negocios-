'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

interface CreateProfileFormProps {
  nicheId: string
}

export function CreateProfileForm({ nicheId }: CreateProfileFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [platform, setPlatform] = useState('INSTAGRAM')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/nichos/${nicheId}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, fullName, avatarUrl, platform }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao criar perfil.')
        return
      }
      setUsername('')
      setFullName('')
      setAvatarUrl('')
      setOpen(false)
      router.refresh()
    } catch {
      setError('Erro ao criar perfil.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        + Criar perfil manual
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Plataforma
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
          Username (@...)
        </label>
        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="ex: meuperfil" required />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Nome de exibição (opcional)
        </label>
        <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ex: Meu Perfil" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          URL da foto (opcional)
        </label>
        <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Criando...' : 'Criar perfil'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}