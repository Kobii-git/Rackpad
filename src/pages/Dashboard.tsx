import { motion } from 'motion/react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader, CardHeading, CardLabel, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/shared/StatCard'
import { StatusDot } from '@/components/shared/StatusDot'
import { Mono } from '@/components/shared/Mono'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import { AllocatePanel } from '@/components/shared/AllocatePanel'
import { canEditInventory, useStore } from '@/lib/store'
import { formatBandwidthMbps, parsePortSpeedMbps, relativeTime, statusLabel } from '@/lib/utils'
import { Activity, ChevronRight } from 'lucide-react'

export default function Dashboard() {
  const currentUser = useStore((s) => s.currentUser)
  const lab = useStore((s) => s.lab)
  const racks = useStore((s) => s.racks)
  const devices = useStore((s) => s.devices)
  const ports = useStore((s) => s.ports)
  const subnets = useStore((s) => s.subnets)
  const portLinks = useStore((s) => s.portLinks)
  const ipAssignments = useStore((s) => s.ipAssignments)
  const auditLog = useStore((s) => s.auditLog)
  const vlans = useStore((s) => s.vlans)
  const canEdit = canEditInventory(currentUser)

  const onlineCount = devices.filter((device) => device.status === 'online').length
  const warningCount = devices.filter((device) => device.status === 'warning').length
  const linkedPortCount = ports.filter((port) => port.linkState === 'up').length
  const totalPorts = ports.length
  const portsWithSpeed = ports.filter((port) => parsePortSpeedMbps(port.speed) != null)
  const configuredCapacityMbps = ports.reduce((sum, port) => sum + (parsePortSpeedMbps(port.speed) ?? 0), 0)
  const linkedCapacityMbps = ports.reduce(
    (sum, port) => sum + (port.linkState === 'up' ? parsePortSpeedMbps(port.speed) ?? 0 : 0),
    0,
  )
  const capacityBuckets = Array.from(
    ports.reduce(
      (acc, port) => {
        const speedMbps = parsePortSpeedMbps(port.speed)
        if (speedMbps == null) return acc
        const key = formatBandwidthMbps(speedMbps)
        const current = acc.get(key) ?? { label: key, total: 0, linked: 0, capacityMbps: 0 }
        current.total += 1
        current.capacityMbps += speedMbps
        if (port.linkState === 'up') current.linked += 1
        acc.set(key, current)
        return acc
      },
      new Map<string, { label: string; total: number; linked: number; capacityMbps: number }>(),
    ).values(),
  ).sort((a, b) => b.capacityMbps - a.capacityMbps || b.total - a.total)
  const documentedSpeedPct = totalPorts === 0 ? 0 : Math.round((portsWithSpeed.length / totalPorts) * 100)

  return (
    <>
      <TopBar
        subtitle="Overview"
        title="Dashboard"
        meta={
          <>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Lab
            </span>
            <span className="text-[13px] text-[var(--color-fg)]">{lab.name}</span>
            <span className="font-mono text-[10px] text-[var(--color-fg-faint)]">
              {racks.length} racks | {devices.length} devices
            </span>
          </>
        }
        actions={canEdit ? <AllocatePanel /> : undefined}
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Devices"
            value={devices.length}
            hint={`${onlineCount} online | ${warningCount} warning`}
            accent
            delay={0}
          />
          <StatCard
            label="Ports linked"
            value={linkedPortCount}
            unit={`/ ${totalPorts}`}
            hint={`${Math.round((linkedPortCount / Math.max(1, totalPorts)) * 100)}% utilization`}
            delay={0.04}
          />
          <StatCard
            label="IPs allocated"
            value={ipAssignments.length}
            unit={`/ ${subnets.length * 254}`}
            hint={`${subnets.length} subnets`}
            delay={0.08}
          />
          <StatCard
            label="Cables"
            value={portLinks.length}
            hint={`${vlans.length} VLANs configured`}
            delay={0.12}
          />
        </div>

        <div className="grid grid-cols-12 gap-3">
          <Card className="col-span-12 lg:col-span-4">
            <CardHeader>
              <CardTitle>
                <CardLabel>Health</CardLabel>
                <CardHeading>Device status</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2.5">
                {(['online', 'warning', 'maintenance', 'offline', 'unknown'] as const).map((status) => {
                  const count = devices.filter((device) => device.status === status).length
                  const pct = Math.round((count / Math.max(1, devices.length)) * 100)
                  if (count === 0) return null
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusDot status={status} />
                          <span className="text-xs text-[var(--color-fg)]">{statusLabel[status]}</span>
                        </div>
                        <Mono className="text-[var(--color-fg-muted)]">{count}</Mono>
                      </div>
                      <div className="h-1 overflow-hidden rounded-[1px] bg-[var(--color-bg)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full"
                          style={{
                            backgroundColor:
                              status === 'online'
                                ? 'var(--color-ok)'
                                : status === 'warning'
                                  ? 'var(--color-warn)'
                                  : status === 'maintenance'
                                    ? 'var(--color-info)'
                                    : 'var(--color-fg-faint)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>

          <Card className="col-span-12 lg:col-span-8">
            <CardHeader>
              <CardTitle>
                <CardLabel>Network | inventory derived</CardLabel>
                <CardHeading>Aggregate capacity</CardHeading>
              </CardTitle>
              <div className="max-w-xl text-right text-[11px] text-[var(--color-fg-subtle)]">
                Estimated from saved port speeds and link states. This is not live traffic telemetry yet.
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 md:grid-cols-3">
                <CapacityStat
                  label="Configured"
                  value={formatBandwidthMbps(configuredCapacityMbps)}
                  hint={`${portsWithSpeed.length}/${totalPorts} ports have documented speeds`}
                />
                <CapacityStat
                  label="Linked"
                  value={formatBandwidthMbps(linkedCapacityMbps)}
                  hint={`${linkedPortCount} live links documented`}
                />
                <CapacityStat
                  label="Coverage"
                  value={`${documentedSpeedPct}%`}
                  hint="of ports can contribute to capacity estimates"
                />
              </div>

              <div className="mt-4 space-y-3">
                {capacityBuckets.length === 0 ? (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-4 text-sm text-[var(--color-fg-subtle)]">
                    Add port speeds such as <span className="font-mono text-[var(--color-fg)]">1G</span>,
                    <span className="mx-1 font-mono text-[var(--color-fg)]">2.5G</span>, or
                    <span className="ml-1 font-mono text-[var(--color-fg)]">10G</span> to turn this into a useful capacity view.
                  </div>
                ) : (
                  capacityBuckets.map((bucket) => {
                    const ratio = Math.round((bucket.linked / Math.max(1, bucket.total)) * 100)
                    return (
                      <div key={bucket.label} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                              {bucket.label} ports
                            </div>
                            <div className="text-sm text-[var(--color-fg)]">
                              {bucket.linked}/{bucket.total} linked
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-[11px] text-[var(--color-fg)]">
                              {formatBandwidthMbps(bucket.capacityMbps)}
                            </div>
                            <div className="text-[11px] text-[var(--color-fg-subtle)]">documented capacity</div>
                          </div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-[1px] bg-[var(--color-surface)]">
                          <div
                            className="h-full rounded-[1px] bg-[var(--color-cyan)]"
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardBody>
          </Card>

          <Card className="col-span-12 lg:col-span-7">
            <CardHeader>
              <CardTitle>
                <CardLabel>Audit log</CardLabel>
                <CardHeading>Recent activity</CardHeading>
              </CardTitle>
              <Activity className="size-4 text-[var(--color-fg-subtle)]" />
            </CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-[var(--color-line)]">
                {auditLog.map((entry, index) => (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.04, duration: 0.25 }}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-surface)]/40"
                  >
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-[var(--color-fg)]">{entry.summary}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Mono className="text-[10px] text-[var(--color-fg-subtle)]">{entry.user}</Mono>
                        <span className="text-[10px] text-[var(--color-fg-faint)]">|</span>
                        <Mono className="text-[10px] text-[var(--color-fg-subtle)]">{entry.action}</Mono>
                      </div>
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-[var(--color-fg-faint)]">
                      {relativeTime(entry.ts)}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="col-span-12 lg:col-span-5">
            <CardHeader>
              <CardTitle>
                <CardLabel>By type</CardLabel>
                <CardHeading>Inventory</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(
                  devices.reduce<Record<string, number>>((acc, device) => {
                    acc[device.deviceType] = (acc[device.deviceType] ?? 0) + 1
                    return acc
                  }, {}),
                ).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2.5 py-2"
                  >
                    <DeviceTypeIcon type={type as never} className="size-4 text-[var(--color-accent)]" />
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-xs capitalize text-[var(--color-fg)]">{type.replace('_', ' ')}</span>
                      <Mono className="text-[10px] text-[var(--color-fg-subtle)]">{count}</Mono>
                    </div>
                    <ChevronRight className="size-3 text-[var(--color-fg-faint)]" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function CapacityStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-fg)]">{value}</div>
      <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">{hint}</div>
    </div>
  )
}
