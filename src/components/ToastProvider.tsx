'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, TriangleAlert, Info, Loader2 } from 'lucide-react'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info' | 'loading'
  title: string
  description?: string
  video?: string
  leaving?: boolean
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue>({ push: () => {} })

export const useToasts = () => useContext(ToastContext)

const KINDS = {
  success: { icon: CircleCheck, accent: '#34d399', tint: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.34)' },
  error: { icon: TriangleAlert, accent: '#f87171', tint: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.34)' },
  info: { icon: Info, accent: '#38bdf8', tint: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.34)' },
  loading: { icon: Loader2, accent: '#ffb545', tint: 'rgba(255,181,69,0.12)', border: 'rgba(255,181,69,0.34)' },
}

let uid = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 250)
  }, [])

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `t${Date.now()}-${uid++}`
      setToasts((prev) => [...prev.slice(-4), { ...toast, id }])
      timeouts.current[id] = setTimeout(() => remove(id), 5000)
    },
    [remove]
  )

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => {
          const k = KINDS[t.kind]
          const Icon = k.icon
          return (
            <div
              key={t.id}
              className={`animate-toast-in pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 shadow-xl shadow-black/50 backdrop-blur-md ${
                t.leaving ? 'animate-toast-out' : ''
              }`}
              style={{
                background: 'linear-gradient(145deg, rgba(17,23,37,0.97), rgba(11,14,21,0.97))',
                borderColor: k.border,
              }}
              onMouseEnter={() => {
                if (timeouts.current[t.id]) clearTimeout(timeouts.current[t.id])
              }}
              onMouseLeave={() => {
                timeouts.current[t.id] = setTimeout(() => remove(t.id), 2000)
              }}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                style={{ background: k.tint, color: k.accent }}
              >
                <Icon size={18} className={t.kind === 'loading' ? 'animate-spin' : ''} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[13.5px] font-bold text-white">{t.title}</p>
                {t.description && <p className="mt-0.5 truncate text-xs text-white/55">{t.description}</p>}
              </div>
              {!t.leaving && t.kind !== 'loading' && (
                <span
                  className="absolute inset-x-0 bottom-0 h-[3px] origin-left"
                  style={{ background: k.accent, animation: 'toastBar 5s linear forwards' }}
                />
              )}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}