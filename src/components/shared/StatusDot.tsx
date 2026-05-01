import { cn } from '@/lib/utils'
import type { DeviceStatus, LinkState } from '@/lib/types'

interface StatusDotProps {
  status?: DeviceStatus
  link?: LinkState
  size?: 'sm' | 'md'
  className?: string
}

export function StatusDot({ status, link, size = 'sm', className }: StatusDotProps) {
  let color = 'var(--color-fg-faint)'
  let glow = 'transparent'
  let pulse = false

  if (link !== undefined) {
    if (link === 'up') {
      color = 'var(--color-cyan)'
      glow = 'var(--color-cyan-glow)'
      pulse = true
    } else if (link === 'down') {
      color = 'var(--color-fg-faint)'
    } else if (link === 'disabled') {
      color = 'var(--color-fg-subtle)'
    }
  } else if (status !== undefined) {
    switch (status) {
      case 'online':
        color = 'var(--color-ok)'; glow = 'var(--color-ok-glow)'; pulse = true; break
      case 'offline':
        color = 'var(--color-fg-faint)'; break
      case 'warning':
        color = 'var(--color-warn)'; glow = 'var(--color-warn-glow)'; break
      case 'maintenance':
        color = 'var(--color-info)'; glow = 'var(--color-info-glow)'; break
      case 'unknown':
        color = 'var(--color-fg-subtle)'; break
    }
  }

  const dim = size === 'sm' ? 6 : 8

  return (
    <span
      className={cn('relative inline-block shrink-0 rounded-full', pulse && 'animate-pulse-slow', className)}
      style={{
        width: dim,
        height: dim,
        backgroundColor: color,
        boxShadow: `0 0 0 ${size === 'sm' ? 2 : 3}px ${glow}`,
      }}
      aria-hidden
    />
  )
}
