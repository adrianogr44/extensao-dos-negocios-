'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Trophy,
  X,
  CircleCheck,
  TriangleAlert,
  Video as VideoIcon,
  Clock3,
} from 'lucide-react'

type ViewMode = 'month' | 'week' | 'day'

interface PlatformState {
  key: string
  label: string
  short: string
  done: boolean
  date: string | null
}

interface CalEvent {
  id: string
  env: 'futebol' | 'motivacao'
  date: string
  time: string
  ts: string | null
  filename: string
  platforms: PlatformState[]
  status: 'publicado' | 'agendado' | 'parcial' | 'pendente' | 'erro'
  error?: string | null
}

interface CalData {
  month: string
  events: CalEvent[]
}

const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DAYS_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const STATUS_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  publicado: { badge: 'badge-green', dot: 'bg-[#34d399]', label: 'Publicado' },
  agendado: { badge: 'badge-blue', dot: 'bg-[#25b946]', label: 'Agendado' },
  parcial: { badge: 'badge-amber', dot: 'bg-[#fbbf24]', label: 'Parcial' },
  pendente: { badge: 'badge-gray', dot: 'bg-[#5c697e]', label: 'Pendente' },
  erro: { badge: 'badge-red', dot: 'bg-[#f87171]', label: 'Erro' },
}

function EnvIcon({ env, size = 12 }: { env: 'futebol' | 'motivacao'; size?: number }) {
  return env === 'futebol' ? <Trophy size={size} className="shrink-0 text-[#35d07f]" /> : <Film size={size} className="shrink-0 text-[#f5a623]" />
}

