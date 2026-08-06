'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Search, Video } from 'lucide-react';
import { prisma } from '@/lib/prisma';

interface Niche {
  id: string;
  nome: string;
  cor?: string;
}

interface Profile {
  id: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
}

interface VideoOption {
  id: string;
  filename: string;
  thumbnail?: string;
  duration?: number;
  selected: boolean;
}

type ScheduleStrategy = 'random' | 'sequential' | 'manual';

export default function BatchSchedulePage() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'niche' | 'profiles' | 'videos' | 'schedule'>('niche');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Step 1: Niche Selection
  const [niches, setNiches] = useState<Niche[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<string>('');

  // Step 2: Profile Selection
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [randomMode, setRandomMode] = useState(false);
  const [randomCount, setRandomCount] = useState(3);

  // Step 3: Video Selection
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [selectStrategy, setSelectStrategy] = useState<ScheduleStrategy>('random');
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  // Step 4: Schedule
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [intervalHours, setIntervalHours] = useState(24);
  const [platforms, setPlatforms] = useState<string[]>(['FACEBOOK', 'INSTAGRAM']);
  const [method, setMethod] = useState<'API' | 'SCRAPE'>('SCRAPE');

  // Step 4: Meta Account Selection
  const [metaAccounts, setMetaAccounts] = useState<any[]>([]);
  const [selectedMetaAccountId, setSelectedMetaAccountId] = useState<string>("");

  // Step 4: TikTok Account Selection
  const [tiktokAccounts, setTiktokAccounts] = useState<any[]>([]);
  const [selectedTiktokAccountId, setSelectedTiktokAccountId] = useState<string>("");

  // Step 4: YouTube Account Selection
  const [youtubeAccounts, setYoutubeAccounts] = useState<any[]>([]);
  const [selectedYoutubeAccountId, setSelectedYoutubeAccountId] = useState<string>("");

  // Load meta accounts on mount
  useEffect(() => {
    const loadMetaAccounts = async () => {
      try {
        const response = await fetch("/api/meta/accounts");
        const result = await response.json();
        setMetaAccounts(result || []);
        if (result && result.length > 0) {
          setSelectedMetaAccountId(result[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar contas Meta", err);
      }
    };
    loadMetaAccounts();
  }, []);

  // Load TikTok accounts on mount
  useEffect(() => {
    const loadTikTokAccounts = async () => {
      try {
        const response = await fetch("/api/tiktok/accounts");
        const result = await response.json();
        const accounts = result.data || [];
        setTiktokAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedTiktokAccountId(accounts[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar contas TikTok", err);
      }
    };
    loadTikTokAccounts();
  }, []);

  // Load YouTube accounts on mount
  useEffect(() => {
    const loadYouTubeAccounts = async () => {
      try {
        const response = await fetch("/api/youtube/accounts");
        const result = await response.json();
        const accounts = result.data || [];
        setYoutubeAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedYoutubeAccountId(accounts[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar contas YouTube", err);
      }
    };
    loadYouTubeAccounts();
  }, []);

  // Load niches on mount
  useEffect(() => {
    const loadNiches = async () => {
      try {
        const response = await fetch('/api/nichos');
        const result = await response.json();
        setNiches(result.data || result);
      } catch (err) {
        setError('Erro ao carregar nichos');
      }
    };
    loadNiches();
  }, []);

  // Load profiles when niche changes
  useEffect(() => {
    if (!selectedNiche) {
      setProfiles([]);
      return;
    }

    const loadProfiles = async () => {
      try {
        const response = await fetch(`/api/nichos/${selectedNiche}/profiles`);
        const result = await response.json();
        setProfiles(result.data || result);
        setSelectedProfiles(new Set());
      } catch (err) {
        setError('Erro ao carregar perfis');
      }
    };

    loadProfiles();
  }, [selectedNiche]);

  // Load videos when profiles change
  useEffect(() => {
    if (selectedProfiles.size === 0) {
      setVideos([]);
      return;
    }

    const loadVideos = async () => {
      try {
        const profileIds = Array.from(selectedProfiles);
        const response = await fetch(
          `/api/videos?profiles=${profileIds.join(',')}&status=completed`,
        );
        const result = await response.json();
        const videoList = result.data || result;
        setVideos(
          videoList.map((v: any) => ({
            ...v,
            selected: false,
          })),
        );
      } catch (err) {
        setError('Erro ao carregar vídeos');
      }
    };

    loadVideos();
  }, [selectedProfiles]);

  // Handle profile selection
  const toggleProfile = (profileId: string) => {
    const newSelected = new Set(selectedProfiles);
    if (newSelected.has(profileId)) {
      newSelected.delete(profileId);
    } else {
      newSelected.add(profileId);
    }
    setSelectedProfiles(newSelected);
  };

  // Handle random profile selection
  const selectRandomProfiles = () => {
    if (randomCount > profiles.length) {
      setError('Número de perfis maior que disponível');
      return;
    }

    const shuffled = [...profiles].sort(() => Math.random() - 0.5);
    const selected = new Set(shuffled.slice(0, randomCount).map((p) => p.id));
    setSelectedProfiles(selected);
    setRandomMode(false);
  };

  // Handle video selection
  const toggleVideo = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  // Handle select all/none videos
  const selectAllVideos = () => {
    setSelectedVideos(new Set(videos.map((v) => v.id)));
  };

  const deselectAllVideos = () => {
    setSelectedVideos(new Set());
  };

  // Handle hashtag
  const addHashtag = () => {
    if (newHashtag.trim()) {
      const tag = newHashtag.startsWith('#')
        ? newHashtag
        : `#${newHashtag}`;
      setHashtags([...hashtags, tag]);
      setNewHashtag('');
    }
  };

  const removeHashtag = (index: number) => {
    setHashtags(hashtags.filter((_, i) => i !== index));
  };

  // Handle submit
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!selectedNiche || selectedVideos.size === 0 || !scheduledFor) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      const videoIds = Array.from(selectedVideos);
      const metaAccountId = selectedMetaAccountId;
      const tiktokAccountId = selectedTiktokAccountId;
      const youtubeAccountId = selectedYoutubeAccountId;

      const requiresMeta = platforms.some(p => p === 'FACEBOOK' || p === 'INSTAGRAM');
      const requiresTikTok = platforms.includes('TIKTOK');
      const requiresYouTube = platforms.includes('YOUTUBE');

      if (requiresMeta && !metaAccountId) {
        throw new Error('Selecione uma conta Meta (Facebook/Instagram)');
      }
      if (requiresTikTok && !tiktokAccountId) {
        throw new Error('Selecione uma conta TikTok');
      }
      if (requiresYouTube && !youtubeAccountId) {
        throw new Error('Selecione uma conta YouTube');
      }

      const scheduleTimes = videoIds.map((_, index) => {
        const time = new Date(scheduledFor);
        time.setHours(time.getHours() + index * intervalHours);
        return time.toISOString();
      });

      const response = await fetch('/api/meta/publications/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIds,
          metaAccountId,
          tiktokAccountId,
          youtubeAccountId,
          description,
          hashtags,
          platforms,
          scheduleTimes,
          method,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao agendar publicações');
      }

      setSuccess(`${videoIds.length} vídeos agendados com sucesso!`);
      setTimeout(() => {
        window.location.href = '/publications/calendar';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao agendar');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-full p-6">
        <div className="max-w-4xl mx-auto">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Agendar Lote de Vídeos
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Agende múltiplos vídeos de um mesmo nicho em intervalos regulares
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex gap-4">
          {(['niche', 'profiles', 'videos', 'schedule'] as const).map((s, i) => (
            <div
              key={s}
              className={`flex-1 py-3 px-4 rounded-lg font-medium text-center cursor-pointer transition-colors ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : s < step
                    ? 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
              onClick={() => setStep(s)}
            >
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          ))}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 flex gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 flex gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          {/* Step 1: Niche Selection */}
          {step === 'niche' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Selecione um Nicho
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {niches.map((niche) => (
                  <button
                    key={niche.id}
                    onClick={() => {
                      setSelectedNiche(niche.id);
                      setStep('profiles');
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                      selectedNiche === niche.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {niche.cor && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: niche.cor }}
                        />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {niche.nome}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Profile Selection */}
          {step === 'profiles' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Selecione os Perfis
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Escolha perfis manualmente ou selecione aleatoriamente
              </p>

              {!randomMode ? (
                <>
                  <button
                    onClick={() => setRandomMode(true)}
                    className="mb-6 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Selecionar Aleatoriamente
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => toggleProfile(profile.id)}
                        className={`p-4 rounded-lg border-2 transition-colors text-left ${
                          selectedProfiles.has(profile.id)
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {profile.avatarUrl && (
                            <img
                              src={profile.avatarUrl}
                              alt={profile.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white">
                              @{profile.username}
                            </div>
                            {profile.fullName && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                {profile.fullName}
                              </div>
                            )}
                          </div>
                          {selectedProfiles.has(profile.id) && (
                            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quantos perfis aleatórios?
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={profiles.length}
                      value={randomCount}
                      onChange={(e) => setRandomCount(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={selectRandomProfiles}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Selecionar {randomCount} Perfis Aleatoriamente
                  </button>
                  <button
                    onClick={() => setRandomMode(false)}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Video Selection */}
          {step === 'videos' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Selecione os Vídeos
              </h2>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={selectAllVideos}
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-lg font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  Selecionar Todos
                </button>
                <button
                  onClick={deselectAllVideos}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Desselecionar Todos
                </button>
              </div>

              {videos.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Nenhum vídeo disponível para os perfis selecionados
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {videos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => toggleVideo(video.id)}
                      className={`p-4 rounded-lg border-2 transition-colors text-left ${
                        selectedVideos.has(video.id)
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex gap-4">
                        {video.thumbnail && (
                          <img
                            src={video.thumbnail}
                            alt={video.filename}
                            className="w-16 h-16 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {video.filename}
                          </div>
                          {video.duration && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {Math.round(video.duration / 1000)}s
                            </div>
                          )}
                          {selectedVideos.has(video.id) && (
                            <CheckCircle className="w-4 h-4 text-blue-600 mt-2" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Schedule Details */}
          {step === 'schedule' && (
            <div className="space-y-6">
              {/* Meta Account Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Publicar em qual página? *
              </label>
              <select
                value={selectedMetaAccountId}
                onChange={(e) => setSelectedMetaAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="">Selecionar página...</option>
                {metaAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    📄 {account.pageName}
                    {account.pageUsername ? ` (@${account.pageUsername})` : ""}
                  </option>
                ))}
              </select>
              {metaAccounts.length === 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  ❌ Nenhuma conta Meta conectada. <a href="/settings/meta-accounts" className="underline">Conecte uma</a>
                </p>
              )}
            </div>

              {/* TikTok Account Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conta TikTok *
                </label>
                <select
                  value={selectedTiktokAccountId}
                  onChange={(e) => setSelectedTiktokAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Selecionar conta TikTok...</option>
                  {tiktokAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      🎵 {account.username}
                      {account.displayName ? ` (${account.displayName})` : ""}
                    </option>
                  ))}
                </select>
                {tiktokAccounts.length === 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    ❌ Nenhuma conta TikTok conectada. <a href="/settings/meta-accounts" className="underline">Conecte uma</a>
                  </p>
                )}
              </div>

              {/* YouTube Account Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conta YouTube *
                </label>
                <select
                  value={selectedYoutubeAccountId}
                  onChange={(e) => setSelectedYoutubeAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Selecionar conta YouTube...</option>
                  {youtubeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      📺 {account.channelName}
                      {account.channelId ? ` (${account.channelId})` : ""}
                    </option>
                  ))}
                </select>
                {youtubeAccounts.length === 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    ❌ Nenhuma conta YouTube conectada. <a href="/settings/meta-accounts" className="underline">Conecte uma</a>
                  </p>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Configurar Agendamento
              </h2>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição (será usada em todos os vídeos)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2200}
                  rows={4}
                  placeholder="Descrição dos vídeos..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {description.length}/2200 caracteres
                </p>
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hashtags
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addHashtag()}
                    placeholder="Adicione uma hashtag..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  />
                  <button
                    onClick={addHashtag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeHashtag(i)}
                        className="hover:opacity-70"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Scheduled Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Começar agendamento em: *
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Intervalo entre publicações (horas): *
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={intervalHours}
                  onChange={(e) => setIntervalHours(parseInt(e.target.value) || 24)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedVideos.size} vídeos serão publicados a cada {intervalHours}
                  {intervalHours === 1 ? ' hora' : ' horas'}
                </p>
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Plataformas:
                </label>
                <div className="space-y-2">
                  {['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE'].map((platform) => (
                    <label key={platform} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={platforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPlatforms([...platforms, platform]);
                          } else {
                            setPlatforms(
                              platforms.filter((p) => p !== platform),
                            );
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-900 dark:text-white font-medium">
                        {platform === 'FACEBOOK' ? 'Facebook' : platform === 'INSTAGRAM' ? 'Instagram' : platform === 'TIKTOK' ? 'TikTok' : 'YouTube'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Método de publicação
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="method"
                      value="API"
                      checked={method === 'API'}
                      onChange={() => setMethod('API')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">API oficial (Meta)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="method"
                      value="SCRAPE"
                      checked={method === 'SCRAPE'}
                      onChange={() => setMethod('SCRAPE')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">Scraping (navegador)</span>
                  </label>
                </div>
                {method === 'SCRAPE' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Requer sessão ativa do Facebook via navegador nas configurações
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={() => {
              const steps = ['niche', 'profiles', 'videos', 'schedule'] as const;
              const currentIndex = steps.indexOf(step);
              if (currentIndex > 0) {
                setStep(steps[currentIndex - 1] as typeof step);
              }
            }}
            disabled={step === 'niche'}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Voltar
          </button>

          {step !== 'schedule' ? (
            <button
              onClick={() => {
                const steps = ['niche', 'profiles', 'videos', 'schedule'] as const;
                const currentIndex = steps.indexOf(step);
                if (currentIndex < steps.length - 1) {
                  setStep(steps[currentIndex + 1] as typeof step);
                }
              }}
              disabled={
                (step === 'niche' && !selectedNiche) ||
                (step === 'profiles' && selectedProfiles.size === 0) ||
                (step === 'videos' && selectedVideos.size === 0)
              }
              className="ml-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="ml-auto px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Agendando...' : 'Agendar Lote'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
