import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const nichoId = params.id;

    // Validar que nicho existe
    const niche = await prisma.niche.findUnique({
      where: { id: nichoId },
    });

    if (!niche) {
      return NextResponse.json({ error: 'Nicho não encontrado' }, { status: 404 });
    }

    // Buscar todos os perfis associados a este nicho
    const profiles = await prisma.profile.findMany({
      where: { nicheId: nichoId },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        platform: true,
        _count: {
          select: {
            videos: true,
          },
        },
      },
      orderBy: { username: 'asc' },
    });

    return NextResponse.json(
      profiles.map((p) => ({
        id: p.id,
        username: p.username,
        fullName: p.fullName,
        avatarUrl: p.avatarUrl,
        platform: p.platform,
        videoCount: p._count.videos,
      })),
    );
  } catch (error) {
    console.error('[nichos/[id]/profiles]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