function EventPill({ ev, onClick, compact }: { ev: CalEvent; onClick?: () => void; compact?: boolean }) {
  const st = STATUS_STYLE[ev.status]
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-start gap-1.5 rounded-md border border-[#232b3c] bg-[#12161f] px-1.5 py-1 text-left transition-colors hover:border-[#2c3850] ${ev.status === 'erro' ? 'border-[#f87171]/30' : ''}`}
      title={`${ev.filename} — ${ev.time}`}
    >
      <EnvIcon env={ev.env} size={10} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-medium leading-tight text-[#c6cdd9]">{ev.filename}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="font-mono2 text-[9px] text-[#5c697e]">{ev.time}</span>
          <span className={`h-1 w-1 rounded-full ${st.dot}`} />
          {!compact && (
            <span className="text-[9px] text-[#5c697e]">
              {ev.platforms.filter((p) => p.done).length}/{ev.platforms.length} plataformas
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function CellHeader({ date, today }: { date: Date; today: boolean }) {
  return (
    <div className={`flex h-7 items-center justify-between rounded-t-md px-2 ${today ? 'bg-[#25b946]/10' : ''}`}>
      <span className="text-[11px] font-semibold text-[#9aa4b8]">{date.getDate()}</span>
      {today && <span className="rounded bg-[#25b946]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#25b946]">hoje</span>}
    </div>
  )
}

export default function CalendarioPage() {
  const [mode, setMode] = useState<ViewMode>('month')
  const [focus, setFocus] = useState<Date>(() => new Date())
  const [monthStr, setMonthStr] = useState(() => ymd(new Date()))
  const [data, setData] = useState<CalData>({ month: '', events: [] })
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch(`/api/studio/calendar?month=${monthStr.slice(0, 7)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: CalData) => {
        if (!alive) return
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [monthStr])

  const byDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const ev of data.events) {
      ;(map[ev.date] = map[ev.date] || []).push(ev)
    }
    return map
  }, [data])

  const todayStr = ymd(new Date())

  function shift(deltaDays: number) {
    const next = new Date(focus)
    next.setDate(next.getDate() + deltaDays)
    setFocus(next)
    setMonthStr(ymd(next))
  }

  function shiftMonth(delta: number) {
    const next = new Date(focus.getFullYear(), focus.getMonth() + delta, 1)
    setFocus(next)
    setMonthStr(ymd(next))
  }

  function goToday() {
    const nowD = new Date()
    setFocus(nowD)
    setMonthStr(ymd(nowD))
  }

  const title = useMemo(() => {
    if (mode === 'month') return `${MONTHS_PT[focus.getMonth()]} de ${focus.getFullYear()}`
    if (mode === 'week') {
      const start = new Date(focus)
      start.setDate(focus.getDate() - focus.getDay())
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return `${start.getDate()}–${end.getDate()} de ${MONTHS_PT[end.getMonth()]}`
    }
    return `${focus.getDate()} de ${MONTHS_PT[focus.getMonth()]} · ${DAYS_PT[focus.getDay()]}`
  }, [mode, focus])

  const cells = useMemo(() => {
    if (mode !== 'month') return []
    const first = new Date(focus.getFullYear(), focus.getMonth(), 1)
    const offset = first.getDay()
    const out: Date[] = []
    for (let i = 0; i < offset; i++) {
      const d = new Date(first)
      d.setDate(d.getDate() - (offset - i))
      out.push(d)
    }
    const dim = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate()
    for (let d = 1; d <= dim; d++) out.push(new Date(focus.getFullYear(), focus.getMonth(), d))
    return out
  }, [focus, mode])

  const weekDays = useMemo(() => {
    if (mode !== 'week') return []
    const start = new Date(focus)
    start.setDate(focus.getDate() - focus.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [focus, mode])

  const modeBtn = (m: ViewMode, label: string) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        mode === m ? 'bg-[#1b2230] text-white shadow-sm' : 'text-[#9aa4b8] hover:bg-[#161c27] hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight">Calendário</h1>
          <p className="mt-1 text-[13px] text-[#9aa4b8]">Publicações reais do scheduler e das filas — sem dados inventados</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[#232b3c] bg-[#12161f] p-1">
          {modeBtn('month', 'Mês')}
          {modeBtn('week', 'Semana')}
          {modeBtn('day', 'Dia')}
          <button onClick={goToday} className="btn btn-primary btn-sm ml-1">
            Hoje
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-1.5">
          <button className="btn btn-ghost btn-sm" onClick={() => (mode === 'month' ? shiftMonth(-1) : shift(mode === 'week' ? -7 : -1))}>
            <ChevronLeft size={15} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => (mode === 'month' ? shiftMonth(1) : shift(mode === 'week' ? 7 : 1))}>
            <ChevronRight size={15} />
          </button>
          <span className="font-display ml-1 text-[15px] font-semibold tracking-tight capitalize">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5c697e]">
          {(Object.keys(STATUS_STYLE) as Array<keyof typeof STATUS_STYLE>).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[k].dot}`} />
              {STATUS_STYLE[k].label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {loading && (
        <div className="card p-6">
          <div className="skeleton h-4 w-44" />
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        </div>
      )}

      {!loading && mode === 'month' && (
        <div className="card overflow-hidden p-2">
          <div className="grid grid-cols-7 gap-px">
            {DAYS_PT.map((d) => (
              <div key={d} className="px-2 pb-1 pt-2 text-center text-[10px] font-semibold uppercase tracking-widest text-[#5c697e]">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {cells.map((d) => {
              const key = ymd(d)
              const evs = byDay[key] || []
              const inMonth = d.getMonth() === focus.getMonth()
              const isToday = key === todayStr
              return (
                <div key={key} className={`min-h-[104px] border border-[#232b3c]/70 p-1 ${inMonth ? 'bg-[#12161f]' : 'bg-[#0f1220] opacity-55'}`}>
                  <CellHeader date={d} today={isToday} />
                  <div className="mt-0.5 space-y-1">
                    {evs.slice(0, 3).map((ev) => (
                      <EventPill key={ev.id} ev={ev} compact onClick={() => setSelected(ev)} />
                    ))}
                    {evs.length > 3 && (
                      <p className="px-1 text-[9px] font-medium text-[#5c697e]">+{evs.length - 3} mais</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && mode === 'week' && (
        <div className="card overflow-hidden p-2">
          <div className="grid grid-cols-7 gap-px">
            {weekDays.map((d) => (
              <div key={ymd(d)} className="px-2 pb-1 pt-2 text-center">
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${ymd(d) === todayStr ? 'text-[#25b946]' : 'text-[#5c697e]'}`}>
                  {DAYS_PT[d.getDay()]}
                </span>
                <p className={`mt-0.5 font-display text-[15px] font-semibold ${ymd(d) === todayStr ? 'text-white' : 'text-[#9aa4b8]'}`}>{d.getDate()}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {weekDays.map((d) => {
              const key = ymd(d)
              const evs = byDay[key] || []
              return (
                <div key={key} className={`min-h-[150px] border border-[#232b3c]/70 p-1.5 ${key === todayStr ? 'bg-[#25b946]/[0.04]' : 'bg-[#12161f]'}`}>
                  <div className="space-y-1.5">
                    {evs.map((ev) => (
                      <EventPill key={ev.id} ev={ev} onClick={() => setSelected(ev)} />
                    ))}
                    {evs.length === 0 && <p className="text-[10px] text-[#3a4354]">—</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && mode === 'day' && (
        <div className="card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 size={14} className="text-[#25b946]" />
            <h2 className="font-display text-[14px] font-semibold tracking-wide capitalize">{title}</h2>
          </div>
          <div className="space-y-2">
            {(byDay[ymd(focus)] || []).length === 0 && <p className="text-[13px] text-[#5c697e]">Nenhuma publicação neste dia.</p>}
            {(byDay[ymd(focus)] || []).map((ev) => (
              <DayRow key={ev.id} ev={ev} onClick={() => setSelected(ev)} />
            ))}
          </div>
        </div>
      )}

      {selected && <EventModal ev={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function DayRow({ ev, onClick }: { ev: CalEvent; onClick: () => void }) {
  const st = STATUS_STYLE[ev.status]
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#232b3c] bg-[#12161f] px-3 py-2.5 text-left transition-colors hover:border-[#2c3850]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-mono2 w-11 shrink-0 text-[12px] text-[#9aa4b8]">{ev.time}</span>
        <EnvIcon env={ev.env} size={14} />
        <span className="font-mono2 truncate text-[12px] font-semibold">{ev.filename}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {ev.platforms.slice(0, 4).map((p) => (
          <span key={p.key} className={`h-1.5 w-1.5 rounded-full ${p.done ? 'bg-[#34d399]' : 'bg-[#2c3850]'}`} title={p.label} />
        ))}
        <span className={`badge ${st.badge}`}>{st.label}</span>
      </div>
    </button>
  )
}

function EventModal({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const st = STATUS_STYLE[ev.status]
  const thumbUrl = `/api/studio/thumb?env=${ev.env}&file=${encodeURIComponent(ev.filename)}`
  const videoUrl = `/api/studio/video?env=${ev.env}&file=${encodeURIComponent(ev.filename)}`
  const [thumbOk, setThumbOk] = useState(true)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="card w-full max-w-lg overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#232b3c] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <EnvIcon env={ev.env} size={16} />
            <span className="font-display text-[14px] font-semibold">{ev.env === 'futebol' ? 'Futebol' : 'Motivação'}</span>
            <span className={`badge ${st.badge}`}>{st.label}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex gap-4">
            <div className="flex h-36 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#232b3c] bg-[#0f1220]">
              {thumbOk ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt="" className="h-full w-full object-cover" onError={() => setThumbOk(false)} />
              ) : (
                <VideoIcon size={20} className="text-[#3a4354]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-mono2 text-[14px] font-semibold">{ev.filename}</p>
              <p className="mt-1 text-[12px] text-[#9aa4b8]">
                {new Date(`${ev.date}T12:00:00`).toLocaleDateString('pt-BR')} · {ev.time}
              </p>
              {ev.error && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-[#f87171]/25 bg-[#f87171]/10 p-2 text-[11px] text-[#fda4af]">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                  {ev.error}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <p className="eyebrow mb-2">Status por plataforma</p>
            <div className="space-y-1.5">
              {ev.platforms.map((p) => (
                <div key={p.key} className="flex items-center justify-between rounded-lg border border-[#232b3c] bg-[#12161f] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.done ? 'bg-[#34d399]' : 'bg-[#2c3850]'}`} />
                    <span className="text-[12px] font-medium">{p.label}</span>
                  </div>
                  {p.done ? (
                    <span className="flex items-center gap-1 text-[11px] text-[#34d399]">
                      <CircleCheck size={11} />
                      {p.date ? new Date(p.date).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'ok'}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#5c697e]">aguardando</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <a className="btn btn-sm flex-1" href={videoUrl} target="_blank" rel="noreferrer">
              <VideoIcon size={12} />
              Reproduzir vídeo
            </a>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}