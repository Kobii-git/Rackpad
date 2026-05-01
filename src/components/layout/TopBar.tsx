import * as React from 'react'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title?: string
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
}

export function TopBar({ title, subtitle, meta, actions }: TopBarProps) {
  return (
    <header className={cn(
      'relative flex h-14 shrink-0 items-center justify-between gap-4 px-6',
      'border-b border-[var(--color-line)] bg-[var(--color-bg-2)]',
    )}>
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          {subtitle && (
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              {subtitle}
            </div>
          )}
          {title && (
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-[var(--color-fg)] truncate">
              {title}
            </h1>
          )}
        </div>
        {meta && <div className="hidden md:flex items-center gap-3 pl-4 border-l border-[var(--color-line)]">{meta}</div>}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--color-accent)]" />
        </Button>
        <ThemeToggle />
        <div
          className="ml-2 grid size-7 place-items-center rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] font-mono text-[11px] text-[var(--color-fg)]"
          aria-label="Account"
        >
          AD
        </div>
      </div>
    </header>
  )
}
