import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fábrica de Reels',
  description: 'Automatizador de Reels para Instagram',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <nav className="border-b border-zinc-800 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <a href="/" className="text-xl font-bold text-purple-400">
              Fábrica de Reels
            </a>
            <div className="flex gap-6 text-sm">
              <a href="/dashboard" className="hover:text-purple-400 transition-colors">
                Dashboard
              </a>
              <a href="/editor-massa" className="hover:text-purple-400 transition-colors">
                Editor Massa
              </a>
              <a href="/schedule" className="hover:text-purple-400 transition-colors">
                Agendamento
              </a>
              <a href="/settings" className="hover:text-purple-400 transition-colors">
                Configurações
              </a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  )
}
