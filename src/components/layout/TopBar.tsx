import type { ReactNode } from 'react'
import { Shield, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { logout, useStore } from '@/lib/store'

interface TopBarProps {
  title?: string
  subtitle?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}

export function TopBar({ title, subtitle, meta, actions }: TopBarProps) {
  const currentUser = useStore((s) => s.currentUser)

  return (
    <header
      className={cn(
        'relative flex h-14 shrink-0 items-center justify-between gap-4 px-6',
        'border-b border-[var(--color-line)] bg-[var(--color-bg-2)]',
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            {subtitle && (
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                {subtitle}
              </div>
            )}
            {title && (
              <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
                {title}
              </h1>
            )}
          </div>
          {meta && (
            <div className="hidden items-center gap-3 border-l border-[var(--color-line)] pl-4 md:flex">
              {meta}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {actions}
        {currentUser && (
          <>
            <Badge tone={currentUser.role === 'admin' ? 'accent' : currentUser.role === 'editor' ? 'info' : 'neutral'}>
              <Shield className="size-3" />
              {currentUser.role}
            </Badge>
     