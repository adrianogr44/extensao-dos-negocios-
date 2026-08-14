'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useStudio } from '@/lib/use-studio'
import {
  Send,
  CalendarClock,
  Hourglass,
  Gauge,
  Activity,
  RefreshCw,
  CircleCheck,
  Radio,
  Film,
  Trophy,
  ExternalLink,
  ListOrdered,
  Play,
} from 'lucide-react'
import { useToasts } from '@/components/ToastProvider'

const ENV_COLOR: Record<string, { hex: string; chip: string; icon: string }> = {
  futebol: { hex: '#35d07f', chip: 'border-[#35d07f]/25 bg-[#35d07f]/10', icon: 'text-[#35d07f]' },
  motivacao: { hex: '#f5a623', chip: 'border-[#f5a623]/25 bg-[#f5a623]/10', icon: 'text-[#f5a623]' },
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  shorts: 'Shorts',
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

async function openChrome(profile: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/chrome?profile=${profile}`, { method: 'POST' })
    const d = await r.json()
    return !!d?.ok
  } catch {
    return false
  }
}

async function publishNow(env: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await fetch(`/api/studio/publish?env=${env}`, { method: 'POST' })
    const d = await r.json()
    return { ok: !!d?.ok, message: d?.message || d?.error }
  } catch {
    return { ok: false }
  }
}

export default function DashboardPage() {
const { data, loading } = useStudio()
  const { push } = useToasts()
  const [refreshing, setRefreshing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [mainStatus, setMainStatus] = useState<Record<string, { chrome: boolean; agendador: boolean }> | null>(null)
  const s = data.summary
  const current = data.current

  async function runMain() {
    if (starting) return
    setStarting(true)
    setMainStatus(null)
    try {
      const r = await fetch('/api/studio/start-all', { method: 'POST' })
      const d = await r.json()
      if (d?.ok && d.results) {
        const st: Record<string, { chrome: boolean; agendador: boolean }> = {}
        for (const [envId, res] of Object.entries(d.results as Record<string, { chrome: { ok: boolean }; scheduler: { ok: boolean } }>)) {
          st[envId] = { chrome: !!res.chrome.ok, agendador: !!res.scheduler.ok }
        }
        setMainStatus(st)
        const anyFail = Object.values(d.results as Record<string, { chrome: { ok: boolean }; scheduler: { ok: boolean } }>).some((res) => !res.chrome.ok || !res.scheduler.ok)
        push({
          kind: anyFail ? 'error' : 'success',
          title: anyFail ? 'Falha parcial' : 'Automação iniciada',
          description: anyFail
            ? 'Algo não iniciou — veja o estado abaixo e os logs (scripts/postar-log*.txt)'
            : 'Chromes e agendadores rodando em segundo plano até os horários definidos',
        })
      } else {
        push({ kind: 'error', title: 'Falha', description: d?.error || 'Resposta inválida do servidor' })
      }
    } catch (e) {
      push({ kind: 'error', title: 'Falha', description: `Erro ao iniciar: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setStarting(false)
    }
  }

  async function refreshMainStatus() {
    try {
      const r = await fetch('/api/studio/start-all')
      const d = await r.json()
      if (d?.ok && d.status) setMainStatus(d.status)
    } catch {}
  }

  useEffect(() => {
    const t = setTimeout(() => void refreshMainStatus(), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="space-y-6">
      {/* Controle principal */}
      <section className="card animate-fade-up overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Automação principal</h2>
            <p className="mt-1 text-[12px] text-[#9aa4b8]">
              Abre os 2 Chrome (futebol 9222 · motivação 9223) e deixa os agendadores em espera até os horários definidos em <span className="font-mono2 text-[#c6cdd9]">Agendamento</span>
            </p>
          </div>
          <button
            className="btn btn-primary gap-2 px-5 py-2.5"
            onClick={() => void runMain()}
            disabled={starting}
          >
            {starting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {starting ? 'Iniciando…' : 'Iniciar tudo'}
          </button>
        </div>
        <div className="grid gap-px border-t border-[#232b3c] sm:grid-cols-2">
          {[
            { id: 'futebol', nome: 'Futebol', emoji: '⚽', port: 9222 },
            { id: 'motivacao', nome: 'Motivação', emoji: '💪', port: 9223 },
          ].map((envMeta) => {
            const st = mainStatus?.[envMeta.id]
            return (
              <div key={envMeta.id} className="flex items-center justify-between gap-3 bg-[#12161f] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">{envMeta.emoji}</span>
                  <span className="text-[12px] font-semibold">{envMeta.nome}</span>
                  <span className="font-mono2 rounded bg-[#1b2230] px-1.5 py-0.5 text-[10px] text-[#5c697e]">:{envMeta.port}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`badge ${st ? (st.chrome ? 'badge-green' : 'badge-gray') : 'badge-gray'}`}>
                    <span className={`badge-dot ${st ? (st.chrome ? '' : 'pulse-dot') : 'pulse-dot'}`} />
                    Chrome {st ? (st.chrome ? 'ok' : 'off') : '…'}
                  </span>
                  <span className={`badge ${st ? (st.agendador ? 'badge-green' : 'badge-gray') : 'badge-gray'}`}>
                    <span className={`badge-dot ${st ? (st.agendador ? '' : 'pulse-dot') : 'pulse-dot'}`} />
                    Agendador {st ? (st.agendador ? 'ok' : 'off') : '…'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight">Visão Geral</h1>
          <p className="mt-1 text-[13px] text-[#9aa4b8]">Estado ao vivo dos dois ambientes de publicação</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.environments.map((env) => (
            <span key={env.id} className={`badge ${env.processing ? 'badge-amber' : env.online ? 'badge-green' : 'badge-gray'}`}>
              <span className={`badge-dot ${env.processing ? 'pulse-dot' : ''} ${ENV_COLOR[env.id].hex === '#35d07f' ? 'bg-[#35d07f]' : 'bg-[#f5a623]'}`} />
              {env.nome} · {env.processing ? 'rodando' : env.online ? 'online' : 'offline'}
            </span>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 700) }}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Resumo */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<Send size={15} />}
          tone="text-[#25b946] border-[#25b946]/25 bg-[#25b946]/10"
          value={String(s.publishedToday)}
          label="Publicações hoje"
        />
        <Stat
          icon={<Hourglass size={15} />}
          tone="text-[#fbbf24] border-[#fbbf24]/25 bg-[#fbbf24]/10"
          value={String(s.pending)}
          label="Vídeos pendentes"
        />
        <Stat
          icon={<CalendarClock size={15} />}
          tone="text-[#9aa4b8] border-[#9aa4b8]/25 bg-[#9aa4b8]/10"
          value={String(s.scheduled)}
          label="Próximas agendadas"
        />
        <Stat
          icon={<Gauge size={15} />}
          tone={
            s.success >= 80
              ? 'text-[#34d399] border-[#34d399]/25 bg-[#34d399]/10'
              : s.success >= 50
                ? 'text-[#fbbf24] border-[#fbbf24]/25 bg-[#fbbf24]/10'
                : 'text-[#f87171] border-[#f87171]/25 bg-[#f87171]/10'
          }
          value={`${s.success}%`}
          label="Taxa de sucesso"
        />
      </section>

      {/* Progresso diário */}
      <section className="card animate-fade-up p-4">
        <div className="mb-4 flex items-center gap-2">
          <Activity size={15} className="text-[#25b946]" />
          <h2 className="font-display text-[13px] font-semibold tracking-wide">Progresso diário por plataforma</h2>
        </div>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.platforms).map(([key, p]) => (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="font-medium">{PLATFORM_LABEL[key] ?? key}</span>
                <span className="font-mono2 text-[#5c697e]">{p.today}/{p.limit}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#1b2230]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#25b946] to-[#818cf8] transition-all duration-700"
                  style={{ width: `${Math.min(100, (p.today / Math.max(1, p.limit)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Execução atual */}
      <section className="card animate-fade-up p-4">
        <div className="mb-3 flex items-center gap-2">
          <Radio size={15} className="text-[#fbbf24]" />
          <h2 className="font-display text-[13px] font-semibold tracking-wide">Execução atual</h2>
          {current && (
            <span className="badge badge-amber ml-2">
              <span className="badge-dot pulse-dot" />
              {current.env === 'futebol' ? 'Futebol' : 'Motivação'} em processamento
            </span>
          )}
        </div>
        {current && current.video ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/[0.04] p-4">
            <div className="min-w-0">
              <p className="font-mono2 truncate text-[13px] font-semibold">{current.video.filename}</p>
              <p className="mt-1 text-[12px] text-[#9aa4b8]">
                {current.video.platformState.filter((p) => p.done).length}/{current.video.platformState.length} plataformas concluídas
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {current.video.platformState.map((p) => (
                <span key={p.key} className={`badge ${p.done ? 'badge-green' : 'badge-blue'}`}>
                  {p.done ? <CircleCheck size={11} /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#25b946]" />}
                  {p.short}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-[#232b3c] bg-[#12161f] p-4">
            <span className="h-2 w-2 rounded-full bg-[#2c3850]" />
            <p className="text-[13px] text-[#5c697e]">{loading ? 'Lendo estado das filas…' : 'Nenhuma publicação em curso agora.'}</p>
          </div>
        )}
      </section>

      {/* Próximas + Atividade */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card animate-fade-up p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock size={15} className="text-[#25b946]" />
            <h2 className="font-display text-[13px] font-semibold tracking-wide">Próximas publicações</h2>
            <Link href="/calendario" className="btn btn-ghost btn-sm ml-auto">
              Ver calendário
            </Link>
          </div>
          <div className="space-y-2">
            {data.upcoming.length === 0 && <p className="text-[13px] text-[#5c697e]">Nenhuma publicação agendada.</p>}
            {data.upcoming.map((u, i) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#232b3c] bg-[#12161f] px-3 py-2.5 transition-colors hover:border-[#2c3850]">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${ENV_COLOR[u.env].chip}`}>
                    {u.env === 'futebol' ? <Trophy size={14} className={ENV_COLOR[u.env].icon} /> : <Film size={14} className={ENV_COLOR[u.env].icon} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono2 truncate text-[12px] font-semibold">{u.filename || '—'}</p>
                    <p className="text-[11px] capitalize text-[#5c697e]">
                      {u.env === 'futebol' ? 'Futebol' : 'Motivação'} · {u.time}
                    </p>
                  </div>
                </div>
                <span className={`badge ${u.status === 'processing' ? 'badge-amber' : 'badge-gray'}`}>
                  {u.status === 'processing' ? 'agora' : i === 0 ? 'próximo' : `+${i}`}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card animate-fade-up p-4">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={15} className="text-[#34d399]" />
            <h2 className="font-display text-[13px] font-semibold tracking-wide">Atividade recente</h2>
          </div>
          <div>
            {data.activity.length === 0 && <p className="py-3 text-[13px] text-[#5c697e]">Sem eventos registrados.</p>}
            {data.activity.slice(0, 14).map((a) => (
              <TimelineRow key={a.id} ev={a} />
            ))}
          </div>
        </section>
      </div>

      {/* Ambientes */}
      <section className="grid gap-4 lg:grid-cols-2">
        {data.environments.map((env, idx) => (
          <div key={env.id} className="card animate-fade-up p-4" style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${ENV_COLOR[env.id].chip}`}>
                  {env.id === 'futebol' ? <Trophy size={17} className={ENV_COLOR[env.id].icon} /> : <Film size={17} className={ENV_COLOR[env.id].icon} />}
                </div>
                <div>
                  <h3 className="font-display text-[15px] font-semibold tracking-tight">{env.nome}</h3>
                  <p className="max-w-[220px] truncate text-[11px] text-[#5c697e]" title={env.videosDir}>
                    {env.videosDir}
                  </p>
                </div>
              </div>
<div className="flex flex-col items-end gap-2">
<button
                    className={`btn btn-primary btn-sm ${env.processing ? 'opacity-60' : ''}`}
                    disabled={env.processing}
                    onClick={async () => {
                      const res = await publishNow(env.id)
                      const ok = res.ok
                      push({
                        kind: ok ? 'success' : 'error',
                        title: ok ? 'Publicação iniciada' : 'Não foi possível iniciar',
                        description: ok
                          ? `${env.nome}: vídeo enviado para a fila de postagem`
                          : res.message || (env.processing ? 'Já existe uma execução em andamento' : 'Falha ao abrir o Chrome do ambiente'),
                      })
                    }}
                  >
                    <Send size={12} />
                    Publicar agora
                  </button>
                <span className={`badge ${env.processing ? 'badge-amber' : env.online ? 'badge-green' : 'badge-red'}`}>
                  <span className={`badge-dot ${env.processing ? 'pulse-dot' : ''}`} />
                  {env.processing ? 'processando' : env.online ? 'online' : 'offline'}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <InfoRow label="Porta CDP" value={`${env.port}`} mono />
              <InfoRow label="Fila" value={`${env.queue.total} vídeos`} />
              <InfoRow label="Pendentes" value={`${env.queue.pending}`} />
              <InfoRow label="Hoje" value={`${env.queue.publishedToday} publicados`} />
              <InfoRow label="Agenda" value={env.schedule.join(', ')} />
              <InfoRow label="Vídeos/rodada" value={`${env.videosPerRun ?? 1}`} />
              <InfoRow label="Próximo" value={env.currentVideo ? shortName(env.currentVideo.filename) : '—'} mono />
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="text-[#5c697e]">Plataformas</span>
                <span className="font-mono2 text-[#5c697e]">{env.platforms.filter((p) => p.today > 0).length} ativas hoje</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {env.platforms.map((p) => (
                  <span key={p.key} className={`badge ${p.today >= p.limit ? 'badge-green' : p.today > 0 ? 'badge-blue' : 'badge-gray'}`}>
                    {p.short}
                    <span className="font-mono2 opacity-80">{p.today}/{p.limit}</span>
                  </span>
                ))}
              </div>
            </div>

<div className="mt-4 flex items-center gap-2">
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const ok = await openChrome(env.id)
                  if (ok) {
                    push({ kind: 'info', title: 'Chrome iniciando…', description: `${env.nome}: login na janela que abrir (porta ${env.port})` })
                  } else {
                    push({ kind: 'error', title: 'Falha ao abrir Chrome', description: `Não foi possível abrir ${env.chromeProfile}` })
                  }
                }}
              >
                <ExternalLink size={12} />
                Abrir Chrome
              </button>
              <button
                className="btn btn-sm shrink-0"
                onClick={async () => {
                  try {
                    const nova = env.chromeMode === 'headless' ? 'windowed' : 'headless'
                    const r = await fetch('/api/studio/chrome-mode', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ env: env.id, mode: nova }),
                    })
                    const d = await r.json()
                    if (d.ok) {
                      push({
                        kind: 'success',
                        title: `Chrome em modo ${nova === 'headless' ? 'headless' : 'visível'}`,
                        description: d.message,
                      })
                      if (nova === 'windowed') {
                        push({
                          kind: 'info',
                          title: 'Verifique o Chrome',
                          description: `${env.nome}: acompanhe a automação na janela que abriu (porta ${env.port})`,
                        })
                      }
                    } else {
                      push({ kind: 'error', title: 'Falha ao alternar', description: d.error || d.message })
                    }
                  } catch (e) {
                    push({ kind: 'error', title: 'Falha', description: `Erro: ${e instanceof Error ? e.message : String(e)}` })
                  }
                }}
              >
                <Radio size={12} />
                {env.chromeMode === 'headless' ? 'Ver automação' : 'Ocultar'}
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  try {
                    const r = await fetch(`/api/studio/scheduler?env=${env.id}&action=start`, { method: 'POST' })
                    const d = await r.json()
                    if (d.ok) push({ kind: 'success', title: 'Automação iniciada', description: `${env.nome}: agendador rodando em segundo plano` })
                    else if (d.already) push({ kind: 'info', title: 'Já rodando', description: d.message })
                    else push({ kind: 'error', title: 'Falha', description: d.message })
                  } catch {
                    push({ kind: 'error', title: 'Falha', description: 'Não foi possível iniciar a automação' })
                  }
                }}
              >
                <Play size={12} />
                Automação
              </button>
              <Link href="/fila" className="btn btn-ghost btn-sm ml-auto">
                <ListOrdered size={12} />
                Ver fila
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="card animate-fade-up p-4">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${tone}`}>{icon}</span>
      <p className="font-display mt-3 text-[26px] font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 text-[12px] font-medium text-[#9aa4b8]">{label}</p>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#232b3c] pb-1.5">
      <span className="text-[#5c697e]">{label}</span>
      <span className={`text-right ${mono ? 'font-mono2' : 'font-medium'}`}>{value}</span>
    </div>
  )
}

function shortName(filename: string): string {
  return filename.length > 24 ? filename.slice(0, 22) + '…' : filename
}

function TimelineRow({ ev }: { ev: { type: string; message: string; ts: string; env: string } }) {
  const color = ev.type === 'error' ? '#f87171' : ev.env === 'motivacao' ? '#f5a623' : '#35d07f'
  return (
    <div className="timeline-item py-1.5">
      <span
        className="absolute left-[6px] top-[10px] flex h-[9px] w-[9px] items-center justify-center rounded-full"
        style={{ background: color + '22', border: `1px solid ${color}66` }}
      >
        <span className="h-[3px] w-[3px] rounded-full" style={{ background: color }} />
      </span>
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-[#c6cdd9]">
          {ev.message.slice(0, 90)}
        </p>
        <span className="font-mono2 shrink-0 text-[10px] text-[#5c697e]">{fmtTime(ev.ts)}</span>
      </div>
    </div>
  )
}
