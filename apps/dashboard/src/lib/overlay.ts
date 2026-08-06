import { prisma } from '@/lib/prisma'

// Helper to build the public stream URL for an overlay.
export function overlayUrl(key: string) {
  return `/api/videos/stream/postreels-overlays/${key}`
}

/**
 * Resolve qual overlay deve ser usada para um vídeo.
 * Hierarquia:
 *   1. overlay escolhida manualmente no editor (EditConfig.overlayId)
 *   2. overlay padrão do perfil (Profile.overlayId)
 *   3. overlay padrão do nicho (Overlay.isDefault && nicheId === video.nicheId)
 *   4. overlay global (nicheId === null) mais recente
 *   5. fallback: qualquer overlay mais recente (dados antigos sem nicho)
 */
export async function resolveOverlayForVideo(video: {
  nicheId: string
  profileId: string | null
  editConfigs?: { overlayId?: string | null } | null
}) {
  // 1. overlay escolhida no editor
  if (video.editConfigs?.overlayId) {
    const chosen = await prisma.overlay.findUnique({ where: { id: video.editConfigs.overlayId } })
    if (chosen) return chosen
  }

  // 2. overlay padrão do perfil
  if (video.profileId) {
    const profile = await prisma.profile.findUnique({
      where: { id: video.profileId },
      select: { overlayId: true },
    })
    if (profile?.overlayId) {
      const po = await prisma.overlay.findUnique({ where: { id: profile.overlayId } })
      if (po) return po
    }
  }

  // 3. overlay padrão do nicho
  const nicheDefault = await prisma.overlay.findFirst({
    where: { nicheId: video.nicheId, isDefault: true },
    orderBy: { createdAt: 'desc' },
  })
  if (nicheDefault) return nicheDefault

  // 4. overlay global mais recente
  const globalOverlay = await prisma.overlay.findFirst({
    where: { nicheId: null },
    orderBy: { createdAt: 'desc' },
  })
  if (globalOverlay) return globalOverlay

  // 5. fallback: qualquer overlay mais recente
  return (await prisma.overlay.findFirst({ orderBy: { createdAt: 'desc' } })) || null
}