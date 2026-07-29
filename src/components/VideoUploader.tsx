'use client'

import { useState, useRef, FormEvent } from 'react'

export default function VideoUploader() {
  const [imagem, setImagem] = useState<File | null>(null)
  const [video, setVideo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewImagem, setPreviewImagem] = useState<string | null>(null)
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImagem(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewImagem(url)
    } else {
      setPreviewImagem(null)
    }
  }

  function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setVideo(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewVideo(url)
    } else {
      setPreviewVideo(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!imagem || !video) return

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('imagem_interface', imagem)
      formData.append('video_base', video)

      const res = await fetch('http://localhost:8000/gerar-video', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail ?? `Erro ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `video-final-${Date.now()}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl shadow-black/30">
        <h1 className="mb-2 text-2xl font-bold text-zinc-100">
          Gerador de Vídeo
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          Faça upload da imagem de interface e do vídeo base para gerar o vídeo final.
        </p>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Imagem da Interface
            </label>
            <label
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
                previewImagem
                  ? 'border-purple-500/50 bg-purple-500/5'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'
              }`}
            >
              <input
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={handleImagem}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {previewImagem ? (
                <img
                  src={previewImagem}
                  alt="Preview"
                  className="max-h-40 rounded-lg object-contain"
                />
              ) : (
                <div className="text-center">
                  <svg
                    className="mx-auto h-8 w-8 text-zinc-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-zinc-500">
                    PNG ou JPG
                  </p>
                </div>
              )}
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Vídeo Base
            </label>
            <label
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
                previewVideo
                  ? 'border-purple-500/50 bg-purple-500/5'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'
              }`}
            >
              <input
                type="file"
                accept=".mp4"
                onChange={handleVideo}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {previewVideo ? (
                <video
                  src={previewVideo}
                  controls
                  className="max-h-40 rounded-lg"
                >
                  Seu navegador não suporta vídeo.
                </video>
              ) : (
                <div className="text-center">
                  <svg
                    className="mx-auto h-8 w-8 text-zinc-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-zinc-500">
                    MP4
                  </p>
                </div>
              )}
            </label>
          </div>

          <button
            type="submit"
            disabled={!imagem || !video || loading}
            className="w-full rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition-all hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Processando (isso pode demorar)...'
              : 'Gerar Vídeo Final'}
          </button>
        </form>
      </div>
    </div>
  )
}
