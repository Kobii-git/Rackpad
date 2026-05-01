import { useMemo } from 'react'
import type { IpAssignment, Subnet } from '@/lib/types'
import { ipToInt, cidrSize } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'

interface IpUtilizationBarProps {
  subnet: Subnet
  assignments: IpAssignment[]
}

const cellSize = 12

export function IpUtilizationBar({ subnet, assignments }: IpUtilizationBarProps) {
  const total = cidrSize(subnet.cidr)
  const baseInt = ipToInt(subnet.cidr.split('/')[0])

  const usedMap = useMemo(() => {
    const m = new Map<number, IpAssignment>()
    for (const a of assignments) m.set(ipToInt(a.ipAddress), a)
    return m
  }, [assignments])

  const cells = total
  const used = assignments.length
  const pct = Math.round((used / Math.max(1, total - 2)) * 100)

  // For /24, render up to 256 cells in a tight grid
  const showCells = Math.min(cells, 256)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{subnet.cidr}</span>
        </div>
        <div className="flex items-baseline gap-3 font-mono text-[11px]">
          <span className="text-[var(--color-fg-muted)]">
            <span className="text-[var(--color-fg)]">{used}</span>
            <span className="text-[var(--color-fg-faint)]"> / {total - 2}</span>
          </span>
          <span className="text-[var(--color-accent)]">{pct}%</span>
        </div>
      </div>

      <div
        className="grid border border-[var(--color-line)] bg-[var(--color-bg)] p-1 rounded-[var(--radius-sm)]"
        style={{
          gridTemplateColumns: `repeat(32, ${cellSize}px)`,
          gap: 1,
        }}
      >
        {Array.from({ length: showCells }).map((_, i) => {
          const ipInt = baseInt + i
          const assignment = usedMap.get(ipInt)
          const isNetwork = i === 0
          const isBroadcast = i === showCells - 1

          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className="cursor-pointer transition-all hover:scale-110"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getCellColor(assignment, isNetwork || isBroadcast),
                    opacity: isNetwork || isBroadcast ? 0.3 : assignment ? 1 : 0.15,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-[11px]">
                  <div className="font-mono">
                    {intToIp(ipInt)}
                  </div>
                  {isNetwork && <div className="text-[var(--color-fg-subtle)]">network</div>}
                  {isBroadcast && <div className="text-[var(--color-fg-subtle)]">broadcast</div>}
                  {assignment && (
                    <>
                      <div className="text-[var(--color-fg)]">{assignment.hostname}</div>
                      <div className="text-[var(--color-fg-subtle)] capitalize">
                        {assignment.assignmentType}
                      </div>
                    </>
                  )}
                  {!assignment && !isNetwork && !isBroadcast && (
                    <div className="text-[var(--color-fg-subtle)]">free</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 font-mono text-[10px] text-[var(--color-fg-subtle)]">
        <Legend color="var(--color-cyan)" label="Device" />
        <Legend color="var(--color-accent)" label="VM" />
        <Legend color="var(--color-info)" label="Container" />
        <Legend color="var(--color-warn)" label="Reserved" />
        <Legend color="var(--color-fg-faint)" label="Free" muted />
      </div>
    </div>
  )
}

function getCellColor(assignment?: IpAssignment, edge?: boolean): string {
  if (edge) return 'var(--color-fg-faint)'
  if (!assignment) return 'var(--color-line-strong)'
  switch (assignment.assignmentType) {
    case 'device': return 'var(--color-cyan)'
    case 'interface': return 'var(--color-cyan-soft)'
    case 'vm': return 'var(--color-accent)'
    case 'container': return 'var(--color-info)'
    case 'reserved': return 'var(--color-warn)'
    case 'infrastructure': return 'var(--color-accent-soft)'
    default: return 'var(--color-line-strong)'
  }
}

function Legend({ color, label, muted }: { color: string; label: string; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-[1px]" style={{ backgroundColor: color, opacity: muted ? 0.3 : 1 }} />
      <span>{label}</span>
    </span>
  )
}

function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')
}
