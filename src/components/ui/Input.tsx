import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full bg-[var(--color-bg)] border border-[var(--color-line)] px-2.5 text-sm font-sans',
        'placeholder:text-[var(--color-fg-faint)] text-[var(--color-fg)]',
        'rounded-[var(--radius-sm)]',
        'focus-visible:outline-none focus-visible:border-[var(--color-accent-soft)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent-soft)]',
        'disabled:opacity-40',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
