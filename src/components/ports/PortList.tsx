import type { ReactNode } from 'react'
import type { Port, PortLink, Device } from '@/lib/types'
import { cn, portTypeColor, portTypeLabel } from '@/lib/utils'
import { StatusDot } from '@/components/shared/StatusDot'
import { Mono } from '@/components/shared/Mono'
import { ArrowRight } from 'lucide-react'

interface PortListProps {
  ports: Port[]
  links: Record<string, PortLink>
  portsById: Record<string, Port>
  devicesById: Record<string, Device>
  onSelectPort?: (portId: string) => void
  selectedPortId?: string
}

export function PortList({ ports, links, portsById, devicesById, onSelectPort, selectedPortId }: PortListProps) {
  return (
    <div className="overflow-hidden border border-[var(--color-line)] rounded-[var(--radius-md)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-bg-2)]">
          <tr className="border-b border-[var(--color-line)]">
            <Th className="w-1">·</Th>
            <Th>Port</Th>
            <Th>Type</Th>
            <Th>Speed</Th>
            <Th>Linked to</Th>
            <Th>Cable</Th>
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => {
            const link = links[p.id]
            let otherDevice: Device | undefined
            let otherPort: Port | undefined
            if (link) {
              const otherId = link.fromPortId === p.id ? link.toPortId : link.fromPortId
              otherPort = portsById[otherId]
              if (otherPort) otherDevice = devicesById[otherPort.deviceId]
            }

            return (
              <tr
                key={p.id}
                onClick={() => onSelectPort?.(p.id)}
                className={cn(
                  'border-b border-[var(--color-line)] last:border-b-0 transition-colors',
                  onSelectPort ? 'cursor-pointer hover:bg-[var(--color-surface)]' : 'hover:bg-[var(--color-surface)]',
                  selectedPortId === p.id ? 'bg-[var(--color-accent)]/8' : '',
                )}
              >
                <Td>
                  <StatusDot link={p.linkState} />
                </Td>
                <Td>
                  <Mono>{p.name}</Mono>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-[1px]"
                      style={{ backgroundColor: portTypeColor[p.kind] }}
                    />
                    <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {portTypeLabel[p.kind]}
                    </span>
                  </span>
                </Td>
                <Td>
                  <Mono className="text-[var(--color-fg-muted)]">{p.speed}</Mono>
                </Td>
                <Td>
                  {otherDevice && otherPort ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <ArrowRight className="size-3 text-[var(--color-cyan)]" />
                      <span>{otherDevice.hostname}</span>
                      <span className="text-[var(--color-fg-faint)]">:</span>
                      <Mono className="text-[var(--color-cyan)]">{otherPort.name}</Mono>
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-fg-faint)]">—</span>
                  )}
                </Td>
                <Td>
                  {link ? (
                    <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                      {link.cableType} · {link.cableLength}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-fg-faint)]">—</span>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <th
      className={cn(
        'text-left px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-normal',
        className,
      )}
    >
      {children}
    </th>
  )
}

function Td({ className, children }: { className?: string; children: ReactNode }) {
  return <td className={cn('px-3 py-2 align-middle', className)}>{children}</td>
}
