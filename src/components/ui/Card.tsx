import * as React from 'react'
import { cn } from '@/lib/utils'

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-2)]',
        '[box-shadow:var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-2 border-b border-[var(--color-line)] px-4 py-3', className)}
      {...props}
    />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-0.5', className)} {...props} />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardLabel = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]', className)}
      {...props}
    />
  ),
)
CardLabel.displayName = 'CardLabel'

export const CardHeading = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn('text-sm font-semibold text-[var(--color-fg)]', className)}
      {...props}
    />
  ),
)
CardHeading.displayName = 'CardHeading'

export const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4', className)} {...props} />
  ),
)
CardBody.displayName = 'CardBody'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('border-t border-[var(--color-line)] px-4 py-2', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'
