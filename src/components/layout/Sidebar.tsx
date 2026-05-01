import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  Cable,
  Network,
  Boxes,
  Workflow,
  Search,
  ChevronDown,
  Hash,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { APP_VERSION_TAG } from '@/lib/version'

const baseNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/racks', icon: Server, label: 'Racks' },
  { to: '/devices', icon: Boxes, label: 'Devices' },
  { to: '/ports', icon: Cable, label: 'Ports' },
  { to: '/cables', icon: Workflow, label: 'Cables' },
  { to: '/vlans', icon: Hash, label: 'VLANs' },
  { to: '/ipam', icon: Network, label: 'IPAM' },
] as const

interface SidebarProps {
  onOpenSearch?: () => void
}

export function Sidebar({ onOpenSearch }: SidebarProps) {
  const lab = useStore((s) => s.lab)
  const currentUser = useStore((s) => s.currentUser)
  const authExpiresAt = useStore((s) => s.authExpiresAt)

  const navItems = currentUser?.role === 'admin'
    ? [...baseNavItems, { to: '/users', icon: Shield, label: 'Users' }] as const
    : baseNavItems

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-2)]">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Logo />
        <span className="font-sans text-[15px] font-semibold tracking-tight">Rackpad</span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)]">
          {APP_VERSION_TAG}
        </span>
      </div>

      <div className="mx-3 mb-4 flex cursor-default items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2.5 py-1.5">
        <div className="min-w-0 flex flex-col leading-tight">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-fg-faint)]">Lab</span>
          <span className="truncate text-xs font-medium">{lab.name}</span>
        </div>
        <ChevronDown className="size-3.5 text-[var(--color-fg-subtle)]" />
      </div>

      <button
        onClick={onOpenSearch}
        className="mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2.5 py-1.5 text-[var(--color-fg-faint)] transition-colors hover:border-[var(--color-line-strong)] hover:text-[var(--color-fg-subtle)]"
      >
        <Search className="size-3.5" />
        <span className="text-xs">Search...</span>
        <kbd className="ml-auto font-mono text-[10px]">Ctrl+K</kbd>
      </button>

      <nav className="flex flex-col gap-px px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-[var(--color-surface)] text-[var(--color-fg)]'
                  : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'h-3 w-px shrink-0 -ml-0.5 transition-colors',
                    isActive ? 'bg-[var(--color-accent)]' : 'bg-transparent',
                  )}
                />
                <item.icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-[var(--color-line)] px-4 py-3">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="size-1.5 rounded-full bg-[var(--color-ok)] shadow-[0_0_0_2px_var(--color-ok-glow)]" />
          <span className="font-mono uppercase tracking-wider text-[var(--color-fg-subtle)]">Authenticated</span>
        </div>
        {currentUser && (
          <div className="space-y-1 text-[11px] text-[var(--color-fg-subtl