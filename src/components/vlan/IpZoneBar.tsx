import { useMemo } from 'react'
import type { DhcpScope, IpZone, Subnet } from '@/lib/types'
import { ipToInt, cidrSize } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { Mono } from '@/components/shared/Mono'

interface IpZoneBarProps {
  subnet: Subnet
  zones: IpZone[]
  scopes: DhcpScope[]
}

const ZONE_COLOR: Record<IpZone['kind'], string> = {
  static: 'var(--color-cyan)',
  dhcp: 'var(--color-accent)',
  reserved: 'var(--color-warn)',
  infrastructure: 'var(--color-info)',
}

const ZONE_LABEL: Record<IpZone['kind'], string> = {
  static: 'Static',
  dhcp: 'DHCP',
  reserved: 'Reserved',
  infrastructure: 'Infrastructure',
}

export function IpZoneBar({ subnet, zones, scopes }: IpZoneBarProps) {
  const total = cidrSize(subnet.cidr)
  const baseInt = ipToInt(subnet.cidr.split('/')[0])

  // Combine zones + DHCP scopes (treating scopes as implicit zones if no explicit dhcp zone covers them)
  const combined = useMemo(() => {
    const explicit = [...zones]
    // If no DHCP zone exists but a scope does, derive one
    const hasDhcp = zones.some((z) => z.kind === 'dhcp')
    if (!hasDhcp) {
      for (const sc of scopes) {
        explicit.push({
          id: `derived_${sc.id}`,
          subnetId: subnet.id,
          kind: 'dhcp',
          startIp: sc.startIp,
          endIp: sc.endIp,
          description: sc.name,
        })
      }
    }
    return explicit.sort((a, b) => ipToInt(a.startIp) - ipToInt(b.startIp))
  }, [zones, scopes, subnet])

  if (combined.length === 0) {
    return (
      <div className="text-[11px] text-[var(--color-fg-subtle)]">
        No zones documented for this subnet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* The bar */}
      <div className="relative flex h-6 w-full overflow-hidden border border-[var(--color-line)] rounded-[var(--radius-xs)] bg-[var(--color-bg)]">
        {(() => {
          // Render zones positioned absolutely so gaps are visible
          return combined.map((zone) => {
            const startN = ipToInt(zone.startIp) - baseInt
            const endN = ipToInt(zone.endIp) - baseInt
            const left = (startN / total) * 100
            const width = ((endN - startN + 1) / total) * 100
            const color = ZONE_COLOR[zone.kind]
            const size = endN - startN + 1
            return (
              <Tooltip key={zone.id}>
                <TooltipTrigger asChild>
                  <button
                    className="absolute top-0 h-full transition-all hover:brightness-125 cursor-default"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: `${color}30`,
                      borderLeft: `1px solid ${color}80`,
                      borderRight: `1px solid ${color}80`,
                    }}
                  >
                    {width > 4 && (
                      <span
                        className="font-mono text-[9px] uppercase tracking-wider"
                        style={{ color }}
                      >
                        {ZONE_LABEL[zone.kind]}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-[11px] space-y-0.5">
                    <div className="font-medium" style={{ color }}>
                      {ZONE_LABEL[zone.kind]}
                    </div>
                    <Mono className="text-[var(--color-fg-subtle)]">
                      {zone.startIp} → {zone.endIp}
                    </Mono>
                    <div className="text-[var(--color-fg-subtle)]">{size} addresses</div>
                    {zone.description && (
                      <div className="text-[var(--color-fg-faint)]">{zone.description}</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })
        })()}
      </div>

      {/* Scale */}
      <div className="flex justify-between font-mono text-[9px] text-[var(--color-fg-faint)] px-0.5">
        <Mono>{subnet.cidr.split('/')[0]}</Mono>
        <span>·</span>
        <Mono>.{(total - 1) & 0xff}</Mono>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--color-fg-subtle)] flex-wrap">
        {(['static', 'dhcp', 'reserved', 'infrastructure'] as const).map((k) => {
          const has = combined.some((z) => z.kind === k)
          if (!has) return null
          const count = combined.filter((z) => z.kind === k).length
          return (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[1px]" style={{ backgroundColor: ZONE_COLOR[k] }} />
              <span>
                {ZONE_LABEL[k]} {count > 1 && `(${count})`}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
