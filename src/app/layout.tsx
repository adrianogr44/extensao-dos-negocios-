import type { Metadata } from 'next'
import Image from 'next/image'
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ToastProvider'
import { SidebarNav } from '@/components/SidebarNav'

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-display-next',
})
const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body-next',
})
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-next',
})

export const metadata: Metadata = {
  title: 'Reel Machine — Studio',
  description: 'Automação de publicação de reels: Futebol e Motivação',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <ToastProvider>
          <div className="flex min-h-screen">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-[#1c2433] bg-[#0b0e15] lg:flex">
              <div className="flex items-center gap-3 border-b border-[#1c2433] px-5 py-4">
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
                  <p className="text-[11px] text-[#586074]">Studio de Automação</p>
                </div>
              </div>
              <SidebarNav />
              <div className="border-t border-[#1c2433] px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#38ef9b] pulse-dot" />
                  <span className="text-[11px] text-[#586074]">Scheduler ativo</span>
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1 lg:pl-[232px]">
              <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1c2433] bg-[#080a0f]/85 px-5 py-3 backdrop-blur lg:px-8">
                <p className="eyebrow">Painel de Controle</p>
                <p className="font-mono2 text-[12px] text-[#586074]">
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
