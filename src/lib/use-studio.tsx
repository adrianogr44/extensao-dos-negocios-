'use client'

import { useEffect, useRef, useState } from 'react'
import { StudioData, EMPTY_STUDIO } from '@/lib/studio-types'
import { useToasts } from '@/components/ToastProvider'

export function useStudio(intervalMs = 7000) {
  const [data, setData] = useState<StudioData>(EMPTY_STUDIO)
  const [loading, setLoading] = useState(true)
  const prevRef = useRef<StudioData | null>(null)
  const seenDone = useRef(new Set<string>())
  const seenErrors = useRef(new Set<string>())
  const seenProcessing = useRef(new Set<string>())
  const { push } = useToasts()

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null

    async function tick() {
      try {
        const res = await fetch('/api/studio', { cache: 'no-store' })
        if (!res.ok) return
        const next: StudioData = await res.json()
        if (!alive) return
        setData(next)
        setLoading(false)

        const prev = prevRef.current
        if (prev) {
          const prevMap = new Map<string, Set<string>>()
          for (const env of prev.environments) {
            for (const v of env.videos) {
              prevMap.set(`${env.id}:${v.filename}`, new Set(v.platforms.filter((p) => p.done).map((p) => p.key)))
            }
          }

          for (const env of next.environments) {
            const wasProcessing = prev.environments.find((e) => e.id === env.id)?.processing
            if (env.processing && !wasProcessing) {
              const pkey = `${env.id}:processing`
              if (!seenProcessing.current.has(pkey)) {
                seenProcessing.current.add(pkey)
                push({ kind: 'loading', title: 'Publicação iniciada', description: `Processando ${env.nome}…` })
              }
            }

            for (const v of env.videos) {
              const prevSet = prevMap.get(`${env.id}:${v.filename}`) ?? new Set<string>()
              for (const p of v.platforms) {
                if (!p.done || prevSet.has(p.key)) continue
                const key = `done:${env.id}:${v.filename}:${p.key}`
                if (seenDone.current.has(key)) continue
                seenDone.current.add(key)
                push({
                  kind: 'success',
                  title: 'Vídeo publicado',
                  description: `${v.filename} publicado no ${p.label} · ${env.nome}`,
                })
              }
              if (v.status === 'erro' && v.error) {
                const ekey = `err:${env.id}:${v.filename}:${v.error}`
                if (!seenErrors.current.has(ekey)) {
                  seenErrors.current.add(ekey)
                  push({ kind: 'error', title: 'Erro na publicação', description: `${v.filename}: ${v.error.slice(0, 90)} · ${env.nome}` })
                }
              }
            }
          }
        } else {
          for (const env of next.environments) {
            for (const v of env.videos) {
              for (const p of v.platforms) {
                if (p.done) seenDone.current.add(`done:${env.id}:${v.filename}:${p.key}`)
              }
              if (v.error) seenErrors.current.add(`err:${env.id}:${v.filename}:${v.error}`)
            }
          }
        }
        prevRef.current = next
      } catch {
        /* servidor indisponível — mantém último dado */
      }
    }

    tick()
    timer = setInterval(tick, intervalMs)
    return () => {
      alive = false
      if (timer) clearInterval(timer)
    }
  }, [intervalMs, push])

  return { data, loading }
}