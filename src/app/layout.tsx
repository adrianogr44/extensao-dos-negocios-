import type { Metadata } from 'next'
import Image from 'next/image'
import './globals.css'
import { ToastProvider } from '@/components/ToastProvider'
import { SidebarNav } from '@/components/SidebarNav'

export const metadata: Metadata = {
  title: 'Reel Machine — Studio',
  description: 'Automação de publicação de reels: Futebol e Motivação',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <div className="flex min-h-screen">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-[#232b3c] bg-[#0f1220] lg:flex">
              <div className="flex items-center gap-3 border-b border-[#232b3c] px-5 py-4">
                <Image
                  src="/reel-machine.png"
                  alt="Reel Machine"
                  width={40}
                  height={40}
                  className="aspect-square rounded-lg object-cover"
                  priority
                />
                <div>
                  <p className="font-display text-[15px] font-bold tracking-tight">Reel Machine</p>
                  <p className="text-[11px] text-[#5c697e]">Studio de Automação</p>
                </div>
              </div>
              <SidebarNav />
              <div className="border-t border-[#232b3c] px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#34d399] pulse-dot" />
                  <span className="text-[11px] text-[#5c697e]">Scheduler ativo</span>
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1 lg:pl-[232px]">
              <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#232b3c] bg-[#0b0d14]/85 px-5 py-3 backdrop-blur lg:px-8">
                <p className="eyebrow">Painel de Controle</p>
                <p className="font-mono2 text-[12px] text-[#5c697e]">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
              </div>
              <main className="mx-auto w-full max-w-[1200px] px-5 py-6 lg:px-8">{children}</main>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}