import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createMetaClient } from '@/lib/meta/client';
import { encryptToken } from '@/lib/meta/encryption';

/**
 * GET /api/meta/auth/callback?code=XXX&state=YYY
 * Callback do OAuth Meta
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Validar error do OAuth
  if (error) {
    console.error('[meta/auth/callback] OAuth error:', error, errorDescription);
    redirect(
      `/settings/meta-accounts?error=${encodeURIComponent(errorDescription || error)}`,
    );
  }

  // Validar code
  if (!code) {
    redirect('/settings/meta-accounts?error=missing_code');
  }

  // Validar CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('meta-oauth-state')?.value;

  if (!state || state !== storedState) {
    console.error('[meta/auth/callback] State mismatch');
    redirect('/settings/meta-accounts?error=state_mismatch');
  }

  // Limpar state cookie
  cookieStore.delete('meta-oauth-state');

  try {
    // Trocar code por access_token
    const client = createMetaClient();
    const tokenResponse = await client.exchangeCodeForToken(code);

    // Buscar info das páginas
    const pageListResponse = await client.getPageInfo(tokenResponse.access_token);

    console.log('[meta/auth/callback] Page list response:', JSON.stringify(pageListResponse, null, 2));

    // Validar se há dados de página disponíveis
    if (!pageListResponse.data || pageListResponse.data.length === 0) {
      console.error('[meta/auth/callback] Nenhuma página ou dados do usuário encontrados');
      throw new Error(
        'Não foi possível encontrar suas páginas do Facebook ou Instagram. ' +
        'Por favor, verifique se:\n' +
        '1. Você tem pelo menos uma página/negócio no Facebook\n' +
        '2. Autorizou o acesso à sua conta\n' +
        '3. Sua conta tem permissão para acessar as páginas',
      );
    }

    // Encriptar token antes de salvar
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('TOKEN_ENCRYPTION_KEY not configured');
    }

    const encryptedToken = encryptToken(tokenResponse.access_token, encryptionKey);

    // Salvar TODAS as páginas
    console.log(`[meta/auth/callback] Salvando ${pageListResponse.data.length} página(s)...`);

    for (let index = 0; index < pageListResponse.data.length; index++) {
      const page = pageListResponse.data[index];

      // Validar dados necessários
      if (!page.name) {
        console.error(`[meta/auth/callback] Página ${index} sem nome, pulando...`);
        continue;
      }

      // IMPORTANTE: Usar o page.access_token (page token) ao invés do user token
      // O page token vem no endpoint /me/accounts e tem permissões para publicar
      const pageAccessToken = page.access_token || tokenResponse.access_token;
      const encryptedPageToken = encryptToken(pageAccessToken, encryptionKey);

      console.log(`[meta/auth/callback] Salvando página: ${page.name} (${page.id})`);
      console.log(`[meta/auth/callback] Token type: ${page.access_token ? 'page_token' : 'user_token (fallback)'}`);

      await prisma.metaAccount.upsert({
        where: { facebookPageId: page.id },
        update: {
          accessToken: encryptedPageToken,
          pageUsername: page.username || null,
          tokenExpiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : null,
          isActive: true,
          lastSyncedAt: new Date(),
        },
        create: {
          facebookPageId: page.id,
          instagramAccountId: page.instagram_business_account?.id,
          accessToken: encryptedPageToken,
          tokenExpiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : null,
          pageName: page.name,
          pageUsername: page.username || null,
          profilePictureUrl: page.picture?.data?.url,
          isActive: true,
        },
      });
    }

    console.log('[meta/auth/callback] Todas as páginas foram salvas com sucesso');
    redirect('/settings/meta-accounts?success=true');
  } catch (error) {
    console.error('[meta/auth/callback]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    redirect(`/settings/meta-accounts?error=${encodeURIComponent(message)}`);
  }
}
