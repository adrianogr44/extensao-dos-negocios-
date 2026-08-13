'use client'

import { useStudio } from '@/lib/use-studio'
import { Film, Trophy, CircleCheck, TriangleAlert, Hourglass } from 'lucide-react'

export default function FilaPage() {
  const { data } = useStudio(7000)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">Fila de publicação</h1>
        <p className="mt-1 text-[13px] text-[#9aa4b8]">Ordem real das filas de Futebol e Motivação</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.environments.map((env) => {
          const pending = env.videos.filter((v) => v.status !== 'publicado')
          const currentVideo = env.currentVideo
          const enabledIds = new Set(env.platforms.map((p) => p.key))
          const order = pending.map((v) => v).sort((a, b) => {
            const aDate = a.dates.length ? Math.max(...a.dates.map((d) => Date.parse(d))) : 0
            const bDate = b.dates.length ? Math.max(...b.dates.map((d) => Date.parse(d))) : 0
            if (aDate !== bDate) return aDate - bDate
            return a.filename.localeCompare(b.filename)
          })
          const isMotivacao = env.id === 'motivacao'

          return (
            <div key={env.id} className="card animate-fade-up overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#232b3c] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#232b3c] bg-[#161c27]">
                    {isMotivacao ? <Film size={15} className="text-[#f5a623]" /> : <Trophy size={15} className="text-[#35d07f]" />}
                  </span>
                  <div>
                    <h2 className="font-display text-[14px] font-semibold tracking-tight">{env.nome}</h2>
                    <p className="text-[11px] text-[#5c697e]">{env.queue.pending} aguardando · {env.queue.total} na fila</p>
                  </div>
                </div>
                <span className={`badge ${env.processing ? 'badge-amber' : env.online ? 'badge-green' : 'badge-gray'}`}>
                  <span className={`badge-dot ${env.processing ? 'pulse-dot' : ''}`} />
                  {env.processing ? 'processando' : env.online ? 'online' : 'offline'}
                </span>
              </div>

              {/* Vídeo atual */}
              <div className="border-b border-[#232b3c] bg-[#12161f] px-4 py-3">
                {currentVideo ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Hourglass size={13} className={env.processing ? 'animate-spin text-[#fbbf24]' : 'text-[#5c697e]'} />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] uppercase tracking-widest text-[#5c697e]">Em processo</p>
                        <p className="font-mono2 truncate text-[12px] font-semibold">{currentVideo.filename}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {currentVideo.platformState
                        .filter((p) => enabledIds.has(p.key))
                        .map((p) => (
                          <span key={p.key} title={p.label} className={`rounded px-1.5 py-0.5 font-mono2 text-[9px] font-bold ${p.done ? 'bg-[#34d399]/15 text-[#34d399]' : 'bg-[#1b2230] text-[#5c697e]'}`}>
                            {p.done ? '●' : '○'} {p.short}
                          </span>
                        ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-[#5c697e]">Fila vazia — todos os vídeos desta linha foram publicados.</p>
                )}
              </div>

              {/* Progresso por plataforma */}
              <div className="border-b border-[#232b3c] px-4 py-3">
                <p className="eyebrow mb-2">Hoje por plataforma</p>
                <div className="space-y-2">
                  {env.platforms.map((p) => (
                    <div key={p.key}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-medium">{p.label}</span>
                        <span className="font-mono2 text-[#5c697e]">{p.today}/{p.limit}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-[#1b2230]">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${p.today >= p.limit ? 'bg-[#34d399]' : 'bg-gradient-to-r from-[#25b946] to-[#818cf8]'}`}
                          style={{ width: `${Math.min(100, (p.today / Math.max(1, p.limit)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Próximos */}
              <div className="px-2 py-2">
                <p className="eyebrow px-2 py-1">Próximos na fila</p>
                <div className="max-h-[280px] overflow-y-auto">
                  {order.slice(0, 12).map((v, i) => (
                    <div
                      key={`${env.id}:${v.filename}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#161c27]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="font-mono2 w-6 shrink-0 text-[10px] text-[#3a4354]">{i === 0 ? '→' : String(i + 1).padStart(2, '0')}</span>
                        <p className="font-mono2 truncate text-[12px]">{v.filename}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {v.platforms
                          .filter((p) => enabledIds.has(p.key))
                          .slice(0, 4)
                          .map((p) => (
                            <span
                              key={p.key}
                              className={`flex h-4 w-4 items-center justify-center rounded ${v.status === 'erro' ? 'bg-[#f87171]/15 text-[#f87171]' : p.done ? 'bg-[#34d399]/15 text-[#34d399]' : 'bg-[#1b2230] text-[#3a4354]'}`}
                              title={(v.status === 'erro' && 'erro') || p.label}
                            >
                              {v.status === 'erro' ? <TriangleAlert size={9} /> : p.done ? <CircleCheck size={9} /> : <span className="h-1 w-1 rounded-full bg-current" />}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}