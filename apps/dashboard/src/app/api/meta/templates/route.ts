import { prisma } from '@/lib/prisma';
import { TemplateDTO } from '@/lib/meta/types';
import { z } from 'zod';

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  hashtags: z.array(z.string()),
  platforms: z.array(z.enum(['FACEBOOK', 'INSTAGRAM'])).default(['FACEBOOK', 'INSTAGRAM']),
});

type CreateTemplatePayload = z.infer<typeof CreateTemplateSchema>;

/**
 * GET /api/meta/templates?limit=20&page=1
 * Listar templates
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      prisma.publicationTemplate.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.publicationTemplate.count(),
    ]);

    const dtos: TemplateDTO[] = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      hashtags: JSON.parse(t.hashtags),
      platforms: t.platforms as any,
    }));

    return Response.json({
      data: dtos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[meta/templates GET]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/meta/templates
 * Criar novo template
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = CreateTemplateSchema.parse(body);

    const template = await prisma.publicationTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        hashtags: JSON.stringify(data.hashtags),
        platforms: data.platforms,
      },
    });

    const dto: TemplateDTO = {
      id: template.id,
      name: template.name,
      description: template.description,
      hashtags: JSON.parse(template.hashtags),
      platforms: template.platforms as any,
    };

    return Response.json(dto, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }

    console.error('[meta/templates POST]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
