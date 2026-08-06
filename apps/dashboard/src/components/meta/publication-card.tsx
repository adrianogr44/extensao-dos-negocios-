'use client';
import { PublicationDTO } from '@/lib/meta/types';
import { Trash2, Edit2, PlayCircle, AlertCircle } from 'lucide-react';

interface PublicationCardProps {
  publication: PublicationDTO;
  onDelete?: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  onPublishNow?: (id: string) => Promise<void>;
  isDeleting?: boolean;
}

export function PublicationCard({
  publication,
  onDelete,
  onEdit,
  onPublishNow,
  isDeleting,
}: PublicationCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { badge: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200', label: '📝 Rascunho' };
      case 'SCHEDULED':
        return { badge: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200', label: '⏰ Agendado' };
      case 'PUBLISHED':
        return { badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200', label: '✅ Publicado' };
      case 'FAILED':
        return { badge: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200', label: '❌ Erro' };
      default:
        return { badge: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200', label: status };
    }
  };

  const config = getStatusConfig(publication.status);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {publication.videoId.slice(0, 16)}...
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {publication.description}
            </p>
          </div>
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${config.badge}`}>
            {config.label}
          </span>
        </div>

        {/* Info */}
        <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">📅 Agendado:</span> {formatDate(publication.scheduledFor)}
          </div>
          {publication.publishedAt && (
            <div>
              <span className="font-medium">📤 Publicado:</span> {formatDate(publication.publishedAt)}
            </div>
          )}
          <div className="flex gap-2">
            {publication.platforms.map((p) => (
              <span key={p} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                {p === 'FACEBOOK' ? '🔵 FB' : p === 'INSTAGRAM' ? '📷 IG' : p === 'TIKTOK' ? '🎵 TT' : '📺 YT'}
              </span>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        {publication.hashtags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {publication.hashtags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-blue-600 dark:text-blue-400">
                {tag}
              </span>
            ))}
            {publication.hashtags.length > 3 && (
              <span className="text-xs text-gray-500">+{publication.hashtags.length - 3}</span>
            )}
          </div>
        )}

        {/* Error Message */}
        {publication.status === 'FAILED' && publication.errorMessage && (
          <div className="mb-4 p-2 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-xs text-red-800 dark:text-red-200 flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {publication.errorMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {publication.status === 'SCHEDULED' && onPublishNow && (
            <button
              onClick={() => onPublishNow(publication.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors"
              title="Publicar agora"
            >
              <PlayCircle className="w-4 h-4" />
              Publicar Agora
            </button>
          )}

          {['DRAFT', 'SCHEDULED'].includes(publication.status) && (
            <>
              {onEdit && (
                <button
                  onClick={() => onEdit(publication.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => onDelete(publication.id)}
                  disabled={isDeleting}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors disabled:opacity-50"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
