'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MetaAccountDTO } from '@/lib/meta/types';

type SessionStatus = { status: string; loggedInAs?: string } | null

interface TikTokAccountDTO {
  id: string;
  username: string;
  displayName?: string;
  isActive: boolean;
}

interface YouTubeAccountDTO {
  id: string;
  channelName: string;
  channelId?: string;
  isActive: boolean;
}

export default function MetaAccountsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 animate-pulse">Carregando...</div>}>
      <MetaAccountsPageInner />
    </Suspense>
  );
}

function MetaAccountsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<MetaAccountDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [connectingSessionId, setConnectingSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, SessionStatus>>({});
  const [qrCode, setQrCode] = useState<string | null>(null);

  // TikTok accounts
  const [tiktokAccounts, setTiktokAccounts] = useState<TikTokAccountDTO[]>([]);
  const [ttSessionStatus, setTtSessionStatus] = useState<Record<string, SessionStatus>>({});
  const [connectingTtId, setConnectingTtId] = useState<string | null>(null);
  const [ttQrCode, setTtQrCode] = useState<string | null>(null);
  const [ttNewUsername, setTtNewUsername] = useState('');

  // YouTube accounts
  const [youtubeAccounts, setYoutubeAccounts] = useState<YouTubeAccountDTO[]>([]);
  const [ytSessionStatus, setYtSessionStatus] = useState<Record<string, SessionStatus>>({});
  const [connectingYtId, setConnectingYtId] = useState<string | null>(null);
  const [ytNewChannel, setYtNewChannel] = useState('');

  // Verificar parâmetros de sucesso/erro do OAuth
  useEffect(() => {
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (success === 'true') {
      setSuccessMessage('Conta conectada com sucesso! 🎉');
      router.replace('/settings/meta-accounts');
      loadAccounts();
    }

    if (errorParam) {
      setError(`Erro ao conectar: ${decodeURIComponent(errorParam)}`);
      router.replace('/settings/meta-accounts');
    }
  }, [searchParams, router]);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/meta/accounts');
      if (!response.ok) throw new Error('Failed to load accounts');
      const data = await response.json();
      setAccounts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length === 0) return
    accounts.forEach(async (acc) => {
      try {
        const res = await fetch(`/api/facebook/session/status?metaAccountId=${acc.id}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.success) setSessions(s => ({ ...s, [acc.id]: data.data }))
      } catch { }
    })
  }, [accounts])

  // Load TikTok accounts + session status
  const loadTikTokAccounts = async () => {
    try {
      const res = await fetch('/api/tiktok/accounts')
      if (!res.ok) return
      const data = await res.json()
      const list = data.data || []
      setTiktokAccounts(list)
      list.forEach(async (acc: any) => {
        try {
          const sres = await fetch(`/api/tiktok/session/status?tiktokAccountId=${acc.id}`)
          if (!sres.ok) return
          const sdata = await sres.json()
          if (sdata.success) setTtSessionStatus(s => ({ ...s, [acc.id]: sdata.data }))
        } catch { }
      })
    } catch { }
  }

  // Load YouTube accounts + session status
  const loadYouTubeAccounts = async () => {
    try {
      const res = await fetch('/api/youtube/accounts')
      if (!res.ok) return
      const data = await res.json()
      const list = data.data || []
      setYoutubeAccounts(list)
      list.forEach(async (acc: any) => {
        try {
          const sres = await fetch(`/api/youtube/session/status?youtubeAccountId=${acc.id}`)
          if (!sres.ok) return
          const sdata = await sres.json()
          if (sdata.success) setYtSessionStatus(s => ({ ...s, [acc.id]: sdata.data }))
        } catch { }
      })
    } catch { }
  }

  useEffect(() => {
    loadTikTokAccounts()
    loadYouTubeAccounts()
  }, [])

  const handleAddTikTok = async () => {
    if (!ttNewUsername.trim()) {
      setError('Informe o usuário do TikTok')
      return
    }
    try {
      const res = await fetch('/api/tiktok/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ttNewUsername.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTtNewUsername('')
      await loadTikTokAccounts()
      setSuccessMessage('Conta TikTok adicionada! Agora conecte a sessão.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar conta')
    }
  }

  const handleConnectTikTok = async (tiktokAccountId: string) => {
    setConnectingTtId(tiktokAccountId)
    setTtQrCode(null)
    try {
      const res = await fetch('/api/tiktok/session/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktokAccountId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      if (data.data.qrCode) {
        setTtQrCode(data.data.qrCode)
        pollTikTokSession(tiktokAccountId)
      } else {
        setSuccessMessage('Sessão restaurada automaticamente!')
        setConnectingTtId(null)
        setTtSessionStatus(s => ({ ...s, [tiktokAccountId]: { status: 'active' } }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar')
      setConnectingTtId(null)
    }
  }

  const pollTikTokSession = async (tiktokAccountId: string) => {
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const res = await fetch('/api/tiktok/session/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tiktokAccountId }),
        })
        const data = await res.json()
        if (data.success && data.data.status === 'active') {
          setTtSessionStatus(s => ({ ...s, [tiktokAccountId]: data.data }))
          setTtQrCode(null)
          setConnectingTtId(null)
          setSuccessMessage('TikTok conectado com sucesso!')
          return
        }
        if (data.success && data.data.status === 'expired') {
          setError('Tempo de conexão expirado. Tente novamente.')
          setTtQrCode(null)
          setConnectingTtId(null)
          return
        }
      } catch { }
    }
    setError('Tempo limite de conexão excedido.')
    setTtQrCode(null)
    setConnectingTtId(null)
  }

  const handleDeleteTikTok = async (id: string) => {
    if (!confirm('Remover esta conta TikTok?')) return
    try {
      const res = await fetch(`/api/tiktok/accounts?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover')
      await loadTikTokAccounts()
      setSuccessMessage('Conta TikTok removida')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover')
    }
  }

  const handleAddYouTube = async () => {
    if (!ytNewChannel.trim()) {
      setError('Informe o nome do canal')
      return
    }
    try {
      const res = await fetch('/api/youtube/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: ytNewChannel.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setYtNewChannel('')
      await loadYouTubeAccounts()
      setSuccessMessage('Conta YouTube adicionada! Agora conecte a sessão.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar conta')
    }
  }

  const handleConnectYouTube = async (youtubeAccountId: string) => {
    setConnectingYtId(youtubeAccountId)
    try {
      const res = await fetch('/api/youtube/session/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeAccountId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      pollYouTubeSession(youtubeAccountId)
      setSuccessMessage('Aguarde o login do Google concluir...')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar')
      setConnectingYtId(null)
    }
  }

  const pollYouTubeSession = async (youtubeAccountId: string) => {
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const res = await fetch('/api/youtube/session/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeAccountId }),
        })
        const data = await res.json()
        if (data.success && data.data.status === 'active') {
          setYtSessionStatus(s => ({ ...s, [youtubeAccountId]: data.data }))
          setConnectingYtId(null)
          setSuccessMessage('YouTube conectado com sucesso!')
          return
        }
        if (data.success && data.data.status === 'expired') {
          setError('Tempo de conexão expirado. Tente novamente.')
          setConnectingYtId(null)
          return
        }
      } catch { }
    }
    setError('Tempo limite de conexão excedido.')
    setConnectingYtId(null)
  }

  const handleDeleteYouTube = async (id: string) => {
    if (!confirm('Remover esta conta YouTube?')) return
    try {
      const res = await fetch(`/api/youtube/accounts?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover')
      await loadYouTubeAccounts()
      setSuccessMessage('Conta YouTube removida')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover')
    }
  }

  const handleConnectScrape = async (metaAccountId: string) => {
    setConnectingSessionId(metaAccountId)
    setQrCode(null)
    try {
      const res = await fetch('/api/facebook/session/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaAccountId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      if (data.data.qrCode) {
        setQrCode(data.data.qrCode)
        pollSession(metaAccountId)
      } else {
        setSuccessMessage('Sessão restaurada automaticamente!')
        setConnectingSessionId(null)
        setSessions(s => ({ ...s, [metaAccountId]: { status: 'active' } }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar')
      setConnectingSessionId(null)
    }
  }

  const pollSession = async (metaAccountId: string) => {
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const res = await fetch('/api/facebook/session/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metaAccountId }),
        })
        const data = await res.json()
        if (data.success && data.data.status === 'active') {
          setSessions(s => ({ ...s, [metaAccountId]: data.data }))
          setQrCode(null)
          setConnectingSessionId(null)
          setSuccessMessage(`Facebook conectado como ${data.data.loggedInAs || 'usuário'}!`)
          return
        }
        if (data.success && data.data.status === 'expired') {
          setError('Tempo de conexão expirado. Tente novamente.')
          setQrCode(null)
          setConnectingSessionId(null)
          return
        }
      } catch { }
    }
    setError('Tempo limite de conexão excedido.')
    setQrCode(null)
    setConnectingSessionId(null)
  }

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/meta/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Desconectar esta página?')) return;

    setDisconnectingId(accountId);
    try {
      const response = await fetch(`/api/meta/accounts?id=${accountId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setSuccessMessage('Página desconectada com sucesso');
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Conectar Meta
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Gerencie suas contas do Facebook e Instagram
          </p>
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

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 text-center">
            <div className="inline-flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando...</p>
          </div>
        ) : (
          <>
            {/* Conectar Button */}
            {accounts.length > 0 && (
              <div className="mb-8">
                <button
                  onClick={handleConnect}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  + Conectar Mais Páginas
                </button>
              </div>
            )}

            {/* Contas Conectadas */}
            {accounts.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  ✅ Páginas Conectadas ({accounts.length})
                </h2>
                {accounts.map((account) => {
                  const session = sessions[account.id]
                  const sessionStatus = session?.status

                  return (
                    <div key={account.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          {account.profilePictureUrl && (
                            <img src={account.profilePictureUrl} alt={account.pageName} className="w-12 h-12 rounded-full" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {account.pageName}
                            </p>
                            {account.pageUsername && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">@{account.pageUsername}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          disabled={disconnectingId === account.id}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                        >
                          {disconnectingId === account.id ? 'Desconectando...' : 'Desconectar'}
                        </button>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Scraping:</span>
                          {connectingSessionId === account.id ? (
                            <span className="text-xs text-yellow-600 font-medium">🔄 Conectando...</span>
                          ) : sessionStatus === 'active' ? (
                            <span className="text-xs text-emerald-600 font-medium">
                              🟢 Ativo {session?.loggedInAs ? `(${session.loggedInAs})` : ''}
                            </span>
                          ) : sessionStatus === 'expired' ? (
                            <span className="text-xs text-red-600 font-medium">🔴 Expirada</span>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">⚪ Não conectada</span>
                          )}
                        </div>
                        {sessionStatus !== 'active' && (
                          <button
                            onClick={() => handleConnectScrape(account.id)}
                            disabled={connectingSessionId === account.id}
                            className="text-xs px-3 py-1.5 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
                          >
                            Conectar via Navegador
                          </button>
                        )}
                      </div>

                      {qrCode && connectingSessionId === account.id && (
                        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Escaneie o QR Code com seu celular
                          </p>
                          <img src={qrCode} alt="QR Code Facebook" className="mx-auto w-48 h-48" />
                          <p className="text-xs text-gray-500 mt-2">
                            Abra o Facebook no celular → Menu → QR Code → Escaneie
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Nenhuma conta conectada
                </p>
                <button
                  onClick={handleConnect}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Conectar Facebook/Instagram
                </button>
              </div>
            )}
          </>
        )}

        {/* TikTok Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            🎵 TikTok (Scraping)
          </h2>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={ttNewUsername}
                onChange={(e) => setTtNewUsername(e.target.value)}
                placeholder="Usuário do TikTok (ex: @meucanal)"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
              />
              <button
                onClick={handleAddTikTok}
                className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                + Adicionar Conta
              </button>
            </div>

            {tiktokAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma conta TikTok adicionada.
              </p>
            ) : (
              <div className="space-y-3">
                {tiktokAccounts.map((acc) => {
                  const status = ttSessionStatus[acc.id]?.status
                  return (
                    <div key={acc.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">🎵 {acc.username}</p>
                          {acc.displayName && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{acc.displayName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs">
                            {connectingTtId === acc.id ? (
                              <span className="text-yellow-600 font-medium">🔄 Conectando...</span>
                            ) : status === 'active' ? (
                              <span className="text-emerald-600 font-medium">🟢 Ativo</span>
                            ) : status === 'expired' ? (
                              <span className="text-red-600 font-medium">🔴 Expirada</span>
                            ) : (
                              <span className="text-gray-400 font-medium">⚪ Não conectada</span>
                            )}
                          </span>
                          <button
                            onClick={() => handleDeleteTikTok(acc.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-xs transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                      {status !== 'active' && (
                        <button
                          onClick={() => handleConnectTikTok(acc.id)}
                          disabled={connectingTtId === acc.id}
                          className="mt-3 text-xs px-3 py-1.5 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
                        >
                          Conectar via Navegador
                        </button>
                      )}
                      {ttQrCode && connectingTtId === acc.id && (
                        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Escaneie o QR Code com o app do TikTok
                          </p>
                          <img src={ttQrCode} alt="QR Code TikTok" className="mx-auto w-48 h-48" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* YouTube Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            📺 YouTube (Scraping)
          </h2>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={ytNewChannel}
                onChange={(e) => setYtNewChannel(e.target.value)}
                placeholder="Nome do canal (ex: Meu Canal)"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
              />
              <button
                onClick={handleAddYouTube}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                + Adicionar Canal
              </button>
            </div>

            {youtubeAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum canal YouTube adicionado.
              </p>
            ) : (
              <div className="space-y-3">
                {youtubeAccounts.map((acc) => {
                  const status = ytSessionStatus[acc.id]?.status
                  return (
                    <div key={acc.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">📺 {acc.channelName}</p>
                          {acc.channelId && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{acc.channelId}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs">
                            {connectingYtId === acc.id ? (
                              <span className="text-yellow-600 font-medium">🔄 Conectando...</span>
                            ) : status === 'active' ? (
                              <span className="text-emerald-600 font-medium">🟢 Ativo</span>
                            ) : status === 'expired' ? (
                              <span className="text-red-600 font-medium">🔴 Expirada</span>
                            ) : (
                              <span className="text-gray-400 font-medium">⚪ Não conectada</span>
                            )}
                          </span>
                          <button
                            onClick={() => handleDeleteYouTube(acc.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-xs transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                      {status !== 'active' && (
                        <button
                          onClick={() => handleConnectYouTube(acc.id)}
                          disabled={connectingYtId === acc.id}
                          className="mt-3 text-xs px-3 py-1.5 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
                        >
                          Conectar via Navegador
                        </button>
                      )}
                      {connectingYtId === acc.id && (
                        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Faça login com sua conta Google. Configure YOUTUBE_SCRAPE_USERNAME e YOUTUBE_SCRAPE_PASSWORD no .env para login automático.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 Como Conectar
          </h3>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Clique em "Conectar Mais Páginas"</li>
            <li>Você será redirecionado para a Meta</li>
            <li>Selecione e autorize as páginas desejadas</li>
            <li>Pronto! Suas páginas estarão conectadas</li>
          </ol>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <a
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            ← Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
