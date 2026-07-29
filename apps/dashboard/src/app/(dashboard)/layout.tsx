'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Clock,
  FileText,
  Settings,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Vídeos',
    href: '/videos',
    icon: <Clock className="w-5 h-5" />,
  },
  {
    label: 'Nichos',
    href: '/nichos',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: '━━━━ SCHEDULER ━━━━',
    href: '#',
    icon: <div className="w-5 h-5" />,
  },
  {
    label: 'Calendário',
    href: '/publications/calendar',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Agendamentos',
    href: '/publications',
    icon: <Clock className="w-5 h-5" />,
  },
  {
    label: 'Status de Publicações',
    href: '/publications/status',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Novo Agendamento',
    href: '/publications/batch',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Configurações',
    href: '/settings/meta-accounts',
    icon: <Settings className="w-5 h-5" />,
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen bg-white dark:bg-gray-900">
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16" />
          <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-slate-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 z-40 lg:static lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                P
              </div>
              <span className="font-bold text-gray-900 dark:text-white hidden sm:inline">
                PostReels
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              // Verifica se é separador
              if (item.href === '#') {
                return (
                  <div
                    key={item.label}
                    className="py-2 px-4 mt-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide"
                  >
                    {item.label}
                  </div>
                );
              }

              // Verifica se é exatamente a página ou uma subrota específica
              const isActive =
                pathname === item.href ||
                (item.href !== '/' &&
                  item.href !== '/publications' &&
                  pathname.startsWith(item.href + '/')) ||
                (item.href === '/publications' && pathname === '/publications');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PostReels v2.0 Scheduler
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay (mobile only) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {new Date().toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <div className="h-full p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
