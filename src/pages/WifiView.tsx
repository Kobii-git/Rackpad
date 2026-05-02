import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DeviceDrawer } from '@/components/shared/DeviceDrawer'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardHeading, CardLabel, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import { StatusDot } from '@/components/shared/StatusDot'
import { canEditInventory, useStore } from '@/lib/store'
import type { Device } from '@/lib/types'
import { Plus, Wifi } from 'lucide-react'
import { statusLabel } from '@/lib/utils'

export default function WifiView() {
  const currentUser = useStore((s) => s.currentUser)
  const devices = useStore((s) => s.devices)
  const canEdit = canEditInventory(currentUser)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDefaults, setDrawerDefaults] = useState<{
    deviceType?: Device['deviceType']
    placement?: NonNullable<Device['placement']>
    status?: Device['status']
  }>()

  const aps = useMemo(
    () => devices.filter((device) => device.deviceType === 'ap').sort((a, b) => a.hostname.localeCompare(b.hostname)),
    [devices],
  )
  const wirelessClients = useMemo(
    () =>
      devices
        .filter((device) => device.placement === 'wireless' && device.deviceType !== 'ap')
        .sort((a, b) => a.hostname.localeCompare(b.hostname)),
    [devices],
  )
  const clientsByApId = useMemo(() => {
    return wirelessClients.reduce<Record<string, Device[]>>((acc, device) => {
      if (device.parentDeviceId) {
        ;(acc[device.parentDeviceId] ??= []).push(device)
      }
      return acc
    }, {})
  }, [wirelessClients])
  const unassignedClients = wirelessClients.filter((device) => !device.parentDeviceId || !aps.some((ap) => ap.id === device.parentDeviceId))

  return (
    <>
      <TopBar
        subtitle="Wireless inventory"
        title="WiFi"
        meta={
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {aps.length} APs | {wirelessClients.length} wireless clients
          </span>
        }
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrawerDefaults({ deviceType: 'ap', placement: 'wireless', status: 'unknown' })
                  setDrawerOpen(true)
                }}
              >
                <Plus className="size-3.5" />
                Add AP
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrawerDefaults({ deviceType: 'endpoint', placement: 'wireless', status: 'unknown' })
                  setDrawerOpen(true)
                }}
              >
                <Plus className="size-3.5" />
                Add client
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <WifiStat label="Access points" value={String(aps.length)} hint="APs documented in this lab" />
          <WifiStat label="Clients" value={String(wirelessClients.length)} hint="Wireless-linked devices" />
          <WifiStat label="Unassigned" value={String(unassignedClients.length)} hint="Clients not attached to an AP yet" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {aps.map((ap) => {
            const clients = clientsByApId[ap.id] ?? []
            return (
              <Card key={ap.id}>
                <CardHeader>
                  <CardTitle>
                    <CardLabel>Access point</CardLabel>
                    <CardHeading>{ap.hostname}</CardHeading>
                  </CardTitle>
                  <Badge tone="accent">
                    <Wifi className="size-3" />
                    {clients.length} clients
                  </Badge>
                </CardHeader>
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--color-fg-subtle)]">
                    <StatusDot status={ap.status} />
                    <span>{statusLabel[ap.status]}</span>
                    {ap.managementIp && <span className="font-mono text-[11px]">{ap.managementIp}</span>}
                  </div>

                  {clients.length === 0 ? (
                    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] px-3 py-4 text-sm text-[var(--color-fg-subtle)]">
                      No wireless clients linked to this AP yet.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {clients.map((client) => (
                        <Link
                          key={client.id}
                          to={`/devices/${client.id}`}
                          className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 transition-colors hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface)]"
                        >
                          <div className="flex items-center gap-2">
                            <DeviceTypeIcon type={client.deviceType} className="size-4 text-[var(--color-accent)]" />
                            <span className="text-sm text-[var(--color-fg)]">{client.hostname}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                            {client.displayName || client.managementIp || statusLabel[client.status]}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              <CardLabel>Loose wireless devices</CardLabel>
              <CardHeading>Needs AP assignment</CardHeading>
            </CardTitle>
          </CardHeader>
          <CardBody>
            {unassignedClients.length === 0 ? (
              <div className="text-sm text-[var(--color-fg-subtle)]">
                Every wireless client is currently attached to an AP.
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {unassignedClients.map((device) => (
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
                      {device.displayName || device.managementIp || 'No AP linked yet'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
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

function WifiStat({ label, value, hint }: { label: string; value: string; hint: string }) {
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
