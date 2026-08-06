import { prisma } from '@/lib/prisma';
import { ScheduleFormData, PublicationDTO } from '@/lib/meta/types';
import { z } from 'zod';

// Validação do payload
const SchedulePublicationSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  metaAccountId: z.string().optional(),
  tiktokAccountId: z.string().optional(),
  youtubeAccountId: z.string().optional(),
  description: z.string().min(1).max(2200),
  hashtags: z.array(z.string()).default([]),
  platforms: z.array(z.enum(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE'])).min(1),
  scheduledFor: z.string().datetime(),
  method: z.enum(['API', 'SCRAPE']).default('API'),
  templateId: z.string().optional(),
  saveAsTemplate: z.boolean().optional(),
  templateName: z.string().optional(),
});

type SchedulePublicationPayload = z.infer<typeof SchedulePublicationSchema>;

/**
 * POST /api/meta/publications/schedule
 * Agendar uma publicação
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar payload
    const data = SchedulePublicationSchema.parse(body);

    // Validar que pelo menos uma conta foi informada conforme as plataformas
    const requiresMeta = data.platforms.some(p => p === 'FACEBOOK' || p === 'INSTAGRAM');
    const requiresTikTok = data.platforms.includes('TIKTOK');
    const requiresYouTube = data.platforms.includes('YOUTUBE');

    if (requiresMeta && !data.metaAccountId) {
      return Response.json({ error: 'Selecione uma conta Meta (Facebook/Instagram)' }, { status: 400 });
    }
    if (requiresTikTok && !data.tiktokAccountId) {
      return Response.json({ error: 'Selecione uma conta TikTok' }, { status: 400 });
    }
    if (requiresYouTube && !data.youtubeAccountId) {
      return Response.json({ error: 'Selecione uma conta YouTube' }, { status: 400 });
    }

    // Validar se metaAccountId existe e está ativo
    if (data.metaAccountId) {
      const account = await prisma.metaAccount.findUnique({
        where: { id: data.metaAccountId },
      });

      if (!account || !account.isActive) {
        return Response.json(
          { error: 'Meta account not found or inactive' },
          { status: 404 },
        );
      }
    }

    // Validar se tiktokAccountId existe
    if (data.tiktokAccountId) {
      const ttAccount = await prisma.tiktokAccount.findUnique({
        where: { id: data.tiktokAccountId },
      });
      if (!ttAccount) {
        return Response.json({ error: 'TikTok account not found' }, { status: 404 });
      }
    }

    // Validar se youtubeAccountId existe
    if (data.youtubeAccountId) {
      const ytAccount = await prisma.youtubeAccount.findUnique({
        where: { id: data.youtubeAccountId },
      });
      if (!ytAccount) {
        return Response.json({ error: 'YouTube account not found' }, { status: 404 });
      }
    }

    // Validar se scheduledFor é no futuro
    const scheduledDate = new Date(data.scheduledFor);
    if (scheduledDate <= new Date()) {
      return Response.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 },
      );
    }

    // Validar se já existe publicação agendada (unique constraint)
    const existingPublication = await prisma.publication.findFirst({
      where: {
        videoId: data.videoId,
        metaAccountId: data.metaAccountId || null,
        scheduledFor: scheduledDate,
      },
    });

    if (existingPublication) {
      return Response.json(
        { error: 'Publication already scheduled for this time' },
        { status: 409 },
      );
    }

    // Criar publicação
    const publication = await prisma.publication.create({
      data: {
        videoId: data.videoId,
        metaAccountId: data.metaAccountId || null,
        tiktokAccountId: data.tiktokAccountId || null,
        youtubeAccountId: data.youtubeAccountId || null,
        description: data.description,
        hashtags: JSON.stringify(data.hashtags),
        platforms: data.platforms,
        scheduledFor: scheduledDate,
        templateId: data.templateId,
        status: 'SCHEDULED',
        method: data.method,
      },
    });

    // Salvar como template se solicitado
    if (data.saveAsTemplate && data.templateName) {
      await prisma.publicationTemplate.create({
        data: {
          name: data.templateName,
          description: data.description,
          hashtags: JSON.stringify(data.hashtags),
          platforms: data.platforms,
        },
      });
    }

    // Log
    await prisma.publicationLog.create({
      data: {
        publicationId: publication.id,
        action: 'SCHEDULED',
      },
    });

    // Retornar DTO
    const dto: PublicationDTO = {
      id: publication.id,
      videoId: publication.videoId,
      description: publication.description,
      hashtags: JSON.parse(publication.hashtags),
      platforms: publication.platforms as any,
      scheduledFor: publication.scheduledFor,
      status: publication.status as any,
      metaPostId: publication.metaPostId || undefined,
    };

    return Response.json(dto, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }

    console.error('[meta/publications/schedule]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
