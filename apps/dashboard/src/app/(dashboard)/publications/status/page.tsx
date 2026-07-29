'use client';

import { useEffect, useState } from 'react';

export default function PublicationStatusPage() {
  const [publications, setPublications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/meta/publications/status');
        const data = await res.json();
        setPublications(data.publications);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return '#ffffff';
      case 'FAILED':
        return '#ffffff';
      case 'DRAFT':
        return '#ffffff';
      case 'SCHEDULED':
        return '#ffffff';
      default:
        return '#ffffff';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return '#10b981';
      case 'FAILED':
        return '#ef4444';
      case 'DRAFT':
        return '#3b82f6';
      case 'SCHEDULED':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📊 Status das Publicações</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Auto-refresh a cada 3 segundos</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      ) : publications.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600 dark:text-gray-400">Nenhuma publicação encontrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">Página Meta</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">Meta Post ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">Erro</th>
              </tr>
            </thead>
            <tbody>
              {publications.map((pub, index) => (
                <tr
                  key={pub.id}
                  className={`border-b border-gray-200 dark:border-gray-700 ${
                    index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                    {pub.id.substring(0, 12)}...
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className="inline-block px-3 py-1 rounded-full font-semibold text-sm"
                      style={{
                        backgroundColor: getStatusBg(pub.status),
                        color: getStatusColor(pub.status),
                      }}
                    >
                      {pub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {pub.metaAccount || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                    {pub.metaPostId ? pub.metaPostId.substring(0, 12) + '...' : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {pub.errorMessage ? pub.errorMessage.substring(0, 50) + '...' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
