import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const batchScheduleSchema = z.object({
  videoIds: z.array(z.string()).min(1),
  metaAccountId: z.string().optional(),
  tiktokAccountId: z.string().optional(),
  youtubeAccountId: z.string().optional(),
  description: z.string().max(2200),
  hashtags: z.array(z.string()).optional(),
  platforms: z.array(z.enum(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE'])).min(1),
  scheduleTimes: z.array(z.string().datetime()),
  method: z.enum(['API', 'SCRAPE']).default('API'),
});

type BatchSchedulePayload = z.infer<typeof batchScheduleSchema>;

/**
 * POST /api/meta/publications/batch
 * Agenda múltiplos vídeos de uma vez
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar payload
    const validated = batchScheduleSchema.parse(body);

    // Validar que temos o mesmo número de vídeos e horários
    if (validated.videoIds.length !== validated.scheduleTimes.length) {
      return Response.json(
        {
          error: 'Número de vídeos e horários deve ser igual',
        },
        { status: 400 },
      );
    }

    // Validar que pelo menos uma conta foi informada conforme as plataformas
    const requiresMeta = validated.platforms.some(p => p === 'FACEBOOK' || p === 'INSTAGRAM');
    const requiresTikTok = validated.platforms.includes('TIKTOK');
    const requiresYouTube = validated.platforms.includes('YOUTUBE');

    if (requiresMeta && !validated.metaAccountId) {
      return Response.json({ error: 'Selecione uma conta Meta (Facebook/Instagram)' }, { status: 400 });
    }
    if (requiresTikTok && !validated.tiktokAccountId) {
      return Response.json({ error: 'Selecione uma conta TikTok' }, { status: 400 });
    }
    if (requiresYouTube && !validated.youtubeAccountId) {
      return Response.json({ error: 'Selecione uma conta YouTube' }, { status: 400 });
    }

    // Validar que meta account existe
    if (validated.metaAccountId) {
      const metaAccount = await prisma.metaAccount.findUnique({
        where: { id: validated.metaAccountId },
      });

      if (!metaAccount) {
        return Response.json(
          { error: 'Meta account não encontrado' },
          { status: 404 },
        );
      }
    }

    // Validar que tiktok account existe
    if (validated.tiktokAccountId) {
      const ttAccount = await prisma.tiktokAccount.findUnique({
        where: { id: validated.tiktokAccountId },
      });
      if (!ttAccount) {
        return Response.json({ error: 'Conta TikTok não encontrada' }, { status: 404 });
      }
    }

    // Validar que youtube account existe
    if (validated.youtubeAccountId) {
      const ytAccount = await prisma.youtubeAccount.findUnique({
        where: { id: validated.youtubeAccountId },
      });
      if (!ytAccount) {
        return Response.json({ error: 'Conta YouTube não encontrada' }, { status: 404 });
      }
    }

    // Validar que todos os vídeos existem e estão completos
    const videos = await prisma.video.findMany({
      where: {
        id: {
          in: validated.videoIds,
        },
      },
    });

    if (videos.length !== validated.videoIds.length) {
      return Response.json(
        {
          error: `${validated.videoIds.length - videos.length} vídeo(s) não encontrado(s)`,
        },
        { status: 400 },
      );
    }

    const incompleteVideos = videos.filter((v) => v.status !== 'completed');
    if (incompleteVideos.length > 0) {
      return Response.json(
        {
          error: `${incompleteVideos.length} vídeo(s) não está(ão) completo(s)`,
        },
        { status: 400 },
      );
    }

    console.log(
      `[meta/publications/batch] Scheduling ${validated.videoIds.length} videos for account ${validated.metaAccountId}`,
    );

    // Criar publicações
    const publications = await Promise.all(
      validated.videoIds.map((videoId, index) => {
        const hashtags = validated.hashtags || [];
        return prisma.publication.create({
          data: {
            videoId,
            metaAccountId: validated.metaAccountId || null,
            tiktokAccountId: validated.tiktokAccountId || null,
            youtubeAccountId: validated.youtubeAccountId || null,
            description: validated.description,
            hashtags: JSON.stringify(hashtags),
            platforms: validated.platforms,
            scheduledFor: new Date(validated.scheduleTimes[index]),
            status: 'SCHEDULED',
            method: validated.method,
          },
        });
      }),
    );

    // Criar logs
    await Promise.all(
      publications.map((pub) =>
        prisma.publicationLog.create({
          data: {
            publicationId: pub.id,
            action: 'SCHEDULED',
            metaResponse: JSON.stringify({
              videoId: pub.videoId,
              scheduledFor: pub.scheduledFor,
            }),
          },
        }),
      ),
    );

    console.log(
      `[meta/publications/batch] Successfully scheduled ${publications.length} publications`,
    );

    return Response.json(
      {
        message: `${publications.length} publicações agendadas com sucesso`,
        count: publications.length,
        publications: publications.map((p) => ({
          id: p.id,
          videoId: p.videoId,
          scheduledFor: p.scheduledFor,
          status: p.status,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[meta/publications/batch]', error);

    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: 'Validação falhou',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
