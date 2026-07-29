'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function SettingsPage() {
  const [uploading, setUploading] = useState(false)
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function handleOverlayUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/overlay/upload', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()

    if (data.success) {
      setOverlayUrl(data.data.url)
      setMessage('Overlay enviada com sucesso!')
    } else {
      setMessage('Erro ao enviar overlay.')
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-zinc-400">Gerenciar overlay e configurações do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overlay Principal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-400">
            Faça upload da sua overlay (PNG com transparência) que será aplicada sobre os vídeos.
          </p>

          <input
            type="file"
            accept="image/png,image/webp"
            onChange={handleOverlayUpload}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary"
          />

          {uploading && <p className="text-sm text-zinc-400">Enviando...</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}

          {overlayUrl && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Preview da overlay:</p>
              <img src={overlayUrl} alt="Overlay" className="max-h-64 rounded-lg border border-zinc-800" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
