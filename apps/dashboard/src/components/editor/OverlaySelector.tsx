'use client'

export interface OverlayOption {
  id: string
  filename: string
  url: string
  isDefault: boolean
  nicheId: string | null
  createdAt?: string
}

interface OverlaySelectorProps {
  overlays: OverlayOption[]
  selectedOverlayId: string | null
  onSelect: (overlayId: string | null) => void
}

export function OverlaySelector({ overlays, selectedOverlayId, onSelect }: OverlaySelectorProps) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`rounded border px-3 py-1.5 text-xs transition-colors ${
            selectedOverlayId === null
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
          }`}
        >
          Automático
        </button>
        {overlays.map(ov => (
          <button
            key={ov.id}
            onClick={() => onSelect(ov.id)}
            className={`group relative overflow-hidden rounded border transition-colors ${
              selectedOverlayId === ov.id
                ? 'border-primary ring-1 ring-primary'
                : 'border-zinc-700 hover:border-zinc-500'
            }`}
            title={ov.filename}
            style={{ width: 64, height: 64 }}
          >
            <img src={ov.url} alt={ov.filename} className="h-full w-full object-cover" />
            {ov.isDefault && (
              <span className="absolute bottom-0 right-0 rounded-tl bg-blue-600/90 px-1 text-[9px] font-bold text-white">
                padrão
              </span>
            )}
            {ov.nicheId === null && (
              <span className="absolute left-0 top-0 rounded-br bg-zinc-700/80 px-1 text-[9px] text-zinc-300">
                global
              </span>
            )}
          </button>
        ))}
      </div>
      {overlays.length === 0 && (
        <p className="text-[11px] italic text-zinc-600">
          Nenhuma overlay para este nicho. Adicione em Nichos &gt; este nicho.
        </p>
      )}
    </div>
  )
}