'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, Play, Square, Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import { useToasts } from '@/components/ToastProvider'

interface NicheSchedule {
  env: string
  nome: string
  emoji: string
  color: string
  enabled: boolean
  times: string[]
  timezone: string
  videosPerRun: number
  running: boolean
  pid: number | null
  loadingSched: boolean
  loadingRun: boolean
}

const NICHES = [
  { env: 'futebol', nome: 'Futebol', emoji: '⚽', color: '#35d07f' },
  { env: 'motivacao', nome: 'Motivação', emoji: '💪', color: '#f5a623' },
]

const TIMEZONE = 'America/Sao_Paulo'

async function fetchSchedule(env: string): Promise<{ enabled: boolean; times: string[]; timezone: string; videosPerRun: number }> {
  const r = await fetch(`/api/schedule?env=${env}`)
  return r.json()
}

async function fetchScheduler(env: string): Promise<{ running: boolean; pid: number | null }> {
  const r = await fetch(`/api/studio/scheduler?env=${env}`)
  return r.json()
}

export default function SchedulePage() {
  const { push } = useToasts()
  const [items, setItems] = useState<NicheSchedule[]>(NICHES.map((n) => ({ ...n, enabled: true, times: [], timezone: TIMEZONE, videosPerRun: 1, running: false, pid: null, loadingSched: true, loadingRun: false })))

  const update = (env: string, patch: Partial<NicheSchedule>) =>
    setItems((prev) => prev.map((i) => (i.env === env ? { ...i, ...patch } : i)))

  const loadAll = useCallback(async () => {
    const next = await Promise.all(
      NICHES.map(async (n) => {
        const [sched, schedRun] = await Promise.all([
          fetchSchedule(n.env).catch(() => null),
          fetchScheduler(n.env).catch(() => null),
        ])
        return {
          ...n,
          enabled: sched?.enabled ?? true,
          times: sched?.times ?? [],
          timezone: sched?.timezone ?? TIMEZONE,
          videosPerRun: sched?.videosPerRun ?? 1,
          running: !!schedRun?.running,
          pid: schedRun?.pid ?? null,
          loadingSched: false,
          loadingRun: false,
        }
      })
    )
    setItems(next)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void loadAll(), 0)
    return () => clearTimeout(t)
  }, [loadAll])

  async function save(env: string) {
    const item = items.find((i) => i.env === env)!
    update(env, { loadingSched: true })
    try {
      const r = await fetch(`/api/schedule?env=${env}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: item.enabled, times: item.times, timezone: item.timezone, videosPerRun: item.videosPerRun }),
      })
      const d = await r.json()
      if (d.ok) {
        push({ kind: 'success', title: `${item.nome}: horários salvos`, description: `${item.times.length} horário(s) · ${item.videosPerRun} vídeo(s) por rodada` })
      } else {
        push({ kind: 'error', title: 'Falha ao salvar', description: d.error })
      }
    } catch {
      push({ kind: 'error', title: 'Falha ao salvar', description: 'Não foi possível gravar o schedule-config' })
    } finally {
      update(env, { loadingSched: false })
    }
  }

  async function toggleAutomation(env: string) {
    const item = items.find((i) => i.env === env)!
    if (item.loadingRun) return
    update(env, { loadingRun: true })
    try {
      const action = item.running ? 'stop' : 'start'
      const r = await fetch(`/api/studio/scheduler?env=${env}&action=${action}`, { method: 'POST' })
      const d = await r.json()
      if (d.ok) {
        push({
          kind: d.started ? 'success' : d.stopped ? 'info' : 'success',
          title: d.started ? `${item.nome}: automação iniciada` : d.stopped ? `${item.nome}: automação parada` : 'OK',
          description: d.started ? 'Agendador rodando em segundo plano' : d.stopped ? 'Agendador encerrado' : d.message,
        })
        update(env, { running: d.started ?? false, pid: d.pid ?? null })
      } else if (d.already) {
        push({ kind: 'info', title: 'Já rodando', description: d.message })
      } else if (d.notRunning) {
        push({ kind: 'info', title: 'Não está rodando', description: d.message })
        update(env, { running: false })
      }
    } catch {
      push({ kind: 'error', title: 'Falha na automação', description: 'Não foi possível executar a ação' })
    } finally {
      update(env, { loadingRun: false })
    }
  }

  function addTime(env: string) {
    update(env, { times: [...items.find((i) => i.env === env)!.times, '12:00'] })
  }

  function setTime(env: string, idx: number, value: string) {
    const item = items.find((i) => i.env === env)!
    const times = [...item.times]
    times[idx] = value
    update(env, { times })
  }

  function removeTime(env: string, idx: number) {
    const item = items.find((i) => i.env === env)!
    update(env, { times: item.times.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight">Agendamento por nicho</h1>
          <p className="mt-1 text-[13px] text-[#9aa4b8]">Horários, quantidade de vídeos e automação de cada ambiente</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>
          <RefreshCw size={13} />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <div key={item.env} className="card animate-fade-up p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <h2 className="font-display text-[16px] font-semibold tracking-tight">{item.nome}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#9aa4b8]">
                    <span className={`h-1.5 w-1.5 rounded-full ${item.running ? 'animate-pulse bg-[#34d399]' : 'bg-[#2c3850]'}`} />
                    {item.loadingSched ? 'carregando…' : item.running ? `automação ativa${item.pid ? ` · PID ${item.pid}` : ''}` : 'automação parada'}
                  </p>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-[12px] text-[#9aa4b8]">Ativo</span>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => update(item.env, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800"
                  style={{ accentColor: item.color }}
                />
              </label>
            </div>

            {/* Horários */}
            <div className="mt-5">
              <label className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#9aa4b8]">
                <Clock size={13} />
                Horários de postagem
              </label>
              <div className="space-y-2">
                {item.times.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[#232b3c] px-3 py-2.5 text-[12px] text-[#5c697e]">
                    Nenhum horário — adicione abaixo.
                  </p>
                )}
                {item.times.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={t}
                      onChange={(e) => setTime(item.env, idx, e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => removeTime(item.env, idx)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addTime(item.env)} className="btn btn-sm mt-2 w-full">
                <Plus size={13} />
                Adicionar horário
              </button>
            </div>

            {/* Quantidade */}
            <div className="mt-4">
              <label className="mb-2 block text-[12px] font-semibold text-[#9aa4b8]">Vídeos por rodada</label>
              <input
                type="number"
                min={1}
                max={10}
                value={item.videosPerRun}
                onChange={(e) => update(item.env, { videosPerRun: Math.max(1, Number(e.target.value) || 1) })}
                className="w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              />
              <p className="mt-1.5 text-[11px] text-[#5c697e]">
                {item.times.length} horário(s) × {item.videosPerRun} vídeo(s) = até{' '}
                <span className="font-mono2 text-[#9aa4b8]">{item.times.length * item.videosPerRun}</span> vídeo(s)/dia
              </p>
            </div>

            {/* Ações */}
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={() => save(item.env)}
                disabled={item.loadingSched}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-[13px] font-medium transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                <Save size={13} />
                {item.loadingSched ? 'Salvando…' : 'Salvar horários'}
              </button>
              <button
                onClick={() => toggleAutomation(item.env)}
                disabled={item.loadingRun}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                  item.running
                    ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    : 'border border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399] hover:bg-[#34d399]/20'
                }`}
              >
                {item.running ? <Square size={12} /> : <Play size={12} />}
                {item.loadingRun ? 'Aguarde…' : item.running ? 'Parar automação' : 'Iniciar automação'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[12px] leading-relaxed text-[#5c697e]">
        Os horários são gravados em <span className="font-mono2">scripts/schedule-config.json</span> e{' '}
        <span className="font-mono2">scripts/schedule-config-motivacao.json</span> — os mesmos arquivos que o agendador
        (postar-agendado.js) lê. Iniciar a automação roda o agendador em segundo plano; ele dispara nos horários
        configurados e publica a quantidade de vídeos definida.
      </p>
    </div>
  )
}