'use client'

import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [stats, setStats] = useState({ videos: 0, posted: 0, pending: 0, error: 0 })

  useEffect(() => {
    fetch('/api/videos')
      .then((r) => r.json())
      .then((data) => {
        const videos = data.videos || []
        setStats({
          videos: videos.length,
          posted: videos.filter((v: any) => v.status === 'posted').length,
          pending: videos.filter((v: any) => v.status === 'pending').length,
          error: videos.filter((v: any) => v.status === 'error').length,
        })
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Total</p>
          <p className="text-2xl font-bold text-purple-400">{stats.videos}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Publicados</p>
          <p className="text-2xl font-bold text-green-400">{stats.posted}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Erros</p>
          <p className="text-2xl font-bold text-red-400">{stats.error}</p>
        </div>
      </div>
    </div>
  )
}
