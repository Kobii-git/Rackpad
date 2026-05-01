import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider rounded-[var(--radius-xs)] border',
  {
    variants: {
      tone: {
        neutral: 'border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[var(--color-fg-muted)]',
        accent: 'border-[var(--color-accent-soft)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent-strong)]',
        ok: 'border-[var(--color-ok)]/30 bg-[var(--color-ok)]/10 text-[var(--color-ok)]',
        warn: 'border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 text-[var(--color-warn)]',
        err: 'border-[var(--color-err)]/30 bg-[var(--color-err)]/10 text-[var(--color-err)]',
        info: 'border-[var(--color-info)]/30 bg-[var(--color-info)]/10 text-[var(--color-info)]',
        cyan: 'border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props} />
  ),
)
Badge.displayName = 'Badge'
