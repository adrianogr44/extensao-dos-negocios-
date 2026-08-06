'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'

interface NicheOverlay {
  id: string
  filename: string
  url: string
  isDefault: boolean
  nicheId: string | null
}

interface NicheOverlayManagerProps {
  nicheId: string
}

export function NicheOverlayManager({ nicheId }: NicheOverlayManagerProps) {
  const [overlays, setOverlays] = useState<NicheOverlay[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/overlay/list?nicheId=${nicheId}`)
    const data = await res.json()
    if (data.success) setOverlays(data.data)
    setLoaded(true)
  }, [nicheId])

  useEffect(() => { load() }, [load])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage('')
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('nicheId', nicheId)

    try {
      const res = await fetch('/api/overlay/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setMessage(`Overlay "${file.name}" enviada!`)
        await load()
      } else {
        setError(data.error || 'Erro ao enviar overlay.')
      }
    } catch {
      setError('Erro ao enviar overlay.')
    }
    setUploading(false)
    e.target.value = ''
  }

  async function setDefault(id: string) {
    setError('')
    const res = await fetch(`/api/overlay/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    })
    const data = await res.json()
    if (data.success) {
      setMessage('Overlay padrão atualizada.')
      await load()
    } else {
      setError(data.error || 'Erro ao definir padrão.')
    }
  }

  async function remove(id: string, filename: string) {
    if (!confirm(`Remover overlay "${filename}"?`)) return
    setError('')
    const res = await fetch(`/api/overlay/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessage('Overlay removida.')
      await load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Erro ao remover overlay.')
    }
  }

  const nicheOverlays = overlays.filter(o => o.nicheId === nicheId)
  const globalOverlays = overlays.filter(o => o.nicheId === null)

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Overlays do nicho</h3>
          <p className="text-xs text-zinc-500">
            Faça upload de overlays específicas deste nicho. Defina uma como padrão.
          </p>
        </div>
        <label className="cursor-pointer rounded bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
          {uploading ? 'Enviando...' : '+ Upload overlay'}
          <input type="file" accept="image/png,image/webp" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {!loaded && <p className="mt-3 text-sm text-zinc-500 italic">Carregando...</p>}

      {loaded && nicheOverlays.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500 italic">
          Nenhuma overlay para este nicho ainda.
        </p>
      )}

      {nicheOverlays.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {nicheOverlays.map(ov => (
            <div key={ov.id} className="group relative overflow-hidden rounded-lg border border-zinc-800">
              <div className="relative flex h-40 items-center justify-center bg-zinc-950">
                <img src={ov.url} alt={ov.filename} className="max-h-full max-w-full object-contain" />
                {ov.isDefault && (
                  <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Padrão
                  </span>
                )}
              </div>
              <div className="border-t border-zinc-800 p-2">
                <p className="truncate text-xs text-zinc-300" title={ov.filename}>{ov.filename}</p>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant={ov.isDefault ? 'secondary' : 'outline'}
                    className="flex-1 px-1 py-0.5 text-[11px]" onClick={() => setDefault(ov.id)}>
                    {ov.isDefault ? 'Padrão ✓' : 'Definir padrão'}
                  </Button>
                  <Button size="sm" variant="ghost" className="px-1 py-0.5 text-[11px] text-red-400 hover:text-red-300"
                    onClick={() => remove(ov.id, ov.filename)}>
                    ✕
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {globalOverlays.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-2">Overlays globais</p>
          <div className="flex flex-wrap gap-2">
            {globalOverlays.map(ov => (
              <div key={ov.id} className="relative h-16 w-16 overflow-hidden rounded border border-zinc-800">
                <img src={ov.url} alt={ov.filename} className="h-full w-full object-cover" title={ov.filename} />
                {ov.isDefault && (
                  <span className="absolute bottom-0 right-0 rounded-tl bg-blue-600/90 px-1 text-[9px] font-bold text-white">padrão</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}