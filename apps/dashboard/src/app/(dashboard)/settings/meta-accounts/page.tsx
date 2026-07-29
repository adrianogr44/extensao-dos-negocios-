'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MetaAccountDTO } from '@/lib/meta/types';

export default function MetaAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<MetaAccountDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

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
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {account.profilePictureUrl && (
                        <img
                          src={account.profilePictureUrl}
                          alt={account.pageName}
                          className="w-12 h-12 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {account.pageName}
                        </p>
                        {account.pageUsername && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            @{account.pageUsername}
                          </p>
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
                ))}
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
