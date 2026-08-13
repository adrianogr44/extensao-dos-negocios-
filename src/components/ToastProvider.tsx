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
  success: { icon: CircleCheck, color: 'text-[#34d399]', bg: 'bg-[#34d399]/10', border: 'border-[#34d399]/30' },
  error: { icon: TriangleAlert, color: 'text-[#f87171]', bg: 'bg-[#f87171]/10', border: 'border-[#f87171]/30' },
  info: { icon: Info, color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10', border: 'border-[#38bdf8]/30' },
  loading: { icon: Loader2, color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/10', border: 'border-[#fbbf24]/30' },
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
              className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border ${k.border} ${k.bg} p-3.5 shadow-xl shadow-black/40 backdrop-blur-md ${
                t.leaving ? 'animate-toast-out' : ''
              }`}
              onMouseEnter={() => {
                if (timeouts.current[t.id]) clearTimeout(timeouts.current[t.id])
              }}
              onMouseLeave={() => {
                timeouts.current[t.id] = setTimeout(() => remove(t.id), 2000)
              }}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${k.color} ${t.kind === 'loading' ? 'animate-spin' : ''}`} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">{t.title}</p>
                {t.description && <p className="mt-0.5 truncate text-xs text-white/60">{t.description}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}