import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent-strong)]',
        secondary: 'bg-[var(--color-surface-2)] text-[var(--color-fg)] hover:bg-[var(--color-surface-3)]',
        outline: 'border border-[var(--color-line-strong)] bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface)] hover:border-[var(--color-accent-soft)]',
        ghost: 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]',
        link: 'text-[var(--color-accent)] underline-offset-4 hover:underline',
        destructive: 'bg-[var(--color-err)]/15 text-[var(--color-err)] hover:bg-[var(--color-err)]/25 border border-[var(--color-err)]/30',
      },
      size: {
        default: 'h-8 px-3 text-sm rounded-[var(--radius-sm)]',
        sm: 'h-7 px-2.5 text-xs rounded-[var(--radius-xs)]',
        lg: 'h-9 px-4 text-sm rounded-[var(--radius-md)]',
        icon: 'h-8 w-8 rounded-[var(--radius-sm)]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { buttonVariants }
