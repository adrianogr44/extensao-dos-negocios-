import { prisma } from '@/lib/prisma';

/**
 * GET /api/meta/publications/[id]
 * Obter detalhes de uma publicação
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const publication = await prisma.publication.findUnique({
      where: { id: params.id },
      include: {
        metaAccount: true,
        template: true,
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!publication) {
      return Response.json({ error: 'Publication not found' }, { status: 404 });
    }

    return Response.json({
      id: publication.id,
      videoId: publication.videoId,
      description: publication.description,
      hashtags: JSON.parse(publication.hashtags),
      platforms: publication.platforms,
      scheduledFor: publication.scheduledFor,
      publishedAt: publication.publishedAt,
      status: publication.status,
      metaPostId: publication.metaPostId,
      errorMessage: publication.errorMessage,
      metaAccount: publication.metaAccount,
      template: publication.template,
      logs: publication.logs,
    });
  } catch (error) {
    console.error('[meta/publications/[id] GET]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/meta/publications/[id]
 * Atualizar uma publicação
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();

    // Validar se publicação pode ser editada
    const publication = await prisma.publication.findUnique({
      where: { id: params.id },
    });

    if (!publication) {
      return Response.json({ error: 'Publication not found' }, { status: 404 });
    }

    if (!['DRAFT', 'SCHEDULED'].includes(publication.status)) {
      return Response.json(
        { error: `Cannot edit ${publication.status} publications` },
        { status: 409 },
      );
    }

    // Atualizar
    const updated = await prisma.publication.update({
      where: { id: params.id },
      data: {
        description: body.description || publication.description,
        hashtags: body.hashtags
          ? JSON.stringify(body.hashtags)
          : publication.hashtags,
        platforms: body.platforms || publication.platforms,
        scheduledFor: body.scheduledFor
          ? new Date(body.scheduledFor)
          : publication.scheduledFor,
      },
    });

    return Response.json({
      id: updated.id,
      status: updated.status,
      scheduledFor: updated.scheduledFor,
    });
  } catch (error) {
    console.error('[meta/publications/[id] PATCH]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/meta/publications/[id]
 * Deletar uma publicação
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const publication = await prisma.publication.findUnique({
      where: { id: params.id },
    });

    if (!publication) {
      return Response.json({ error: 'Publication not found' }, { status: 404 });
    }

    // Validar status
    if (publication.status === 'PUBLISHED') {
      return Response.json(
        { error: 'Cannot delete published publications' },
        { status: 409 },
      );
    }

    // Deletar logs primeiro (cascata)
    await prisma.publicationLog.deleteMany({
      where: { publicationId: params.id },
    });

    // Deletar publicação
    await prisma.publication.delete({
      where: { id: params.id },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[meta/publications/[id] DELETE]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
