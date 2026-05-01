import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
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
import { selectLab, useStore } from '@/lib/store'
import { APP_VERSION_TAG } from '@/lib/version'

const baseNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/labs', icon: Building2, label: 'Labs' },
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
  const [labMenuOpen, setLabMenuOpen] = useState(false)
  const [pendingLabId, setPendingLabId] = useState<string | null>(null)
  const labs = useStore((s) => s.labs)
  const lab = useStore((s) => s.lab)
  const currentUser = useStore((s) => s.currentUser)
  const authExpiresAt = useStore((s) => s.authExpiresAt)

  const navItems = currentUser?.role === 'admin'
    ? [...baseNavItems, { to: '/users', icon: Shield, label: 'Users' }] as const
    : baseNavItems

  async function handleSelectLab(labId: string) {
    setPendingLabId(labId)
    try {
      await selectLab(labId)
      setLabMenuOpen(false)
    } finally {
      setPendingLabId(null)
    }
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-2)]">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Logo />
        <span className="font-sans text-[15px] font-semibold tracking-tight">Rackpad</span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)]">
          {APP_VERSION_TAG}
        </span>
      </div>

      <div className="mx-3 mb-4">
        <button
          type="button"
          onClick={() => setLabMenuOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2.5 py-1.5 text-left"
        >
          <div className="min-w-0 flex flex-col leading-tight">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-fg-faint)]">Lab</span>
            <span className="truncate text-xs font-medium">{lab.name}</span>
          </div>
          <ChevronDown
            className={cn(
              'size-3.5 text-[var(--color-fg-subtle)] transition-transform',
              labMenuOpen ? 'rotate-180' : 'rotate-0',
            )}
          />
        </button>
        {labMenuOpen && (
          <div className="mt-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] p-2 shadow-[var(--shadow-elev)]">
            <div className="space-y-1">
              {labs.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => void handleSelectLab(entry.id)}
                  disabled={pendingLabId === entry.id || entry.id === lab.id}
                  className={cn(
                    'flex w-full items-center justify-between rounded-[var(--radius-xs)] px-2 py-1.5 text-left text-xs transition-colors',
                    entry.id === lab.id
                      ? 'bg-[var(--color-surface)] text-[var(--color-fg)]'
                      : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]',
                  )}
                >
                  <span className="min-w-0 truncate">{entry.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)]">
                    {pendingLabId === entry.id ? '...' : entry.id === lab.id ? 'active' : 'use'}
                  </span>
                </button>
              ))}
            </div>
            <Link
              to="/labs"
              onClick={() => setLabMenuOpen(false)}
              className="mt-2 flex items-center justify-between rounded-[var(--radius-xs)] border border-[var(--color-line)] px-2 py-1.5 text-xs text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-line-strong)] hover:text-[var(--color-fg)]"
            >
              <span>Manage labs</span>
              <Building2 className="size-3.5" />
            </Link>
          </div>
        )}
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
          <div className="space-y-1 text-[11px] text-[var(--color-fg-subtle)]">
            <div>{currentUser.displayName}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-faint)]">
              {currentUser.role}
              {authExpiresAt ? ` | expires ${new Date(authExpiresAt).toLocaleDateString()}` : ''}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
      <rect x="6" y="6" width="20" height="3" fill="var(--color-accent)" />
      <rect x="6" y="11" width="20" height="3" fill="var(--color-accent)" opacity="0.7" />
      <rect x="6" y="16" width="20" height="3" fill="var(--color-accent)" opacity="0.5" />
      <rect x="6" y="21" width="20" height="3" fill="var(--color-accent)" opacity="0.3" />
    </svg>
  )
}
