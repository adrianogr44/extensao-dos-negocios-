import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const publications = await prisma.publication.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        metaAccount: {
          select: {
            id: true,
            pageName: true,
            facebookPageId: true,
          },
        },
      },
    });

    return Response.json({
      total: publications.length,
      publications: publications.map((pub) => ({
        id: pub.id,
        status: pub.status,
        createdAt: pub.createdAt,
        publishedAt: pub.publishedAt,
        metaPostId: pub.metaPostId,
        errorMessage: pub.errorMessage,
        metaAccount: pub.metaAccount?.pageName,
      })),
    });
  } catch (error) {
    console.error('[status] Error:', error);
    return Response.json({ error: 'Failed to fetch publications' }, { status: 500 });
  }
}
