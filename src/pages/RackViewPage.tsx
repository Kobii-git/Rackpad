import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { DeviceDrawer } from '@/components/shared/DeviceDrawer'
import { TopBar } from '@/components/layout/TopBar'
import { RackView } from '@/components/rack/RackView'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Mono } from '@/components/shared/Mono'
import { StatusDot } from '@/components/shared/StatusDot'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import { Card, CardHeader, CardTitle, CardLabel, CardHeading, CardBody } from '@/components/ui/Card'
import { useStore } from '@/lib/store'
import { ExternalLink, Plus } from 'lucide-react'
import type { Port, RackFace } from '@/lib/types'
import { statusLabel } from '@/lib/utils'

export default function RackViewPage() {
  const racks = useStore((s) => s.racks)
  const devices = useStore((s) => s.devices)
  const ports = useStore((s) => s.ports)
  const [rackId, setRackId] = useState('')
  const [face, setFace] = useState<RackFace>('front')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!racks.length) return
    if (!rackId || !racks.some((rack) => rack.id === rackId)) {
      setRackId(racks[0].id)
    }
  }, [rackId, racks])

  const portsByDeviceId = useMemo(() => {
    return ports.reduce<Record<string, Port[]>>((acc, port) => {
      ;(acc[port.deviceId] ??= []).push(port)
      return acc
    }, {})
  }, [ports])

  const rack = racks.find((entry) => entry.id === rackId) ?? racks[0]

  if (!rack) {
    return null
  }

  const rackDevices = devices.filter((device) => device.rackId === rack.id)
  const selectedDevice = selectedDeviceId
    ? devices.find((device) => device.id === selectedDeviceId)
    : undefined

  return (
    <>
      <TopBar
        subtitle="Physical layout"
        title="Racks"
        actions={
          <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="size-3.5" />
            Add device
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-2)]/40">
          <div className="border-b border-[var(--color-line)] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              {racks.length} racks
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {racks.map((entry) => {
              const inRack = devices.filter((device) => device.rackId === entry.id)
              const used = inRack.reduce((sum, device) => sum + (device.heightU ?? 0), 0)
              const isActive = entry.id === rack.id
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    setRackId(entry.id)
                    setSelectedDeviceId(undefined)
                  }}
                  className={`w-full border-l-2 px-4 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'border-[var(--color-accent)] bg-[var(--color-surface)]'
                      : 'border-transparent hover:bg-[var(--color-surface)]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-[var(--color-fg)]">{entry.name}</span>
                    <Mono className="text-[10px] text-[var(--color-fg-subtle)]">
                      {used}/{entry.totalU}U
                    </Mono>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--color-fg-subtle)]">
                    {entry.description}
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-[1px] bg-[var(--color-bg)]">
                    <div
                      className="h-full bg-[var(--color-accent)]"
                      style={{ width: `${Math.round((used / entry.totalU) * 100)}%`, opacity: 0.7 }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                Rack
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--color-fg)]">
                {rack.name}
              </h2>
              <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">{rack.location}</div>
            </div>

            <Tabs value={face} onValueChange={(value) => setFace(value as RackFace)}>
              <TabsList>
                <TabsTrigger value="front">Front</TabsTrigger>
                <TabsTrigger value="rear">Rear</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-start gap-6">
            <RackView
              rack={rack}
              devices={rackDevices}
              face={face}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={(id) => setSelectedDeviceId(id === selectedDeviceId ? undefined : id)}
            />

            <AnimatePresence>
              {selectedDevice && (
                <motion.div
                  key={selectedDevice.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="w-80 shrink-0"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <CardLabel>Device</CardLabel>
                        <CardHeading>{selectedDevice.hostname}</CardHeading>
                      </CardTitle>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/devices/${selectedDevice.id}`}>
                          <ExternalLink />
                        </Link>
                      </Button>
                    </CardHeader>
                    <CardBody>
                      <div className="mb-3 flex items-center gap-2">
                        <DeviceTypeIcon type={selectedDevice.deviceType} className="size-4 text-[var(--color-accent)]" />
                        <span className="text-sm capitalize text-[var(--color-fg)]">
                          {selectedDevice.deviceType.replace('_', ' ')}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1.5">
                          <StatusDot status={selectedDevice.status} />
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
                            {statusLabel[selectedDevice.status]}
                          </span>
                        </span>
                      </div>

                      <dl className="space-y-2 text-xs">
                        <Row label="Manufacturer" value={selectedDevice.manufacturer} />
                        <Row label="Model" value={selectedDevice.model} mono />
                        <Row label="Serial" value={selectedDevice.serial} mono />
                        <Row label="Mgmt IP" value={selectedDevice.managementIp} mono />
                        <Row
                          label="Position"
                          value={`${selectedDevice.face} · U${selectedDevice.startU}${
                            (selectedDevice.heightU ?? 1) > 1
                              ? `-${selectedDevice.startU! + selectedDevice.heightU! - 1}`
                              : ''
                          }`}
                        />
                        <Row label="Ports" value={String(portsByDeviceId[selectedDevice.id]?.length ?? 0)} />
                      </dl>

                      {selectedDevice.tags && selectedDevice.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {selectedDevice.tags.map((tag) => (
                            <Badge key={tag}>{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <DeviceDrawer open={drawerOpen} defaultRackId={rack.id} onClose={() => setDrawerOpen(false)} />
    </>
  )
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className={`text-right text-[var(--color-fg)] ${mono ? 'font-mono text-[11px]' : 'text-xs'}`}>
        {value}
      </dd>
    </div>
  )
}
