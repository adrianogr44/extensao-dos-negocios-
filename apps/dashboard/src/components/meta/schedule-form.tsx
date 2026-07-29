'use client';
import { useEffect, useState } from 'react';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { ScheduleFormData, MetaAccountDTO, TemplateDTO, PublicationPlatform } from '@/lib/meta/types';
import { TagInput } from './tag-input';

interface ScheduleFormProps {
  videoId: string;
  videoTitle: string;
  accounts: MetaAccountDTO[];
  templates: TemplateDTO[];
  onSubmit: (data: ScheduleFormData) => Promise<void>;
  onCancel: () => void;
}

export function ScheduleForm({
  videoId,
  videoTitle,
  accounts,
  templates,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [metaAccountId, setMetaAccountId] = useState<string>(accounts[0]?.id || '');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<PublicationPlatform[]>(['FACEBOOK', 'INSTAGRAM']);
  const [scheduledFor, setScheduledFor] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!metaAccountId) {
      setError('Selecione uma conta Meta');
      return;
    }

    if (!description) {
      setError('Descrição é obrigatória');
      return;
    }

    if (!scheduledFor) {
      setError('Data e hora são obrigatórias');
      return;
    }

    if (saveAsTemplate && !templateName) {
      setError('Nome do template é obrigatório');
      return;
    }

    setIsLoading(true);

    try {
      const isoDateTime = scheduledFor ? new Date(scheduledFor).toISOString() : '';

      await onSubmit({
        description,
        hashtags,
        platforms,
        scheduledFor: isoDateTime,
        metaAccountId,
        saveAsTemplate,
        templateName: templateName || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: TemplateDTO) => {
    setDescription(template.description);
    setHashtags(template.hashtags);
    setPlatforms(template.platforms);
  };

  const charCount = description.length;
  const charLimit = 300;
  const charPercent = Math.round((charCount / charLimit) * 100);

  if (!mounted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 h-96 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Agendar Publicação
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Vídeo: {videoTitle}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Template Selection */}
            {templates.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-900">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  💾 Usar Template Anterior
                </h3>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const template = templates.find((t) => t.id === e.target.value);
                      if (template) handleTemplateSelect(template);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                >
                  <option value="">Selecionar template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Meta Page Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Publicar em qual página? *
              </label>
              <select
                value={metaAccountId}
                onChange={(e) => setMetaAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
              >
                <option value="">Selecionar página...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    📄 {acc.pageName}
                    {acc.pageUsername ? ` (@${acc.pageUsername})` : ''}
                  </option>
                ))}
              </select>
              {accounts.length > 1 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Você tem {accounts.length} página(s) conectada(s)
                </p>
              )}
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Publicar em:
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={platforms.includes('FACEBOOK')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPlatforms([...platforms, 'FACEBOOK']);
                      } else {
                        setPlatforms(platforms.filter((p) => p !== 'FACEBOOK'));
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Facebook</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={platforms.includes('INSTAGRAM')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPlatforms([...platforms, 'INSTAGRAM']);
                      } else {
                        setPlatforms(platforms.filter((p) => p !== 'INSTAGRAM'));
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Instagram</span>
                </label>
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Descrição *
                </label>
                <span
                  className={`text-xs ${
                    charPercent > 90 ? 'text-orange-600' : 'text-gray-500'
                  }`}
                >
                  {charCount}/{charLimit}
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, charLimit))}
                maxLength={charLimit}
                placeholder="Conte uma história interessante sobre seu vídeo..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm resize-none"
              />
            </div>

            {/* Hashtags */}
            <TagInput value={hashtags} onChange={setHashtags} maxTags={30} />

            {/* Date & Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Agendar para: *
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💡 Dica: Melhores horários são geralmente 20:00–22:00
              </p>
            </div>

            {/* Save as Template */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Salvar como template para futuros vídeos
              </span>
            </label>

            {saveAsTemplate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Template
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex: Dica de Fitness"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? 'Agendando...' : 'Agendar Publicação'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
