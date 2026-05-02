import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Plus, Server } from 'lucide-react'
import { DeviceDrawer } from '@/components/shared/DeviceDrawer'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader, CardHeading, CardLabel, CardTitle } from '@/components/ui/Card'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import { StatusDot } from '@/components/shared/StatusDot'
import { canEditInventory, useStore } from '@/lib/store'
import type { Device } from '@/lib/types'
import { statusLabel } from '@/lib/utils'

const HOST_DEVICE_TYPES = new Set<Device['deviceType']>(['server', 'storage', 'kvm', 'other'])

export default function ComputeView() {
  const currentUser = useStore((s) => s.currentUser)
  const devices = useStore((s) => s.devices)
  const canEdit = canEditInventory(currentUser)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDefaults, setDrawerDefaults] = useState<{
    deviceType?: Device['deviceType']
    placement?: NonNullable<Device['placement']>
    parentDeviceId?: string
    status?: Device['status']
  }>()

  const vms = useMemo(
    () =>
      devices
        .filter((device) => device.deviceType === 'vm' || device.placement === 'virtual')
        .sort((a, b) => a.hostname.localeCompare(b.hostname)),
    [devices],
  )

  const vmHostIds = useMemo(
    () => new Set(vms.map((device) => device.parentDeviceId).filter((value): value is string => Boolean(value))),
    [vms],
  )

  const hosts = useMemo(
    () =>
      devices
        .filter(
          (device) =>
            device.deviceType !== 'vm' &&
            (vmHostIds.has(device.id) || HOST_DEVICE_TYPES.has(device.deviceType)),
        )
        .sort((a, b) => a.hostname.localeCompare(b.hostname)),
    [devices, vmHostIds],
  )

  const guestsByHostId = useMemo(() => {
    return vms.reduce<Record<string, Device[]>>((acc, device) => {
      if (device.parentDeviceId) {
        ;(acc[device.parentDeviceId] ??= []).push(device)
      }
      return acc
    }, {})
  }, [vms])

  const unassignedVms = useMemo(
    () => vms.filter((device) => !device.parentDeviceId || !hosts.some((host) => host.id === device.parentDeviceId)),
    [hosts, vms],
  )

  const activeHosts = hosts.filter((host) => (guestsByHostId[host.id] ?? []).length > 0)
  const emptyHosts = hosts.filter((host) => (guestsByHostId[host.id] ?? []).length === 0)

  return (
    <>
      <TopBar
        subtitle="Virtualization inventory"
        title="Compute"
        meta={
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {hosts.length} hosts | {vms.length} VMs
          </span>
        }
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrawerDefaults({ deviceType: 'server', placement: 'room', status: 'unknown' })
                  setDrawerOpen(true)
                }}
              >
                <Plus className="size-3.5" />
                Add host
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrawerDefaults({ deviceType: 'vm', placement: 'virtual', status: 'unknown' })
                  setDrawerOpen(true)
                }}
              >
                <Plus className="size-3.5" />
                Add VM
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <ComputeStat label="Hosts" value={String(hosts.length)} hint="Potential virtualization hosts" />
          <ComputeStat label="Active hosts" value={String(activeHosts.length)} hint="Hosts with at least one guest" />
          <ComputeStat label="VMs" value={String(vms.length)} hint="Virtual devices documented in this lab" />
          <ComputeStat label="Unassigned VMs" value={String(unassignedVms.length)} hint="Guests not linked to a host yet" />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <CardLabel>Hosts</CardLabel>
                <CardHeading>Virtualization and compute nodes</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {hosts.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] px-3 py-6 text-center text-sm text-[var(--color-fg-subtle)]">
                  No compute hosts documented yet.
                </div>
              ) : (
                <>
                  {activeHosts.length > 0 && (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {activeHosts.map((host) => {
                        const guests = (guestsByHostId[host.id] ?? []).sort((a, b) => a.hostname.localeCompare(b.hostname))
                        const capacity = summarizeHostCapacity(host, guests)
                        return (
                          <Card key={host.id}>
                            <CardHeader>
                              <CardTitle>
                                <CardLabel>Host</CardLabel>
                                <CardHeading>{host.hostname}</CardHeading>
                              </CardTitle>
                              <Badge tone="accent">
                                <Cpu className="size-3" />
                                {guests.length} VMs
                              </Badge>
                            </CardHeader>
                            <CardBody className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-[var(--color-fg-subtle)]">
                                <StatusDot status={host.status} />
                                <span>{statusLabel[host.status]}</span>
                                {host.managementIp && <span className="font-mono text-[11px]">{host.managementIp}</span>}
                              </div>

                              {(capacity.cpu.total || capacity.memory.total || capacity.storage.total) ? (
                                <div className="grid gap-2 md:grid-cols-3">
                                  <CapacityMeter label="CPU" unit="cores" {...capacity.cpu} />
                                  <CapacityMeter label="Memory" unit="GB" {...capacity.memory} />
                                  <CapacityMeter label="Storage" unit="GB" {...capacity.storage} />
                                </div>
                              ) : null}

                              <div className="grid gap-2">
                                {guests.map((guest) => (
                                  <Link
                                    key={guest.id}
                                    to={`/devices/${guest.id}`}
                                    className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 transition-colors hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface)]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <DeviceTypeIcon type={guest.deviceType} className="size-4 text-[var(--color-accent)]" />
                                      <span className="text-sm text-[var(--color-fg)]">{guest.hostname}</span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                                      {guest.displayName || guest.managementIp || statusLabel[guest.status]}
                                    </div>
                                  </Link>
                                ))}
                              </div>

                              {canEdit && (
                                <div className="flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setDrawerDefaults({
                                        deviceType: 'vm',
                                        placement: 'virtual',
                                        parentDeviceId: host.id,
                                        status: 'unknown',
                                      })
                                      setDrawerOpen(true)
                                    }}
                                  >
                                    <Plus className="size-3.5" />
                                    Add VM on host
                                  </Button>
                                </div>
                              )}
                            </CardBody>
                          </Card>
                        )
                      })}
                    </div>
                  )}

                  {emptyHosts.length > 0 && (
                    <div>
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                        Hosts without guests yet
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {emptyHosts.map((host) => (
                          <div
                            key={host.id}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <DeviceTypeIcon type={host.deviceType} className="size-4 text-[var(--color-accent)]" />
                              <Link to={`/devices/${host.id}`} className="text-sm text-[var(--color-fg)] hover:underline">
                                {host.hostname}
                              </Link>
                            </div>
                            <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                              {host.displayName || host.managementIp || statusLabel[host.status]}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <CardLabel>Unassigned</CardLabel>
                <CardHeading>VMs without a host link</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {unassignedVms.length === 0 ? (
                <div className="text-sm text-[var(--color-fg-subtle)]">
                  Every VM is currently linked to a documented host.
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {unassignedVms.map((device) => (
                    <Link
                      key={device.id}
                      to={`/devices/${device.id}`}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 transition-colors hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface)]"
                    >
                      <div className="flex items-center gap-2">
                        <DeviceTypeIcon type={device.deviceType} className="size-4 text-[var(--color-accent)]" />
                        <span className="text-sm text-[var(--color-fg)]">{device.hostname}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                        {device.displayName || device.managementIp || 'No host selected yet'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {canEdit && (
        <DeviceDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          defaults={drawerDefaults}
        />
      )}
    </>
  )
}

function ComputeStat({ label, value, hint }: { label: string; value: string; hint: string }) {
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

function summarizeHostCapacity(host: Device, guests: Device[]) {
  return {
    cpu: summarizeCapacity(host.cpuCores, guests.map((guest) => guest.cpuCores)),
    memory: summarizeCapacity(host.memoryGb, guests.map((guest) => guest.memoryGb)),
    storage: summarizeCapacity(host.storageGb, guests.map((guest) => guest.storageGb)),
  }
}

function summarizeCapacity(total: number | undefined, values: Array<number | undefined>) {
  const allocated = values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const safeTotal = total ?? 0
  const ratio = safeTotal > 0 ? Math.min(100, Math.round((allocated / safeTotal) * 100)) : 0
  const overcommit = safeTotal > 0 && allocated > safeTotal
  return {
    total: safeTotal,
    allocated,
    ratio,
    overcommit,
  }
}

function CapacityMeter({
  label,
  unit,
  total,
  allocated,
  ratio,
  overcommit,
}: {
  label: string
  unit: string
  total: number
  allocated: number
  ratio: number
  overcommit: boolean
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          {label}
        </div>
        <div className={`text-[11px] ${overcommit ? 'text-[var(--color-err)]' : 'text-[var(--color-fg-subtle)]'}`}>
          {formatCapacity(allocated)} / {total > 0 ? formatCapacity(total) : '—'} {unit}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-bg-3)]">
        <div
          className={`h-full rounded-full ${overcommit ? 'bg-[var(--color-err)]' : 'bg-[var(--color-accent)]'}`}
          style={{ width: `${Math.min(100, ratio)}%` }}
        />
      </div>
    </div>
  )
}

function formatCapacity(value: number) {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1).replace(/\.0$/, '')
}
