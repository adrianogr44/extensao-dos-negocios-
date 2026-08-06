'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Trash2, Edit2, PlayCircle } from 'lucide-react';
import { PublicationDTO } from '@/lib/meta/types';

type PublicationStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';

export default function PublicationsPage() {
  return (
    <Suspense fallback={<div className="min-h-full p-6 animate-pulse">Carregando...</div>}>
      <PublicationsPageInner />
    </Suspense>
  );
}

function PublicationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [publications, setPublications] = useState<PublicationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PublicationStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);

  const pageSize = 10;

  // Verificar parâmetros de sucesso
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Publicação agendada com sucesso! 🎉');
      router.replace('/dashboard/publications');
    }
  }, [searchParams, router]);

  // Auto-limpar mensagens após 5 segundos
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  // Carregar publicações
  useEffect(() => {
    loadPublications();
  }, [statusFilter, page]);

  const handleDelete = async (publicationId: string) => {
    if (!confirm('Tem certeza que deseja remover este agendamento?')) return;

    setIsDeleting(publicationId);
    try {
      const response = await fetch(`/api/meta/publications/${publicationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Falha ao remover');
      }

      setPublications(publications.filter((p) => p.id !== publicationId));
      setSuccessMessage('Agendamento removido');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePublishNow = async (publicationId: string) => {
    setIsPublishing(publicationId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/meta/publications/${publicationId}/publish`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Falha ao publicar';
        setError(`❌ Erro ao publicar: ${errorMsg}`);
        setIsPublishing(null);
        return;
      }

      setSuccessMessage('✅ Publicação enviada com sucesso!');
      setIsPublishing(null);

      // Recarregar publicações após 3 segundos
      setTimeout(() => {
        loadPublications();
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(`❌ Erro ao publicar: ${errorMessage}`);
      console.error('Publish error:', err);
      setIsPublishing(null);
    }
  };

  const loadPublications = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/meta/publications?${params}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar publicações');
      }

      const data = await response.json();
      setPublications(data.data || []);
      setTotal(data.pagination?.total || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      DRAFT: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200', label: '📝 Rascunho' },
      SCHEDULED: {
        bg: 'bg-blue-100 dark:bg-blue-900',
        text: 'text-blue-800 dark:text-blue-200',
        label: '⏰ Agendado',
      },
      PUBLISHED: {
        bg: 'bg-emerald-100 dark:bg-emerald-900',
        text: 'text-emerald-800 dark:text-emerald-200',
        label: '✅ Publicado',
      },
      FAILED: {
        bg: 'bg-red-100 dark:bg-red-900',
        text: 'text-red-800 dark:text-red-200',
        label: '❌ Erro',
      },
    };

    const c = config[status as keyof typeof config] || config.DRAFT;
    return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Publicações Agendadas
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Gerencie seus vídeos agendados para publicação
            </p>
          </div>

          <a
            href="/dashboard/publications/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Agendar Vídeo
          </a>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 rounded-lg text-emerald-800 dark:text-emerald-200">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as PublicationStatus | 'ALL');
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
          >
            <option value="ALL">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="SCHEDULED">Agendado</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="FAILED">Erro</option>
          </select>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-12 text-center">
            <div className="inline-flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando publicações...</p>
          </div>
        ) : publications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-12 text-center">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nenhuma publicação encontrada
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {statusFilter === 'ALL'
                ? 'Comece agendando seu primeiro vídeo!'
                : `Nenhuma publicação com status "${statusFilter}"`}
            </p>
            <a
              href="/dashboard/publications/new"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Agendar Primeiro Vídeo
            </a>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Vídeo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Agendado para
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Plataformas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {publications.map((pub) => (
                    <tr
                      key={pub.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {pub.videoId.slice(0, 12)}...
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                            {pub.description}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(pub.scheduledFor)}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-1">
                          {pub.platforms.map((p) => (
                            <span
                              key={p}
                              className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-800 dark:text-gray-200"
                            >
                              {p === 'FACEBOOK' ? '🔵 FB' : '📷 IG'}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-6 py-4">{getStatusBadge(pub.status)}</td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {pub.status === 'SCHEDULED' && (
                            <button
                              title="Publicar agora"
                              onClick={() => handlePublishNow(pub.id)}
                              disabled={isPublishing === pub.id}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isPublishing === pub.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <PlayCircle className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {['DRAFT', 'SCHEDULED'].includes(pub.status) && (
                            <>
                              <button
                                title="Editar"
                                onClick={() =>
                                  router.push(`/dashboard/publications/${pub.id}/edit`)
                                }
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                title="Remover"
                                onClick={() => handleDelete(pub.id)}
                                disabled={isDeleting === pub.id}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {isDeleting === pub.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}

                          {pub.status === 'PUBLISHED' && (
                            <span className="text-xs text-gray-500">
                              📊 {pub.metaPostId ? 'Ver no Meta' : 'Sem link'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {(page - 1) * pageSize + 1} até{' '}
                  {Math.min(page * pageSize, total)} de {total}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>

                  <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                    {page} de {totalPages}
                  </span>

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próximo →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <a
            href="/dashboard"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            ← Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
