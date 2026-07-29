import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'

const roboto = Roboto({ weight: ['400', '700'], subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PostReels',
  description: 'Dashboard de edição de Reels',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${roboto.className} min-h-screen bg-zinc-950 text-zinc-50 antialiased`}>
        {children}
      </body>
    </html>
  )
}
