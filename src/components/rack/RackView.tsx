import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { Device, Rack, RackFace } from '@/lib/types'
import { cn, statusColor, statusGlow } from '@/lib/utils'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import { StatusDot } from '@/components/shared/StatusDot'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'

interface RackViewProps {
  rack: Rack
  devices: Device[]
  face: RackFace
  onSelectDevice?: (deviceId: string) => void
  selectedDeviceId?: string
}

interface Slot {
  u: number
  device?: Device
  isStart?: boolean
  spanU?: number
}

function buildLayout(rack: Rack, devices: Device[], face: RackFace): Slot[] {
  const occupants = devices.filter((d) => (d.face ?? 'front') === face && d.startU != null)
  const occupantByU = new Map<number, { device: Device; isStart: boolean }>()
  for (const d of occupants) {
    if (!d.startU || !d.heightU) continue
    for (let i = 0; i < d.heightU; i++) {
      occupantByU.set(d.startU + i, { device: d, isStart: i === d.heightU - 1 }) // top row of device is the "label" row
    }
  }

  const slots: Slot[] = []
  for (let u = rack.totalU; u >= 1; u--) {
    const occ = occupantByU.get(u)
    if (occ) {
      slots.push({ u, device: occ.device, isStart: occ.isStart, spanU: occ.device.heightU })
    } else {
      slots.push({ u })
    }
  }
  return slots
}

export function RackView({ rack, devices, face, onSelectDevice, selectedDeviceId }: RackViewProps) {
  const slots = useMemo(() => buildLayout(rack, devices, face), [rack, devices, face])

  const occupantSlots = slots.filter((s) => s.device && s.isStart)
  const emptyCount = slots.filter((s) => !s.device).length

  return (
    <div className="flex gap-4">
      {/* The rack frame */}
      <div className="flex flex-col items-stretch">
        {/* Top label */}
        <div className="flex items-center justify-between border-b-2 border-[var(--color-line-strong)] bg-[var(--color-bg-2)] px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {rack.name} · {face}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)]">
            {rack.totalU}U
          </span>
        </div>

        {/* The rack body */}
        <div className="flex bg-[var(--color-bg-3)] border-x-2 border-[var(--color-line-strong)]">
          {/* Left rack rail with U numbers */}
          <div
            className="flex flex-col bg-[var(--color-bg-2)] border-r border-[var(--color-line)]"
            style={{ width: 36 }}
          >
            {slots.map((slot) => (
              <div
                key={slot.u}
                className="flex items-center justify-center font-mono text-[10px] text-[var(--color-fg-faint)] select-none"
                style={{ height: 'var(--u-height)' }}
              >
                {slot.u}
              </div>
            ))}
          </div>

          {/* The slot column */}
          <div className="relative flex-1" style={{ width: 360 }}>
            {/* Render slot grid */}
            <div className="flex flex-col">
              {slots.map((slot) => {
                if (slot.device && slot.isStart) {
                  return (
                    <DeviceTile
                      key={slot.device.id}
                      device={slot.device}
                      heightU={slot.spanU ?? 1}
                      selected={selectedDeviceId === slot.device.id}
                      onClick={() => onSelectDevice?.(slot.device!.id)}
                    />
                  )
                }
                if (slot.device && !slot.isStart) {
                  // device occupies this row but it's not the label row — skip render, the tile spans
                  return null
                }
                return <EmptySlot key={slot.u} />
              })}
            </div>
          </div>

          {/* Right rack rail with U numbers */}
          <div
            className="flex flex-col bg-[var(--color-bg-2)] border-l border-[var(--color-line)]"
            style={{ width: 36 }}
          >
            {slots.map((slot) => (
              <div
                key={slot.u}
                className="flex items-center justify-center font-mono text-[10px] text-[var(--color-fg-faint)] select-none"
                style={{ height: 'var(--u-height)' }}
              >
                {slot.u}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom label */}
        <div className="flex items-center justify-between border-t-2 border-[var(--color-line-strong)] bg-[var(--color-bg-2)] px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {occupantSlots.length} devices · {emptyCount}U free
          </span>
        </div>
      </div>
    </div>
  )
}

function DeviceTile({
  device,
  heightU,
  selected,
  onClick,
}: {
  device: Device
  heightU: number
  selected: boolean
  onClick: () => void
}) {
  const tone = statusColor[device.status]
  const glow = statusGlow[device.status]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClick}
          className={cn(
            'group relative flex w-full items-center gap-2 px-3 text-left',
            'border-y border-[var(--color-line-strong)] bg-[var(--color-surface)]',
            'transition-colors',
            selected ? 'bg-[var(--color-surface-2)]' : 'hover:bg-[var(--color-surface-2)]',
            'cursor-pointer',
          )}
          style={{ height: `calc(var(--u-height) * ${heightU})` }}
        >
          {/* Left status accent rail */}
          <span
            className="absolute left-0 top-0 h-full w-[3px]"
            style={{ backgroundColor: tone, boxShadow: `0 0 8px ${glow}` }}
            aria-hidden
          />

          {/* Icon */}
          <DeviceTypeIcon
            type={device.deviceType}
            className="size-4 shrink-0 text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-colors"
          />

          {/* Hostname + model */}
          <div className="flex flex-1 flex-col leading-tight min-w-0">
            <span className="truncate text-[13px] font-medium text-[var(--color-fg)]">
              {device.hostname}
            </span>
            {heightU > 1 && (
              <span className="truncate font-mono text-[10px] text-[var(--color-fg-subtle)]">
                {device.manufacturer} {device.model}
              </span>
            )}
          </div>

          {/* U position */}
          <span className="shrink-0 font-mono text-[10px] uppercase text-[var(--color-fg-faint)]">
            U{device.startU}
            {heightU > 1 ? `-${(device.startU ?? 0) + heightU - 1}` : ''}
          </span>

          {/* Status dot */}
          <StatusDot status={device.status} />
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="flex flex-col gap-0.5 text-[11px]">
          <span className="font-medium">{device.displayName ?? device.hostname}</span>
          <span className="text-[var(--color-fg-subtle)]">{device.manufacturer} {device.model}</span>
          {device.managementIp && (
            <span className="text-[var(--color-fg-subtle)]">mgmt: {device.managementIp}</span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function EmptySlot() {
  return (
    <div
      className="border-y border-[var(--color-line)]/40 bg-[var(--color-bg-3)]"
      style={{ height: 'var(--u-height)' }}
    >
      {/* subtle screwhole markers at the rails */}
      <div className="flex h-full items-center justify-between px-2 opacity-40">
        <span className="size-1 rounded-full bg-[var(--color-line-strong)]" />
        <span className="size-1 rounded-full bg-[var(--color-line-strong)]" />
      </div>
    </div>
  )
}
