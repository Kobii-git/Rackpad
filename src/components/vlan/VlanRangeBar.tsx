import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { Vlan, VlanRange } from '@/lib/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { Mono } from '@/components/shared/Mono'

interface VlanRangeBarProps {
  ranges: VlanRange[]
  vlans: Vlan[]
  onSelectRange?: (rangeId: string) => void
  selectedRangeId?: string
}

const TOTAL_VLANS = 4094

export function VlanRangeBar({ ranges, vlans, onSelectRange, selectedRangeId }: VlanRangeBarProps) {
  // Sort ranges by start
  const sorted = useMemo(() => [...ranges].sort((a, b) => a.startVlan - b.startVlan), [ranges])

  // Build segments — covered ranges + gaps
  const segments = useMemo(() => {
    const segs: Array<{ start: number; end: number; range?: VlanRange }> = []
    let cursor = 1
    for (const r of sorted) {
      if (r.startVlan > cursor) {
        segs.push({ start: cursor, end: r.startVlan - 1 })
      }
      segs.push({ start: r.startVlan, end: r.endVlan, range: r })
      cursor = r.endVlan + 1
    }
    if (cursor <= TOTAL_VLANS) {
      segs.push({ start: cursor, end: TOTAL_VLANS })
    }
    return segs
  }, [sorted])

  // Map of used VLAN IDs for tick rendering
  const usedIds = useMemo(() => new Set(vlans.map((v) => v.vlanId)), [vlans])

  return (
    <div className="space-y-2">
      {/* The bar */}
      <div className="flex h-8 w-full overflow-hidden border border-[var(--color-line)] rounded-[var(--radius-xs)] bg-[var(--color-bg)]">
        {segments.map((seg, i) => {
          const width = ((seg.end - seg.start + 1) / TOTAL_VLANS) * 100
          const inRangeUsed = vlans.filter((v) => v.vlanId >= seg.start && v.vlanId <= seg.end).length
          const total = seg.end - seg.start + 1
          const isSelected = seg.range && seg.range.id === selectedRangeId

          if (!seg.range) {
            // Unallocated gap
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className="border-r border-[var(--color-line)] bg-[var(--color-bg-3)]/40 last:border-r-0"
                    style={{ width: `${width}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-[11px]">
                    <div className="font-mono text-[var(--color-fg-subtle)]">unallocated</div>
                    <div>
                      VLAN {seg.start}–{seg.end} · {total} IDs free
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                  onClick={() => onSelectRange?.(seg.range!.id)}
                  className="relative border-r border-[var(--color-line-strong)] last:border-r-0 transition-all hover:brightness-125"
                  style={{
                    width: `${width}%`,
                    backgroundColor: `${seg.range.color}40`,
                    boxShadow: isSelected ? `inset 0 0 0 1px ${seg.range.color}` : 'none',
                  }}
                >
                  {/* Range label, only if there's room */}
                  {width > 5 && (
                    <span
                      className="absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-wider truncate px-1"
                      style={{ color: seg.range.color }}
                    >
                      {seg.range.name}
                    </span>
                  )}
                  {/* Used VLAN ticks */}
                  <div className="absolute inset-x-0 bottom-0 h-1 flex">
                    {Array.from({ length: total }).map((_, idx) => {
                      const id = seg.start + idx
                      if (!usedIds.has(id)) return null
                      const left = (idx / total) * 100
                      return (
                        <span
                          key={idx}
                          className="absolute size-1 rounded-full"
                          style={{
                            left: `${left}%`,
                            top: -3,
                            backgroundColor: seg.range!.color,
                          }}
                        />
                      )
                    })}
                  </div>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-[11px] space-y-0.5">
                  <div className="font-medium" style={{ color: seg.range.color }}>
                    {seg.range.name}
                  </div>
                  <div className="text-[var(--color-fg-subtle)]">
                    VLAN {seg.range.startVlan}–{seg.range.endVlan}
                  </div>
                  <div className="text-[var(--color-fg-subtle)]">
                    {inRangeUsed} used · {total - inRangeUsed} free
                  </div>
                  {seg.range.purpose && <div className="text-[var(--color-fg-faint)]">{seg.range.purpose}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Scale */}
      <div className="flex justify-between font-mono text-[9px] text-[var(--color-fg-faint)] px-0.5">
        <span>1</span>
        <span>1024</span>
        <span>2048</span>
        <span>3072</span>
        <span>4094</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        {sorted.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelectRange?.(r.id)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-[var(--radius-xs)] transition-colors ${
              r.id === selectedRangeId
                ? 'border-[var(--color-line-strong)] bg-[var(--color-surface)]'
                : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]'
            }`}
          >
            <span className="size-2 rounded-[1px]" style={{ backgroundColor: r.color }} />
            <span className="text-[11px] text-[var(--color-fg)]">{r.name}</span>
            <Mono className="text-[10px] text-[var(--color-fg-subtle)]">
              {r.startVlan}–{r.endVlan}
            </Mono>
          </button>
        ))}
      </div>
    </div>
  )
}
