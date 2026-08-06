import { MetaAuthUrlParams, MetaTokenResponse, MetaPageInfo, MetaPageListResponse } from './types';

const API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.instagram.com/${API_VERSION}`;
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${API_VERSION}`;
const OAUTH_BASE = 'https://www.facebook.com';

export class MetaGraphAPIClient {
  constructor(
    private appId: string,
    private appSecret: string,
    private redirectUri: string,
  ) {}

  /**
   * Gera URL para OAuth flow
   *
   * Escopos necessários:
   * - pages_show_list: listar páginas do usuário
   * - business_management: acessar Business Manager (para contas de negócios)
   *
   * Nota: O usuário SELECIONA as páginas no fluxo OAuth do Meta
   * Nós recuperamos essas páginas via /me/accounts ou /me/businesses
   *
   * Para obter page tokens: usamos a App Secret com o user token
   */
  getOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: 'pages_show_list,business_management',
      state,
      response_type: 'code',
    });

    return `${OAUTH_BASE}/${API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Troca authorization code por access token
   */
  async exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    const response = await fetch(`${FACEBOOK_GRAPH_API_BASE}/oauth/access_token`, {
      method: 'POST',
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Meta OAuth Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  /**
   * Busca informações da página do usuário
   *
   * Fluxo:
   * 1. Tenta GET /me/accounts (páginas - para contas pessoais)
   * 2. Tenta GET /me/businesses (negócios - para Business Manager)
   * 3. Tenta GET /me/businesses/{id}/owned_pages (páginas do negócio)
   * 4. Se tudo vazio, fallback com /me (dados do usuário)
   *
   * Nota: Suporta tanto contas pessoais quanto Business Manager
   */
  async getPageInfo(accessToken: string): Promise<MetaPageListResponse> {
    // Step 1: Tentar /me/accounts (contas pessoais)
    console.log('[MetaGraphAPIClient.getPageInfo] Step 1: Tentando /me/accounts...');
    let pagesResult = await this.fetchPages(accessToken);
    if (pagesResult.success && pagesResult.data?.length) {
      console.log(`[MetaGraphAPIClient.getPageInfo] ✅ Encontradas ${pagesResult.data.length} página(s) via /me/accounts`);
      return { data: pagesResult.data };
    }

    // Step 2: Tentar /me/businesses (Business Manager)
    console.log('[MetaGraphAPIClient.getPageInfo] Step 2: Tentando /me/businesses...');
    const businessResult = await this.fetchBusinesses(accessToken);
    if (businessResult.success && businessResult.data?.length) {
      console.log(`[MetaGraphAPIClient.getPageInfo] ✅ Encontrados ${businessResult.data.length} negócio(s)`);
      // Se encontrou negócios, tentar pegar as páginas deles
      const pages = await this.fetchPagesFromBusinesses(accessToken, businessResult.data);
      if (pages.length > 0) {
        console.log(`[MetaGraphAPIClient.getPageInfo] ✅ Encontradas ${pages.length} página(s) dos negócios`);
        return { data: pages };
      }
    }

    // Step 3: Fallback com dados do usuário
    console.log('[MetaGraphAPIClient.getPageInfo] Step 3: Fallback - buscando dados do usuário...');
    try {
      const userInfo = await this.getUserInfo(accessToken);
      if (userInfo) {
        console.log('[MetaGraphAPIClient.getPageInfo] ✅ Usando dados do usuário como fallback');
        return {
          data: [userInfo],
          paging: undefined,
        };
      }
    } catch (error) {
      console.error('[MetaGraphAPIClient.getPageInfo] Erro ao buscar dados do usuário:', error);
    }

    console.log('[MetaGraphAPIClient.getPageInfo] ❌ Nenhuma página ou dados do usuário encontrados');
    return { data: [] };
  }

  /**
   * Busca páginas do usuário via /me/accounts
   */
  private async fetchPages(accessToken: string): Promise<{ success: boolean; data?: MetaPageInfo[] }> {
    const url = `${FACEBOOK_GRAPH_API_BASE}/me/accounts?access_token=${accessToken}&fields=id,name,picture,instagram_business_account,category,access_token`;
    console.log('[MetaGraphAPIClient.fetchPages] Fetching /me/accounts...');

    try {
      const response = await fetch(url);
      console.log(`[MetaGraphAPIClient.fetchPages] Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[MetaGraphAPIClient.fetchPages] Error:', errorData?.error?.message);
        return { success: false };
      }

      const data = await response.json();
      console.log('[MetaGraphAPIClient.fetchPages] Response:', JSON.stringify(data, null, 2));

      return {
        success: true,
        data: data.data || [],
      };
    } catch (error) {
      console.error('[MetaGraphAPIClient.fetchPages] Exception:', error);
      return { success: false };
    }
  }

  /**
   * Busca negócios (Business Manager) do usuário
   */
  private async fetchBusinesses(
    accessToken: string,
  ): Promise<{ success: boolean; data?: { id: string; name: string }[] }> {
    const url = `${FACEBOOK_GRAPH_API_BASE}/me/businesses?access_token=${accessToken}&fields=id,name`;
    console.log('[MetaGraphAPIClient.fetchBusinesses] Fetching /me/businesses...');

    try {
      const response = await fetch(url);
      console.log(`[MetaGraphAPIClient.fetchBusinesses] Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[MetaGraphAPIClient.fetchBusinesses] Error:', errorData?.error?.message);
        return { success: false };
      }

      const data = await response.json();
      console.log('[MetaGraphAPIClient.fetchBusinesses] Response:', JSON.stringify(data, null, 2));

      return {
        success: true,
        data: data.data || [],
      };
    } catch (error) {
      console.error('[MetaGraphAPIClient.fetchBusinesses] Exception:', error);
      return { success: false };
    }
  }

  /**
   * Busca páginas dos negócios
   */
  private async fetchPagesFromBusinesses(
    accessToken: string,
    businesses: { id: string; name: string }[],
  ): Promise<MetaPageInfo[]> {
    const allPages: MetaPageInfo[] = [];

    for (const business of businesses) {
      console.log(`[MetaGraphAPIClient.fetchPagesFromBusinesses] Fetching pages for business ${business.id}...`);

      const url = `${FACEBOOK_GRAPH_API_BASE}/${business.id}/owned_pages?access_token=${accessToken}&fields=id,name,picture,instagram_business_account,category,access_token`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          console.log(`[MetaGraphAPIClient.fetchPagesFromBusinesses] Found ${data.data?.length || 0} pages`);
          if (data.data && data.data.length > 0) {
            allPages.push(...data.data);
          }
        } else {
          const errorData = await response.json();
          console.error(`[MetaGraphAPIClient.fetchPagesFromBusinesses] Error: ${errorData?.error?.message}`);
        }
      } catch (error) {
        console.error('[MetaGraphAPIClient.fetchPagesFromBusinesses] Exception:', error);
      }
    }

    return allPages;
  }

  /**
   * Busca informações do usuário autenticado (fallback quando não há páginas)
   * Nota: campo username foi descontinuado na v2.0+
   */
  private async getUserInfo(accessToken: string): Promise<MetaPageInfo | null> {
    const url = `${FACEBOOK_GRAPH_API_BASE}/me?access_token=${accessToken}&fields=id,name,picture`;
    console.log('[MetaGraphAPIClient.getUserInfo] Fetching user info...');

    try {
      const response = await fetch(url);
      console.log('[MetaGraphAPIClient.getUserInfo] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[MetaGraphAPIClient.getUserInfo] Error:', errorData?.error?.message);
        return null;
      }

      const data = await response.json();
      console.log('[MetaGraphAPIClient.getUserInfo] User data:', JSON.stringify(data, null, 2));

      // Validar que temos ao menos o ID e o nome
      if (!data.id) {
        console.error('[MetaGraphAPIClient.getUserInfo] No user ID returned');
        return null;
      }

      return {
        id: data.id,
        name: data.name || 'Conta do Usuário',
        picture: data.picture,
      };
    } catch (error) {
      console.error('[MetaGraphAPIClient.getUserInfo] Exception:', error);
      return null;
    }
  }


  /**
   * Publica conteúdo no feed do Facebook (usando Page Access Token)
   * POST https://graph.facebook.com/v20.0/{page_id}/feed
   */
  async publishToFacebookFeed(
    pageId: string,
    appAccessToken: string,
    videoUrl: string,
    caption: string,
    scheduledPublishTime?: Date,
  ): Promise<{ id: string }> {
    const url = new URL(`${FACEBOOK_GRAPH_API_BASE}/${pageId}/feed`);

    const body: Record<string, string> = {
      source: videoUrl,
      description: caption,
      access_token: appAccessToken,
    };

    if (scheduledPublishTime) {
      const unixTime = Math.floor(scheduledPublishTime.getTime() / 1000);
      body.scheduled_publish_time = unixTime.toString();
      body.published = 'false';
    }

    console.log(
      `[Meta] Publishing to Facebook page ${pageId} at ${scheduledPublishTime || 'now'}`,
    );

    const formData = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log(`[Meta] Facebook publish response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      const message = error.error?.message || error.message || 'Unknown error';
      console.error(`[Meta] Facebook API Error:`, error);
      throw new Error(`Facebook API Error: ${message}`);
    }

    const data = await response.json();
    console.log(`[Meta] Facebook publish successful, post ID: ${data.id}`);

    return data;
  }

  /**
   * Publica vídeo no Instagram (usando App Access Token)
   * Etapa 1: Upload do container de mídia
   * POST https://graph.instagram.com/v20.0/{ig_account_id}/media
   */
  async publishToInstagram(
    instagramAccountId: string,
    appAccessToken: string,
    videoUrl: string,
    caption: string,
    scheduledPublishTime?: Date,
  ): Promise<{ id: string }> {
    console.log(
      `[Meta] Publishing to Instagram account ${instagramAccountId} at ${scheduledPublishTime || 'now'}`,
    );

    // Etapa 1: Upload container de mídia
    const uploadUrl = new URL(
      `${GRAPH_API_BASE}/${instagramAccountId}/media`,
    );

    const uploadBody = new URLSearchParams({
      video_url: videoUrl,
      media_type: 'VIDEO',
      caption,
      access_token: appAccessToken,
    });

    if (scheduledPublishTime) {
      const unixTime = Math.floor(scheduledPublishTime.getTime() / 1000);
      uploadBody.append('creation_timestamp', unixTime.toString());
    }

    console.log(`[Meta] Uploading media container to Instagram...`);

    const uploadResponse = await fetch(uploadUrl.toString(), {
      method: 'POST',
      body: uploadBody.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log(`[Meta] Instagram upload response status: ${uploadResponse.status}`);

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      const message = error.error?.message || error.message || 'Unknown error';
      console.error(`[Meta] Instagram Upload Error:`, error);
      throw new Error(`Instagram Upload Error: ${message}`);
    }

    const uploadData = await uploadResponse.json();
    const mediaId = uploadData.id;

    console.log(`[Meta] Instagram media container created, ID: ${mediaId}`);

    // Etapa 2: Publicar o container se não estiver agendado
    if (!scheduledPublishTime) {
      return await this.publishInstagramMedia(instagramAccountId, mediaId, appAccessToken);
    }

    return { id: mediaId };
  }

  /**
   * Publica um container de mídia já criado no Instagram
   * POST https://graph.instagram.com/v20.0/{ig_account_id}/media_publish
   */
  async publishInstagramMedia(
    instagramAccountId: string,
    mediaId: string,
    appAccessToken: string,
  ): Promise<{ id: string }> {
    console.log(
      `[Meta] Publishing Instagram media ${mediaId} for account ${instagramAccountId}`,
    );

    const publishUrl = new URL(
      `${GRAPH_API_BASE}/${instagramAccountId}/media_publish`,
    );

    const publishBody = new URLSearchParams({
      creation_id: mediaId,
      access_token: appAccessToken,
    });

    const publishResponse = await fetch(publishUrl.toString(), {
      method: 'POST',
      body: publishBody.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log(`[Meta] Instagram publish response status: ${publishResponse.status}`);

    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      const message = error.error?.message || error.message || 'Unknown error';
      console.error(`[Meta] Instagram Publish Error:`, error);
      throw new Error(`Instagram Publish Error: ${message}`);
    }

    const publishData = await publishResponse.json();
    console.log(`[Meta] Instagram publish successful, post ID: ${publishData.id}`);

    return { id: publishData.id };
  }

  /**
   * Obtém insights de uma publicação
   */
  async getPostInsights(
    postId: string,
    accessToken: string,
  ): Promise<{ impressions: number; engagement: number }> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${postId}/insights?metric=impressions,engagement&access_token=${accessToken}`,
    );

    if (!response.ok) {
      throw new Error('Failed to fetch insights');
    }

    const data = await response.json();
    return {
      impressions: data.data?.[0]?.values?.[0]?.value ?? 0,
      engagement: data.data?.[1]?.values?.[0]?.value ?? 0,
    };
  }

}

/**
 * Factory para criar instância do cliente
 */
export function createMetaClient(): MetaGraphAPIClient {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error('Meta API credentials not configured');
  }

  return new MetaGraphAPIClient(appId, appSecret, redirectUri);
}
