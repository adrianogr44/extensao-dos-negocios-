import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { createMetaClient } from '@/lib/meta/client';

/**
 * POST /api/meta/auth/connect
 * Inicia o fluxo OAuth
 */
export async function POST(request: Request) {
  try {
    const { redirectUrl } = await request.json();

    // Gerar state token para CSRF protection
    const state = nanoid(32);

    // Armazenar state em cookie (httpOnly, seguro)
    const cookieStore = await cookies();
    cookieStore.set('meta-oauth-state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 minutos
    });

    // Gerar URL de OAuth
    const client = createMetaClient();
    const authUrl = client.getOAuthUrl(state);

    return Response.json({ authUrl }, { status: 200 });
  } catch (error) {
    console.error('[meta/auth/connect]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
