import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
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

    const body = await request.json();
    const { username, fullName, avatarUrl, platform = 'INSTAGRAM' } = body as {
      username?: string;
      fullName?: string;
      avatarUrl?: string;
      platform?: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE';
    };

    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username é obrigatório' }, { status: 400 });
    }

    if (!['INSTAGRAM', 'FACEBOOK', 'YOUTUBE'].includes(platform)) {
      return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 });
    }

    const cleanUsername = username.trim().replace(/^@/, '');

    const profile = await prisma.profile.upsert({
      where: { nicheId_platform_username: { nicheId: nichoId, platform, username: cleanUsername } },
      create: {
        username: cleanUsername,
        fullName: fullName?.trim() || null,
        avatarUrl: avatarUrl?.trim() || null,
        nicheId: nichoId,
        platform,
      },
      update: {},
    });

    return NextResponse.json(
      { success: true, data: profile },
      { status: 201 },
    );
  } catch (error) {
    console.error('[nichos/[id]/profiles] POST', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

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
