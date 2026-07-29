import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Platform } from '@prisma/client'

const platformMeta: Record<Platform, { label: string, desc: string, color: string, gradient: string }> = {
  INSTAGRAM: { label: 'Instagram', desc: 'Reels e vídeos do feed', color: '#e1306c', gradient: 'from-pink-500 via-red-500 to-yellow-500' },
  FACEBOOK: { label: 'Facebook', desc: 'Reels e vídeos do feed', color: '#1877f2', gradient: 'from-blue-600 to-blue-400' },
  YOUTUBE: { label: 'YouTube', desc: 'Shorts e vídeos do canal', color: '#ff4e50', gradient: 'from-red-600 to-orange-500' },
}

export default async function VideosPage() {
  const [videoGroups, profileGroups] = await Promise.all([
    prisma.video.groupBy({ by: ['platform'], _count: true }),
    prisma.profile.groupBy({ by: ['platform'], _count: true }),
  ])

  const videoCounts: Record<string, number> = {}
  videoGroups.forEach(g => { videoCounts[g.platform] = g._count })

  const profileCounts: Record<string, number> = {}
  profileGroups.forEach(g => { profileCounts[g.platform] = g._count })

  const platforms: Platform[] = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vídeos</h1>
        <p className="text-sm text-zinc-400">Selecione uma plataforma para navegar</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {platforms.map(p => {
          const meta = platformMeta[p]
          const vCount = videoCounts[p] || 0
          const pCount = profileCounts[p] || 0
          return (
            <Link
              key={p}
              href={`/videos/${p.toLowerCase()}`}
              className={`group relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br ${meta.gradient} p-6 transition-all hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white">{meta.label}</h2>
                <p className="mt-1 text-sm text-white/80">{meta.desc}</p>
                <div className="mt-4 flex gap-4">
                  <div className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white">
                    <span className="font-bold">{vCount}</span> vídeos
                  </div>
                  <div className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white">
                    <span className="font-bold">{pCount}</span> perfis
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
