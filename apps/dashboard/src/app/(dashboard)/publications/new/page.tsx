'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ScheduleForm } from '@/components/meta/schedule-form';
import { ScheduleFormData, MetaAccountDTO, TemplateDTO, PublicationDTO, TikTokAccountDTO, YouTubeAccountDTO } from '@/lib/meta/types';

export default function NewPublicationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 animate-pulse">Carregando...</div>}>
      <NewPublicationPageInner />
    </Suspense>
  );
}

function NewPublicationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get('videoId');

  const [videoTitle, setVideoTitle] = useState('Video');
  const [accounts, setAccounts] = useState<MetaAccountDTO[]>([]);
  const [tiktokAccounts, setTiktokAccounts] = useState<TikTokAccountDTO[]>([]);
  const [youtubeAccounts, setYoutubeAccounts] = useState<YouTubeAccountDTO[]>([]);
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar contas e templates
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Validar videoId
        if (!videoId) {
          setError('Video ID não fornecido. Selecione um vídeo primeiro.');
          return;
        }

        // Carregar contas
        const accountsResponse = await fetch('/api/meta/accounts');
        if (!accountsResponse.ok) {
          throw new Error('Falha ao carregar contas');
        }
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData);

        // Carregar contas TikTok
        const ttResponse = await fetch('/api/tiktok/accounts');
        if (ttResponse.ok) {
          const ttData = await ttResponse.json();
          setTiktokAccounts(ttData.data || []);
        }

        // Carregar contas YouTube
        const ytResponse = await fetch('/api/youtube/accounts');
        if (ytResponse.ok) {
          const ytData = await ytResponse.json();
          setYoutubeAccounts(ytData.data || []);
        }

        // Carregar templates
        const templatesResponse = await fetch('/api/meta/templates');
        if (!templatesResponse.ok) {
          throw new Error('Falha ao carregar templates');
        }
        const templatesData = await templatesResponse.json();
        setTemplates(templatesData.data || []);

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [videoId]);

  const handleSubmit = async (data: ScheduleFormData) => {
    if (!videoId) {
      throw new Error('Video ID is required');
    }

    // TODO: Obter metaAccountId do formulário
    // Por enquanto, usar a primeira conta conectada
    const metaAccountId = data.metaAccountId || accounts[0]?.id;
    if (!metaAccountId && data.platforms.some(p => p === 'FACEBOOK' || p === 'INSTAGRAM')) {
      throw new Error('Nenhuma conta Meta conectada');
    }

    try {
      const response = await fetch('/api/meta/publications/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          metaAccountId,
          tiktokAccountId: data.tiktokAccountId,
          youtubeAccountId: data.youtubeAccountId,
          description: data.description,
          hashtags: data.hashtags,
          platforms: data.platforms,
          scheduledFor: data.scheduledFor,
          method: data.method || 'SCRAPE',
          saveAsTemplate: data.saveAsTemplate,
          templateName: data.templateName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao agendar');
      }

      const publication = (await response.json()) as PublicationDTO;

      // Sucesso! Redirecionar para lista
      router.push(`/dashboard/publications?success=true&publicationId=${publication.id}`);
    } catch (err) {
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-6 text-center">
            <h1 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              Erro
            </h1>
            <p className="text-red-800 dark:text-red-200 mb-4">{error}</p>
            <a
              href="/dashboard/publications"
              className="inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              ← Voltar
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6 text-center">
            <h1 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              Nenhuma Conta Conectada
            </h1>
            <p className="text-yellow-800 dark:text-yellow-200 mb-4">
              Você precisa conectar uma conta do Facebook/Instagram antes de agendar publicações.
            </p>
            <a
              href="/settings/meta-accounts"
              className="inline-flex items-center justify-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
            >
              Conectar Conta
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <ScheduleForm
        videoId={videoId || ''}
        videoTitle={videoTitle}
        accounts={accounts}
        tiktokAccounts={tiktokAccounts}
        youtubeAccounts={youtubeAccounts}
        templates={templates}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}
