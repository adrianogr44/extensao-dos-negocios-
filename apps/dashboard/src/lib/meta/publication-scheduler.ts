import { prisma } from '@/lib/prisma';

export interface PublicationSchedulerResult {
  published: number;
  failed: number;
  skipped: number;
  errors: Array<{ publicationId: string; error: string }>;
}

/**
 * Processa todas as publicações agendadas que chegaram na hora de publicação
 * Executa a cada 1 minuto (ideal para cron jobs)
 */
export async function processScheduledPublications(): Promise<PublicationSchedulerResult> {
  const now = new Date();
  const result: PublicationSchedulerResult = {
    published: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log(`[PublicationScheduler] Starting scheduled publications check at ${now.toISOString()}`);

    // Buscar publicações agendadas que devem ser publicadas agora
    const scheduledPublications = await prisma.publication.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: {
          lte: now,
        },
      },
      include: {
        metaAccount: true,
      },
      orderBy: {
        scheduledFor: 'asc',
      },
    });

    console.log(
      `[PublicationScheduler] Found ${scheduledPublications.length} publications ready to publish`,
    );

    if (scheduledPublications.length === 0) {
      return result;
    }

    // Processar cada publicação
    for (const publication of scheduledPublications) {
      try {
        const delay = now.getTime() - publication.scheduledFor.getTime();
        console.log(
          `[PublicationScheduler] Publishing ${publication.id} (scheduled ${Math.round(delay / 1000)}s ago)`,
        );

        // Chamar a rota de publish como se fosse um cliente interno
        const publishResponse = await publishPublication(publication.id);

        if (publishResponse.ok) {
          result.published++;
          console.log(`[PublicationScheduler] Successfully published ${publication.id}`);
        } else {
          result.failed++;
          const error = await publishResponse.json();
          result.errors.push({
            publicationId: publication.id,
            error: error.error || 'Unknown error',
          });
          console.error(
            `[PublicationScheduler] Failed to publish ${publication.id}: ${error.error}`,
          );
        }
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          publicationId: publication.id,
          error: errorMsg,
        });
        console.error(`[PublicationScheduler] Error publishing ${publication.id}:`, error);
      }
    }

    console.log(
      `[PublicationScheduler] Completed: ${result.published} published, ${result.failed} failed`,
    );

    return result;
  } catch (error) {
    console.error('[PublicationScheduler] Fatal error:', error);
    throw error;
  }
}

/**
 * Publica uma publicação específica chamando internamente a API
 * Simula uma requisição POST para /api/meta/publications/[id]/publish
 */
async function publishPublication(publicationId: string): Promise<Response> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/meta/publications/${publicationId}/publish`;

  console.log(`[PublicationScheduler] Calling publish endpoint: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response;
  } catch (error) {
    console.error(`[PublicationScheduler] Fetch error for ${publicationId}:`, error);
    throw error;
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Inicia o agendador de publicações
 * Executa processScheduledPublications a cada intervalMs (padrão: 60s)
 */
export function startPublicationScheduler(intervalMs: number = 60000): void {
  if (schedulerInterval) {
    console.warn('[PublicationScheduler] Scheduler already running, stopping first');
    stopPublicationScheduler();
  }

  console.log(
    `[PublicationScheduler] Starting publication scheduler (interval: ${intervalMs}ms)`,
  );

  // Executar imediatamente na inicialização
  processScheduledPublications().catch((error) => {
    console.error('[PublicationScheduler] Initial run error:', error);
  });

  // Agendar execução periódica
  schedulerInterval = setInterval(async () => {
    try {
      await processScheduledPublications();
    } catch (error) {
      console.error('[PublicationScheduler] Scheduled run error:', error);
    }
  }, intervalMs);

  console.log('[PublicationScheduler] Scheduler started');
}

/**
 * Para o agendador de publicações
 */
export function stopPublicationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[PublicationScheduler] Scheduler stopped');
  }
}

/**
 * Obtém status do agendador
 */
export function getPublicationSchedulerStatus(): {
  running: boolean;
  nextCheck?: Date;
} {
  return {
    running: schedulerInterval !== null,
  };
}
