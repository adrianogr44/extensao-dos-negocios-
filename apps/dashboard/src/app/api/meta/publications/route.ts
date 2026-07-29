import { prisma } from '@/lib/prisma';
import { PublicationDTO } from '@/lib/meta/types';

/**
 * GET /api/meta/publications?status=SCHEDULED&page=1&limit=20
 * Listar publicações com filtros
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const metaAccountId = searchParams.get('metaAccountId');

    const skip = (page - 1) * limit;

    // Construir filtro
    const where: any = {};
    if (status) where.status = status;
    if (metaAccountId) where.metaAccountId = metaAccountId;

    // Buscar publicações com vídeo
    const [publications, total] = await Promise.all([
      prisma.publication.findMany({
        where,
        orderBy: { scheduledFor: 'desc' },
        skip,
        take: limit,
        include: {
          metaAccount: {
            select: {
              id: true,
              pageName: true,
              profilePictureUrl: true,
            },
          },
        },
      }),
      prisma.publication.count({ where }),
    ]);

    // Buscar thumbnails dos vídeos
    const videoIds = publications.map((p) => p.videoId);
    const videos = await prisma.video.findMany({
      where: { id: { in: videoIds } },
      select: { id: true, thumbnail: true },
    });

    const videoMap = new Map(videos.map((v) => [v.id, v.thumbnail]));

    // Converter para DTOs
    const dtos = publications.map((pub) => ({
      id: pub.id,
      videoId: pub.videoId,
      description: pub.description,
      hashtags: JSON.parse(pub.hashtags),
      platforms: pub.platforms as any,
      scheduledFor: pub.scheduledFor,
      status: pub.status as any,
      metaPostId: pub.metaPostId || undefined,
      publishedAt: pub.publishedAt || undefined,
      thumbnail: videoMap.get(pub.videoId) || undefined,
    }));

    return Response.json(
      {
        data: dtos,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[meta/publications GET]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
