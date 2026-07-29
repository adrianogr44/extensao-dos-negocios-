'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface Profile {
  id: string
  platform: string
  username: string
  fullName: string | null
  avatarUrl: string | null
  _count: { videos: number }
}

const platformMeta: Record<string, { label: string, color: string }> = {
  INSTAGRAM: { label: 'IG', color: '#e1306c' },
  FACEBOOK: { label: 'FB', color: '#1877f2' },
  YOUTUBE: { label: 'YT', color: '#ff4e50' },
}

interface Niche {
  id: string
  nome: string
  cor: string | null
  _count: { videos: number }
  createdAt: string
  profiles: Profile[]
}

export default function NichosPage() {
  const router = useRouter()
  const [nichos, setNichos] = useState<Niche[]>([])
  const [newNome, setNewNome] = useState('')
  const [newCor, setNewCor] = useState('#0ea5e9')
  const [loading, setLoading] = useState(true)

  async function loadNichos() {
    const res = await fetch('/api/nichos')
    const data = await res.json()
    if (data.success) setNichos(data.data)
    setLoading(false)
  }

  useEffect(() => { loadNichos() }, [])

  async function createNiche() {
    if (!newNome.trim()) return
    const res = await fetch('/api/nichos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: newNome.trim(), cor: newCor }),
    })
    if (res.ok) {
      setNewNome('')
      loadNichos()
    }
  }

  async function deleteNiche(id: string) {
    await fetch(`/api/nichos/${id}`, { method: 'DELETE' })
    loadNichos()
  }

  if (loading) return <div className="text-zinc-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nichos</h1>
        <p className="text-sm text-zinc-400">Pastas para organizar seus vídeos</p>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Nome do nicho"
          value={newNome}
          onChange={e => setNewNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createNiche()}
        />
        <input
          type="color"
          value={newCor}
          onChange={e => setNewCor(e.target.value)}
          className="h-9 w-10 rounded-md border border-zinc-800 bg-zinc-950"
        />
        <Button onClick={createNiche}>Criar Nicho</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {nichos.map(niche => (
          <Card
            key={niche.id}
            className="cursor-pointer transition-colors hover:border-zinc-700"
            onClick={() => router.push(`/nichos/${niche.id}`)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: niche.cor || '#0ea5e9' }} />
                  <CardTitle>{niche.nome}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500 hover:text-red-400"
                  onClick={e => { e.stopPropagation(); deleteNiche(niche.id) }}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400">{niche._count.videos} vídeos</p>
              {niche.profiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {niche.profiles.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs text-zinc-500">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[9px] text-zinc-500">
                          {p.username[0]?.toUpperCase()}
                        </div>
                      )}
                      <span>@{p.username}</span>
                      <span className="rounded-sm px-1 py-0 text-[8px] font-bold text-white" style={{ backgroundColor: platformMeta[p.platform]?.color || '#666' }}>
                        {platformMeta[p.platform]?.label || p.platform.slice(0, 2)}
                      </span>
                    </div>
                  ))}
                  {niche.profiles.length > 3 && (
                    <span className="text-xs text-zinc-600">+{niche.profiles.length - 3}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
