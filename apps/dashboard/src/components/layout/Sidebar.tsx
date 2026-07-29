'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◻' },
  { href: '/videos', label: 'Vídeos', icon: '▶' },
  { href: '/publications', label: 'Publicações', icon: '📊' },
  { href: '/nichos', label: 'Nichos', icon: '◻' },
  { href: '/settings', label: 'Configurações', icon: '◻' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-14 items-center border-b border-zinc-800 px-6">
        <Link href="/" className="text-lg font-bold text-primary">
          PostReels
        </Link>
      </div>
      <nav className="space-y-1 p-4">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50'
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
