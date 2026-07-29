'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [stats, setStats] = useState({ videos: 0, posted: 0, pending: 0 })

  useEffect(() => {
    fetch('/api/videos')
      .then((r) => r.json())
      .then((data) => {
        const videos = data.videos || []
        setStats({
          videos: videos.length,
          posted: videos.filter((v: any) => v.status === 'posted').length,
          pending: videos.filter((v: any) => v.status === 'pending').length,
        })
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Bem-vindo à Fábrica de Reels</h1>
        <p className="mt-2 text-zinc-400">
          Automatize o envio de Reels para o Instagram com títulos e descrições gerados por IA.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Total de Vídeos</p>
          <p className="mt-1 text-3xl font-bold text-purple-400">{stats.videos}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Publicados</p>
          <p className="mt-1 text-3xl font-bold text-green-400">{stats.posted}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Pendentes</p>
          <p className="mt-1 text-3xl font-bold text-yellow-400">{stats.pending}</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold">Comece agora</h2>
        <ol className="mt-4 list-inside list-decimal space-y-2 text-sm text-zinc-300">
          <li>Adicione seus vídeos na página <strong>Vídeos</strong></li>
          <li>Configure sua conta do Instagram em <strong>Configurações</strong></li>
          <li>Defina o agendamento em <strong>Agendamento</strong></li>
          <li>Ative o scheduler e deixe a mágica acontecer</li>
        </ol>
      </div>
    </div>
  )
}
