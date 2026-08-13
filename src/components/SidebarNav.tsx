'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Video,
  ListOrdered,
  Puzzle,
  Settings,
  CalendarClock,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/schedule', label: 'Agendamento', icon: CalendarClock },
  { href: '/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/videos', label: 'Vídeos', icon: Video },
  { href: '/fila', label: 'Fila', icon: ListOrdered },
  { href: '/extensao', label: 'Extensão', icon: Puzzle },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

export function SidebarNav() {
  const pathname = usePathname()
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || (item.href === '/dashboard' && pathname === '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
              active ? 'bg-[#1b2230] text-white' : 'text-[#9aa4b8] hover:bg-[#161c27] hover:text-white'
            }`}
          >
            <Icon size={16} className={active ? 'text-[#25b946]' : 'text-[#5c697e] transition-colors group-hover:text-[#25b946]'} />
            {item.label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#25b946]" />}
          </Link>
        )
      })}
    </nav>
  )
}