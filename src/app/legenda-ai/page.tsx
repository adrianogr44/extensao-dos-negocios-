'use client'

import { useMemo, useRef, useState } from 'react'
import { useStudio } from '@/lib/use-studio'
import { useToasts } from '@/components/ToastProvider'
import {
  Sparkles,
  Film,
  Trophy,
  Upload,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Wand2,
} from 'lucide-react'

interface LegendaResult {
  topic: string
  caption: string
  hashtags: string[]
  fullText: string
  frames: number
  transcript: string | null
}

export default function LegendaAiPage() {
  const { data } = useStudio(15000)
  const { push } = useToasts()
  const [envId, setEnvId] = useState<'futebol' | 'motivacao'>('futebol')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LegendaResult | null>(null)
  const [editedText, setEditedText] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const env = useMemo(() => data.environments.find((e) => e.id === envId), [data.environments, envId])

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setUploadedFile(f)
    if (f) {
      setSelectedFile(null)
      setResult(null)
    }
    e.target.value = ''
  }

  function handleSelectVideo(filename: string) {
    setSelectedFile(filename === selectedFile ? null : filename)
    setUploadedFile(null)
    setResult(null)
  }

  async function gerar() {
    if (loading) return
    if (!uploadedFile && !selectedFile) {
      push({ kind: 'error', title: 'Nenhum vídeo', description: 'Escolha um vídeo da lista ou envie um arquivo.' })
      return
    }
    setLoading(true)
    setResult(null)
    setCopied(false)
    try {
      const apiKey = localStorage.getItem('OPENAI_API_KEY') || undefined

      let res: Response
      if (uploadedFile) {
        const form = new FormData()
        form.append('video', uploadedFile)
        if (apiKey) form.append('apiKey', apiKey)
        res = await fetch('/api/legenda-ai', { method: 'POST', body: form })
      } else if (selectedFile) {
        res = await fetch('/api/legenda-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ env: envId, filename: selectedFile, apiKey }),
        })
      } else {
        throw new Error('Vídeo não selecionado')
      }

      const d = await res.json()
      if (!res.ok) throw new Error(d.error || `Erro ${res.status}`)
      setResult(d)
      setEditedText(d.fullText || '')
    } catch (err) {
      push({
        kind: 'error',
        title: 'Falha ao gerar legenda',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(editedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      push({ kind: 'error', title: 'Não copiou', description: 'O clipboard não está disponível.' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight">Legenda IA</h1>
          <p className="mt-1 text-[13px] text-[#9aa4b8]">
            Seleciona um vídeo, identifica o conteúdo real (frames + áudio) e gera a legenda no padrão do Studio
          </p>
        </div>
        <button className="btn btn-primary gap-2" onClick={() => void gerar()} disabled={loading || (!uploadedFile && !selectedFile)}>
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {loading ? 'Assistindo ao vídeo…' : 'Gerar legenda'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Seleção de vídeo */}
        <section className="card animate-fade-up overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#232b3c] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles size={15} className="text-[#818cf8]" />
              <h2 className="font-display text-[14px] font-semibold tracking-tight">1 · Escolher vídeo</h2>
            </div>
            <div className="flex gap-1.5">
              {(['futebol', 'motivacao'] as const).map((id) => (
                <button
                  key={id}
                  onClick={() => setEnvId(id)}
                  className={`badge cursor-pointer ${envId === id ? (id === 'futebol' ? 'badge-green' : 'badge-amber') : 'badge-gray'}`}
                >
                  {id === 'futebol' ? <Trophy size={11} /> : <Film size={11} />}
                  {id === 'futebol' ? 'Futebol' : 'Motivação'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div>
              <p className="eyebrow mb-2">Da fila do ambiente</p>
              {env && env.videos.length > 0 ? (
                <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
                  {env.videos.map((v) => {
                    const active = selectedFile === v.filename
                    return (
                      <div
                        key={v.filename}
                        onClick={() => handleSelectVideo(v.filename)}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                          active ? 'border-[#818cf8]/60 bg-[#818cf8]/10' : 'border-[#232b3c] bg-[#12161f] hover:border-[#2c3850]'
                        }`}
                      >
                        <span className="font-mono2 min-w-0 flex-1 truncate text-[12px]">{v.filename}</span>
                        {active && <Check size={13} className="shrink-0 text-[#818cf8]" />}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-[#5c697e]">Nenhum vídeo na fila deste ambiente.</p>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-[#232b3c] pt-3">
              <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload size={12} />
                Enviar arquivo
              </button>
              <input ref={fileRef} type="file" accept="video/*,.mp4,.mov,.avi,.mkv,.webm" className="hidden" onChange={handleFilePick} />
              {uploadedFile && (
                <span className="font-mono2 min-w-0 truncate text-[11px] text-[#9aa4b8]">{uploadedFile.name}</span>
              )}
            </div>

            {(selectedFile || uploadedFile) && (
              <div className="rounded-lg border border-[#232b3c] bg-[#0d1018] p-2">
                <video
                  key={selectedFile || uploadedFile?.name}
                  src={
                    uploadedFile
                      ? URL.createObjectURL(uploadedFile)
                      : `/api/studio/video?env=${envId}&file=${encodeURIComponent(selectedFile || '')}`
                  }
                  controls
                  className="aspect-video max-h-[240px] w-full rounded object-contain"
                >
                  Seu navegador não suporta vídeo.
                </video>
              </div>
            )}
          </div>
        </section>

        {/* Resultado */}
        <section className="card animate-fade-up overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#232b3c] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Eye size={15} className="text-[#25b946]" />
              <h2 className="font-display text-[14px] font-semibold tracking-tight">2 · Legenda gerada</h2>
            </div>
            {result && (
              <button className="btn btn-sm" onClick={() => void copiar()}>
                {copied ? <Check size={12} className="text-[#34d399]" /> : <Copy size={12} />}
                {copied ? 'Copiada!' : 'Copiar'}
              </button>
            )}
          </div>

          <div className="space-y-3 p-4">
            {!result && !loading && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Sparkles size={28} className="text-[#3a4354]" />
                <p className="text-[13px] text-[#5c697e]">
                  Escolha um vídeo e clique em <span className="text-[#c6cdd9]">Gerar legenda</span>.
                </p>
                <p className="text-[11px] text-[#3a4354]">A IA assiste aos frames e escuta o áudio para identificar o conteúdo real.</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <RefreshCw size={26} className="animate-spin text-[#818cf8]" />
                <p className="text-[13px] text-[#9aa4b8]">Extraindo frames, transcrevendo áudio e gerando a legenda…</p>
                <p className="text-[11px] text-[#3a4354]">Pode levar de 20 a 60 segundos.</p>
              </div>
            )}

            {result && !loading && (
              <>
                {result.topic && (
                  <div className="rounded-lg border border-[#818cf8]/25 bg-[#818cf8]/10 px-3 py-2">
                    <p className="eyebrow mb-0.5">Sobre o vídeo</p>
                    <p className="text-[12px] text-[#c6cdd9]">{result.topic}</p>
                  </div>
                )}
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={12}
                  className="w-full resize-y rounded-lg border border-[#232b3c] bg-[#0d1018] px-3 py-2.5 font-mono2 text-[12px] leading-relaxed text-[#c6cdd9] outline-none focus:border-[#818cf8]/50"
                  placeholder="Legenda gerada aparece aqui…"
                />
                {(result.frames || result.transcript) && (
                  <p className="text-[10px] text-[#3a4354]">
                    {result.frames} frames analisados{result.transcript ? ' · áudio transcrito' : ' · sem áudio identificável'}
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}