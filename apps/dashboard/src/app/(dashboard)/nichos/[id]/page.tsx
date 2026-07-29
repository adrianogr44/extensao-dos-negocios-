import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Platform } from '@prisma/client'

const platformMeta: Record<Platform, { label: string, color: string }> = {
  INSTAGRAM: { label: 'IG', color: '#e1306c' },
  FACEBOOK: { label: 'FB', color: '#1877f2' },
  YOUTUBE: { label: 'YT', color: '#ff4e50' },
}

interface PageProps {
  params: { id: string }
}

export default async function NicheProfilesPage({ params }: PageProps) {
  const niche = await prisma.niche.findUnique({
    where: { id: params.id },
    include: {
      profiles: {
        include: { _count: { select: { videos: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!niche) notFound()

  const totalVideos = niche.profiles.reduce((sum, p) => sum + p._count.videos, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: niche.cor || '#0ea5e9' }} />
        <h1 className="text-2xl font-bold">{niche.nome}</h1>
        <span className="text-sm text-zinc-400">{totalVideos} vídeos</span>
      </div>

      {niche.profiles.length === 0 && (
        <p className="text-sm text-zinc-500 italic">Nenhum perfil vinculado a este nicho ainda.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {niche.profiles.map(profile => (
          <Link key={profile.id}
            href={`/nichos/${niche.id}/perfil/${profile.id}`}
            className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
          >
            <div className="flex items-center gap-4">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt=""
                  className="h-14 w-14 shrink-0 rounded-full border border-zinc-700 object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-lg text-zinc-500">
                  {profile.username[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-200">{profile.fullName || profile.username}</p>
                <p className="truncate text-sm text-zinc-500">@{profile.username}</p>
                <p className="mt-1 text-xs text-zinc-400">{profile._count.videos} vídeos</p>
              </div>
              <div className="ml-auto shrink-0">
                <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: platformMeta[profile.platform]?.color || '#666' }}>
                  {platformMeta[profile.platform]?.label || profile.platform.slice(0, 2)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
