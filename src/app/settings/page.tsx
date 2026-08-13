'use client'

import { useEffect, useState, useRef } from 'react'

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cookiesTexto, setCookiesTexto] = useState('')
  const [cookiesStatus, setCookiesStatus] = useState<string | null>(null)
  const [cookiesSalvando, setCookiesSalvando] = useState(false)
  const [cookiesError, setCookiesError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/instagram/cookies')
      .then(r => r.json())
      .then(d => {
        setOpenaiKey(localStorage.getItem('OPENAI_API_KEY') || '')
        if (d.filename) setCookiesStatus(`Cookies carregados (${(d.size / 1024).toFixed(1)} KB)`)
        else setCookiesStatus(null)
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    setCookiesError(null)
    localStorage.setItem('OPENAI_API_KEY', openaiKey)
    if (cookiesTexto.trim()) {
      try {
        const res = await fetch('/api/instagram/cookies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies: cookiesTexto }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao salvar cookies')
        setCookiesStatus(`Cookies salvos (${(data.size / 1024).toFixed(1)} KB)`)
        setCookiesTexto('')
      } catch (err) {
        setCookiesError(err instanceof Error ? err.message : 'Erro ao salvar cookies')
      }
    }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  async function salvarCookies(texto: string) {
    setCookiesSalvando(true)
    setCookiesError(null)
    try {
      const res = await fetch('/api/instagram/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: texto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setCookiesStatus(`Cookies salvos (${(data.size / 1024).toFixed(1)} KB)`)
      setCookiesTexto('')
    } catch (err) {
      setCookiesError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCookiesSalvando(false)
    }
  }

  function handleFileRead(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCookiesTexto(text)
      salvarCookies(text)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold">OpenAI</h2>
        <p className="text-sm text-zinc-400">
          Chave da API para gerar títulos e descrições automaticamente.
        </p>
        <input
          type="password"
          placeholder="sk-..."
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold">Instagram - Cookies (para API)</h2>
        <p className="text-sm text-zinc-400">
          Instagram bloqueia acesso automatizado via servidor. Para baixar reels diretamente pelo app, voce precisa
          exportar os cookies da sua sessao logada e colar abaixo.
        </p>

        {cookiesStatus && (
          <p className="text-sm text-green-400">{cookiesStatus}</p>
        )}

        <textarea
          value={cookiesTexto}
          onChange={(e) => setCookiesTexto(e.target.value)}
          placeholder="Cole aqui o conteudo do cookies.txt"
          rows={6}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => salvarCookies(cookiesTexto)}
            disabled={!cookiesTexto.trim() || cookiesSalvando}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {cookiesSalvando ? 'Salvando...' : 'Salvar Cookies'}
          </button>

          <span className="text-sm text-zinc-500">ou</span>

          <input
            ref={fileRef}
            type="file"
            accept=".txt"
            onChange={handleFileRead}
            className="text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-purple-700"
          />
        </div>

        {cookiesError && (
          <p className="text-sm text-red-400">{cookiesError}</p>
        )}
      </div>

      <div className="space-y-4 rounded-lg border border-amber-800/50 bg-amber-900/20 p-6">
        <h2 className="text-lg font-semibold text-amber-300">Extensao Chrome (recomendado)</h2>
        <p className="text-sm text-zinc-400">
          Como o Instagram bloqueia acesso automatizado, a forma mais confiavel e usar nossa
          extensao do Chrome que baixa os reels diretamente pelo navegador.
        </p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-300">
          <li>Abra <code className="text-purple-400 bg-zinc-800 px-1 rounded">chrome://extensions</code></li>
          <li>Ative &quot;Modo do desenvolvedor&quot; (canto superior direito)</li>
          <li>Clique em &quot;Carregar sem compactacao&quot;</li>
          <li>Selecione a pasta <code className="text-purple-400 bg-zinc-800 px-1 rounded">chrome-extension</code> do projeto</li>
          <li>Va para o Instagram, abra um perfil, clique na extensao e depois em &quot;Baixar Reels&quot;</li>
        </ol>
        <a
          href="/extensao"
          className="inline-block rounded-lg border border-amber-400/40 px-4 py-2 text-sm text-amber-300 hover:bg-amber-900/20 transition-colors"
        >
          Ver recursos da extensão →
        </a>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar configurações'}
      </button>
    </div>
  )
}
