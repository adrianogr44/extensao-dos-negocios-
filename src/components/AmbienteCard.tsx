'use client'

export interface AmbienteCardProps {
  emoji: string
  nome: string
  cor: string
  chromeProfile: string
  porta: string
  pastaVideos: string
  plataformas: string[]
  kwai: string
  queue: string
  lock: string
  debug: string
  horarios: string[]
  timezone: string
}

function Linha({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-zinc-800/60 last:border-b-0">
      <span className="text-sm text-zinc-400 shrink-0">{label}</span>
      <span
        className={`text-right text-sm ${mono ? 'font-mono text-xs text-zinc-200 break-all' : 'text-zinc-200'}`}
        title={valor}
      >
        {valor}
      </span>
    </div>
  )
}

export function AmbienteCard(props: AmbienteCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{props.emoji}</span>
        <h3 className={`text-lg font-bold ${props.cor}`}>{props.nome}</h3>
      </div>

      <div className="divide-y divide-zinc-800">
        <Linha label="Chrome Profile" valor={props.chromeProfile} mono />
        <Linha label="Porta CDP" valor={props.porta} mono />
        <Linha label="Pasta de vídeos" valor={props.pastaVideos} mono />
        <Linha label="Queue" valor={props.queue} mono />
        <Linha label="Lock" valor={props.lock} mono />
        <Linha label="Debug" valor={props.debug} mono />
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <span className="text-sm text-zinc-400">Plataformas</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {props.plataformas.map((p) => (
              <span
                key={p}
                className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-200"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-400">Kwai</span>
          <span className={`text-sm ${props.kwai === 'Desativado' ? 'text-red-400' : 'text-zinc-200'}`}>
            {props.kwai}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-400">Scheduler</span>
          <span className="text-sm text-zinc-200">{props.horarios.join(' / ')}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-400">Timezone</span>
          <span className="text-sm text-zinc-200">{props.timezone}</span>
        </div>
      </div>
    </div>
  )
}