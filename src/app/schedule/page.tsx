'use client'

import { useEffect, useState } from 'react'

interface ScheduleConfig {
  enabled: boolean
  timesPerDay: number
  intervalMinutes: number
  startTime: string
  endTime: string
  daysOfWeek: number[]
}

const DAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
]

export default function SchedulePage() {
  const [config, setConfig] = useState<ScheduleConfig>({
    enabled: false,
    timesPerDay: 5,
    intervalMinutes: 60,
    startTime: '08:00',
    endTime: '18:00',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/schedule')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
  }

  function toggleDay(day: number) {
    setConfig((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agendamento</h1>

      <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="h-5 w-5 rounded border-zinc-600 bg-zinc-800 text-purple-600"
          />
          <span>Agendamento ativo</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-zinc-400">Vídeos por dia</label>
            <input
              type="number"
              min={1}
              max={50}
              value={config.timesPerDay}
              onChange={(e) => setConfig({ ...config, timesPerDay: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400">Intervalo (minutos)</label>
            <input
              type="number"
              min={1}
              value={config.intervalMinutes}
              onChange={(e) => setConfig({ ...config, intervalMinutes: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400">Início</label>
            <input
              type="time"
              value={config.startTime}
              onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400">Fim</label>
            <input
              type="time"
              value={config.endTime}
              onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400">Dias da semana</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  config.daysOfWeek.includes(day.value)
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar agendamento'}
        </button>
      </div>
    </div>
  )
}
