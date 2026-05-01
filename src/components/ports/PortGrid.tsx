import { motion } from 'motion/react'
import type { Port, PortLink, Device } from '@/lib/types'
import { cn, portTypeColor, portTypeLabel } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'

interface PortGridProps {
  device: Device
  ports: Port[]
  links: Record<string, PortLink>
  portsById: Record<string, Port>
  devicesById: Record<string, Device>
  onSelectPort?: (portId: string) => void
  selectedPortId?: string
}

export function PortGrid({
  device,
  ports,
  links,
  portsById,
  devicesById,
  onSelectPort,
  selectedPortId,
}: PortGridProps) {
  // Group ports by kind for visual sectioning
  const sections = groupPortsByKind(ports)

  return (
    <div className="flex flex-col gap-4">
      {/* Device chassis */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] overflow-hidden">
        {/* Chassis label strip */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-bg-2)] px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              {device.hostname}
            </span>
            <span className="text-[10px] text-[var(--color-fg-faint)]">·</span>
            <span className="font-mono text-[10px] text-[var(--color-fg-faint)]">
              {device.manufacturer} {device.model}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)]">
            {ports.length} ports
          </span>
        </div>

        {/* Port sections */}
        <div className="flex flex-col gap-3 p-3 bg-[var(--color-bg-3)]">
          {sections.map(({ kind, items }) => (
            <PortSection
              key={kind}
              kind={kind}
              items={items}
              links={links}
              portsById={portsById}
              devicesById={devicesById}
              onSelectPort={onSelectPort}
              selectedPortId={selectedPortId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function groupPortsByKind(ports: Port[]) {
  const groups = new Map<string, Port[]>()
  for (const p of ports) {
    if (!groups.has(p.kind)) groups.set(p.kind, [])
    groups.get(p.kind)!.push(p)
  }
  return Array.from(groups.entries()).map(([kind, items]) => ({
    kind: kind as Port['kind'],
    items: items.sort((a, b) => a.position - b.position),
  }))
}

interface PortSectionProps {
  kind: Port['kind']
  items: Port[]
  links: Record<string, PortLink>
  portsById: Record<string, Port>
  devicesById: Record<string, Device>
  onSelectPort?: (portId: string) => void
  selectedPortId?: string
}

function PortSection({
  kind,
  items,
  links,
  portsById,
  devicesById,
  onSelectPort,
  selectedPortId,
}: PortSectionProps) {
  // 2 rows like a real switch: odd on top, even on bottom
  // For ≤8 ports, single row
  const useTwoRows = items.length > 8
  const top = useTwoRows ? items.filter((_, i) => i % 2 === 0) : items
  const bottom = useTwoRows ? items.filter((_, i) => i % 2 === 1) : []

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          {portTypeLabel[kind]}
        </span>
        <span
          className="h-px flex-1"
          style={{ backgroundColor: portTypeColor[kind], opacity: 0.25 }}
        />
        <span className="font-mono text-[9px] text-[var(--color-fg-faint)]">{items.length}</span>
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap gap-1">
          {top.map((p, idx) => (
            <PortCell
              key={p.id}
              port={p}
              link={links[p.id]}
              portsById={portsById}
              devicesById={devicesById}
              onSelect={onSelectPort}
              selected={selectedPortId === p.id}
              delay={idx * 0.012}
            />
          ))}
        </div>
        {useTwoRows && (
          <div className="flex flex-wrap gap-1">
            {bottom.map((p, idx) => (
              <PortCell
                key={p.id}
                port={p}
                link={links[p.id]}
                portsById={portsById}
                devicesById={devicesById}
                onSelect={onSelectPort}
                selected={selectedPortId === p.id}
                delay={idx * 0.012 + 0.05}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface PortCellProps {
  port: Port
  link?: PortLink
  portsById: Record<string, Port>
  devicesById: Record<string, Device>
  onSelect?: (portId: string) => void
  selected?: boolean
  delay?: number
}

function PortCell({ port, link, portsById, devicesById, onSelect, selected, delay = 0 }: PortCellProps) {
  const isLinked = port.linkState === 'up'
  const baseColor = portTypeColor[port.kind]

  // Resolve the other end of the link
  let otherDevice: Device | undefined
  let otherPort: Port | undefined
  if (link) {
    const otherPortId = link.fromPortId === port.id ? link.toPortId : link.fromPortId
    otherPort = portsById[otherPortId]
    if (otherPort) otherDevice = devicesById[otherPort.deviceId]
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => onSelect?.(port.id)}
          className={cn(
            'relative flex flex-col items-center gap-0.5 px-1.5 py-1.5',
            'border rounded-[var(--radius-xs)] transition-all',
            'min-w-[40px]',
            selected
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/8'
              : 'border-[var(--color-line-strong)] bg-[var(--color-bg)] hover:border-[var(--color-fg-subtle)] hover:bg-[var(--color-surface)]',
          )}
        >
          {/* Top: port name */}
          <span className="font-mono text-[10px] leading-none text-[var(--color-fg)]">
            {port.name}
          </span>

          {/* Middle: visual port glyph */}
          <span
            className="relative block h-1.5 w-7 rounded-[1px]"
            style={{
              backgroundColor: baseColor,
              opacity: isLinked ? 1 : 0.35,
            }}
            aria-hidden
          />

          {/* Bottom: link LED */}
          <span
            className={cn(
              'block size-1 rounded-full transition-colors',
              isLinked ? 'animate-pulse-slow' : '',
            )}
            style={{
              backgroundColor: isLinked ? 'var(--color-cyan)' : 'var(--color-fg-faint)',
              boxShadow: isLinked ? '0 0 4px var(--color-cyan-glow)' : 'none',
            }}
          />
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="flex flex-col gap-0.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-medium">{port.name}</span>
            <span className="text-[var(--color-fg-subtle)]">
              {portTypeLabel[port.kind]} · {port.speed}
            </span>
          </div>
          {isLinked && otherDevice && otherPort ? (
            <span className="text-[var(--color-cyan)]">
              ↔ {otherDevice.hostname}:{otherPort.name}
            </span>
          ) : (
            <span className="text-[var(--color-fg-faint)]">no link</span>
          )}
          {link && (
            <span className="text-[var(--color-fg-subtle)]">
              {link.cableType} · {link.cableLength}
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
