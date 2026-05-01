import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { motion } from 'motion/react'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  hint?: string
  accent?: boolean
  className?: string
  delay?: number
}

export function StatCard({ label, value, unit, hint, accent, className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className={cn('relative overflow-hidden', className)}>
        {accent && (
          <span className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-60" />
        )}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              {label}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-sans text-3xl font-semibold tracking-tight text-[var(--color-fg)] [font-variant-numeric:tabular-nums]">
              {value}
            </span>
            {unit && (
              <span className="font-mono text-[11px] uppercase text-[var(--color-fg-subtle)]">{unit}</span>
            )}
          </div>
          {hint && (
            <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">{hint}</div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
