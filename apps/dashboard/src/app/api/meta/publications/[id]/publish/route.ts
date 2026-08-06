import { prisma } from '@/lib/prisma';
import { createMetaClient } from '@/lib/meta/client';
import { resolveVideoUrl } from '@/lib/meta/video-resolver';
import { decryptToken } from '@/lib/meta/encryption';

/**
 * POST /api/meta/publications/[id]/publish
 * Publicar imediatamente (não aguardar agendamento)
 * Usa App Access Token do servidor para evitar expiração de token do usuário
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const publicationId = params.id;

  try {
    const publication = await prisma.publication.findUnique({
      where: { id: publicationId },
      include: { metaAccount: true },
    });

    if (!publication) {
      return Response.json({ error: 'Publication not found' }, { status: 404 });
    }

    // Este endpoint é apenas para o método API da Meta
    if (publication.method !== 'API' || !publication.metaAccount) {
      return Response.json(
        { error: 'Esta publicação não usa a API da Meta (método SCRAPE ou conta não-Meta)' },
        { status: 400 },
      );
    }

    // Validar status
    if (!['DRAFT', 'SCHEDULED'].includes(publication.status)) {
      return Response.json(
        { error: `Cannot publish ${publication.status} publications. Only DRAFT or SCHEDULED can be published.` },
        { status: 409 },
      );
    }

    // Descriptografar token
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('TOKEN_ENCRYPTION_KEY not configured');
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(publication.metaAccount.accessToken, encryptionKey);
    } catch (error) {
      console.error('[meta/publications/[id]/publish] Failed to decrypt token:', error);
      throw new Error('Failed to decrypt access token');
    }

    if (!accessToken) {
      throw new Error('User access token not found');
    }

    console.log(`[meta/publications/[id]/publish] Publishing ${publicationId}`);

    // Buscar URL do vídeo
    console.log(`[meta/publications/[id]/publish] Resolving video URL for ${publication.videoId}`);
    const videoUrl = await resolveVideoUrl(publication.videoId);

    if (!videoUrl) {
      throw new Error('Failed to resolve video URL');
    }

    // Preparar descrição com hashtags
    const hashtags = publication.hashtags
      ? JSON.parse(publication.hashtags).join(' ')
      : '';
    const description = `${publication.description}${hashtags ? '\n\n' + hashtags : ''}`;

    // Publicar na Meta
    const client = createMetaClient();
    const metaPostIds: Record<string, string> = {};

    // Publicar no Facebook
    if (publication.platforms.includes('FACEBOOK')) {
      console.log(`[meta/publications/[id]/publish] Publishing to Facebook page ${publication.metaAccount.facebookPageId}`);
      try {
        const fbResponse = await client.publishToFacebookFeed(
          publication.metaAccount.facebookPageId,
          accessToken,
          videoUrl,
          description,
        );
        metaPostIds.facebook = fbResponse.id;
        console.log(`[meta/publications/[id]/publish] Facebook published: ${fbResponse.id}`);
      } catch (error) {
        console.error(`[meta/publications/[id]/publish] Facebook error:`, error);
        throw error;
      }
    }

    // Publicar no Instagram
    if (publication.platforms.includes('INSTAGRAM')) {
      if (!publication.metaAccount.instagramAccountId) {
        console.warn(`[meta/publications/[id]/publish] Instagram account not linked for ${publicationId}`);
      } else {
        console.log(`[meta/publications/[id]/publish] Publishing to Instagram account ${publication.metaAccount.instagramAccountId}`);
        try {
          const igResponse = await client.publishToInstagram(
            publication.metaAccount.instagramAccountId,
            accessToken,
            videoUrl,
            description,
          );
          metaPostIds.instagram = igResponse.id;
          console.log(`[meta/publications/[id]/publish] Instagram published: ${igResponse.id}`);
        } catch (error) {
          console.error(`[meta/publications/[id]/publish] Instagram error:`, error);
          throw error;
        }
      }
    }

    // Atualizar publicação com sucesso
    const updated = await prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        metaPostId: metaPostIds.facebook || metaPostIds.instagram || '',
      },
    });

    // Log de sucesso
    await prisma.publicationLog.create({
      data: {
        publicationId: publicationId,
        action: 'PUBLISHED',
        metaResponse: JSON.stringify(metaPostIds),
      },
    });

    console.log(`[meta/publications/[id]/publish] Success: ${publicationId}`);

    return Response.json({
      id: updated.id,
      status: updated.status,
      publishedAt: updated.publishedAt,
      metaPostIds,
    });
  } catch (error) {
    console.error(`[meta/publications/[id]/publish] Error publishing ${publicationId}:`, error);

    let errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Se for erro de permissão, adicionar instruções
    if (errorMessage.includes('pages_read_engagement') || errorMessage.includes('pages_manage_posts')) {
      errorMessage = 'Seu app não foi aprovado para publicar. Você precisa: 1) Ir a App Review do Facebook, 2) Solicitar as permissões de publicação, OU 3) Usar uma conta de teste do Facebook.';
    }

    const errorCode =
      error instanceof Error && 'code' in error ? (error as any).code : 'PUBLISH_ERROR';

    // Extrair código de erro da Meta API se disponível
    let metaErrorCode: string | undefined;
    if (error instanceof Error && error.message.includes('error_code')) {
      const match = error.message.match(/error_code[:\s]+(\d+)/);
      metaErrorCode = match ? match[1] : undefined;
    }

    // Registrar erro no log
    try {
      await prisma.publicationLog.create({
        data: {
          publicationId,
          action: 'FAILED',
          metaResponse: JSON.stringify({
            error: errorMessage,
            code: metaErrorCode || errorCode,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // Atualizar status com retry logic
      await prisma.publication.update({
        where: { id: publicationId },
        data: {
          status: 'FAILED',
          errorMessage: errorMessage,
          errorCode: metaErrorCode || errorCode,
          retryCount: {
            increment: 1,
          },
          lastRetryAt: new Date(),
        },
      });
    } catch (dbError) {
      console.error(`[meta/publications/[id]/publish] Database error:`, dbError);
    }

    return Response.json(
      {
        error: errorMessage,
        code: metaErrorCode || errorCode,
        retryable: !errorMessage.includes('Video não encontrado'),
      },
      { status: 500 },
    );
  }
}
