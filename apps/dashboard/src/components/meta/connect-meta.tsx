'use client';
import { useState } from 'react';
import { MetaAccountDTO } from '@/lib/meta/types';

interface ConnectMetaProps {
  account?: MetaAccountDTO;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function ConnectMeta({ account, onConnect, onDisconnect }: ConnectMetaProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

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

      // Redirecionar para OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar?')) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meta/accounts?id=${account?.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      await onDisconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Conectar Meta (Facebook/Instagram)
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {account ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900 rounded-lg">
            <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Conectado
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-200">
                {account.pageName}
              </p>
              {account.pageUsername && (
                <p className="text-xs text-emerald-600 dark:text-emerald-300">
                  @{account.pageUsername}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {isLoading ? 'Desconectando...' : 'Desconectar Conta'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Conecte sua conta do Facebook/Instagram para agendar publicações automaticamente.
          </p>

          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {isLoading ? 'Conectando...' : 'Conectar Facebook/Instagram'}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            ℹ️ Você será redirecionado para autorizar o acesso seguro.
          </p>
        </div>
      )}
    </div>
  );
}
