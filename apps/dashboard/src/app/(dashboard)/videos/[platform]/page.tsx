import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Platform } from '@prisma/client'

const platformMeta: Record<Platform, { label: string, gradient: string }> = {
  INSTAGRAM: { label: 'Instagram', gradient: 'from-pink-500 via-red-500 to-yellow-500' },
  FACEBOOK: { label: 'Facebook', gradient: 'from-blue-600 to-blue-400' },
  YOUTUBE: { label: 'YouTube', gradient: 'from-red-600 to-orange-500' },
}

interface PageProps {
  params: { platform: string }
}

export default async function PlatformNichesPage({ params }: PageProps) {
  const platform = params.platform.toUpperCase() as Platform
  if (!['INSTAGRAM', 'FACEBOOK', 'YOUTUBE'].includes(platform)) notFound()

  const meta = platformMeta[platform]

  const niches = await prisma.niche.findMany({
    where: {
      profiles: { some: { platform } },
    },
    include: {
      _count: { select: { videos: { where: { platform } } } },
      profiles: {
        where: { platform },
        select: { id: true, username: true, fullName: true, avatarUrl: true, _count: { select: { videos: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/videos" className="text-sm text-zinc-400 hover:text-zinc-200">Vídeos</Link>
        <span className="text-zinc-600">/</span>
        <div className={`h-3 w-3 rounded-full bg-gradient-to-br ${meta.gradient}`} />
        <h1 className="text-2xl font-bold">{meta.label}</h1>
        <span className="text-sm text-zinc-400">{niches.length} nichos</span>
      </div>

      {niches.length === 0 && (
        <p className="text-sm text-zinc-500 italic">
          Nenhum nicho com vídeos do {meta.label} ainda.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {niches.map(niche => {
          const platformVideos = niche._count.videos
          return (
            <Link
              key={niche.id}
              href={`/videos/${params.platform}/${niche.id}`}
              className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: niche.cor || '#0ea5e9' }} />
                  <h2 className="font-semibold text-zinc-200">{niche.nome}</h2>
                </div>
                <span className="text-sm text-zinc-500">{platformVideos} vídeos</span>
              </div>

              {niche.profiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {niche.profiles.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 rounded-md bg-zinc-800/50 px-2 py-1 text-xs text-zinc-400">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[8px] text-zinc-400">
                          {p.username[0]?.toUpperCase()}
                        </div>
                      )}
                      <span>@{p.username}</span>
                    </div>
                  ))}
                  {niche.profiles.length === 4 && (
                    <span className="text-xs text-zinc-600">...</span>
                  )}
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
