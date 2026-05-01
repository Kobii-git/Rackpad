import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PortGrid } from '@/components/ports/PortGrid'
import { PortList } from '@/components/ports/PortList'
import { Card, CardHeader, CardTitle, CardLabel, CardHeading, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Mono } from '@/components/shared/Mono'
import { StatusDot } from '@/components/shared/StatusDot'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import { updatePort, useStore } from '@/lib/store'
import type { Device, Port, PortLink } from '@/lib/types'
import { ArrowRight, Save } from 'lucide-react'

const PORT_BEARING: Device['deviceType'][] = [
  'switch',
  'router',
  'firewall',
  'patch_panel',
  'server',
  'storage',
]

const LINK_STATES: Port['linkState'][] = ['up', 'down', 'disabled', 'unknown']

interface PortFormState {
  name: string
  speed: string
  linkState: Port['linkState']
  vlanId: string
  description: string
  face: NonNullable<Port['face']>
}

function portToForm(port: Port): PortFormState {
  return {
    name: port.name,
    speed: port.speed ?? '',
    linkState: port.linkState,
    vlanId: port.vlanId ?? '',
    description: port.description ?? '',
    face: port.face ?? 'front',
  }
}

export default function PortView() {
  const devices = useStore((s) => s.devices)
  const ports = useStore((s) => s.ports)
  const portLinks = useStore((s) => s.portLinks)
  const vlans = useStore((s) => s.vlans)
  const portBearingDevices = devices.filter((device) => PORT_BEARING.includes(device.deviceType))
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [selectedPortId, setSelectedPortId] = useState<string | undefined>()
  const [form, setForm] = useState<PortFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!portBearingDevices.length) return
    if (!selectedDeviceId || !portBearingDevices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(portBearingDevices[0].id)
      setSelectedPortId(undefined)
    }
  }, [portBearingDevices, selectedDeviceId])

  const deviceById = useMemo(() => {
    return devices.reduce<Record<string, Device>>((acc, device) => {
      acc[device.id] = device
      return acc
    }, {})
  }, [devices])

  const portsByDeviceId = useMemo(() => {
    return ports.reduce<Record<string, Port[]>>((acc, port) => {
      ;(acc[port.deviceId] ??= []).push(port)
      return acc
    }, {})
  }, [ports])

  const portById = useMemo(() => {
    return ports.reduce<Record<string, Port>>((acc, port) => {
      acc[port.id] = port
      return acc
    }, {})
  }, [ports])

  const linkByPortId = useMemo(() => {
    return portLinks.reduce<Record<string, PortLink>>((acc, link) => {
      acc[link.fromPortId] = link
      acc[link.toPortId] = link
      return acc
    }, {})
  }, [portLinks])

  const device = deviceById[selectedDeviceId]
  const devicePorts = portsByDeviceId[selectedDeviceId] ?? []

  useEffect(() => {
    if (!devicePorts.length) {
      setSelectedPortId(undefined)
      return
    }
    if (!selectedPortId || !devicePorts.some((port) => port.id === selectedPortId)) {
      setSelectedPortId(devicePorts[0].id)
    }
  }, [devicePorts, selectedPortId])

  const selectedPort = selectedPortId ? portById[selectedPortId] : undefined
  const selectedLink = selectedPort ? linkByPortId[selectedPort.id] : undefined
  const peerPortId = selectedPort && selectedLink
    ? (selectedLink.fromPortId === selectedPort.id ? selectedLink.toPortId : selectedLink.fromPortId)
    : undefined
  const peerPort = peerPortId ? portById[peerPortId] : undefined
  const peerDevice = peerPort ? deviceById[peerPort.deviceId] : undefined

  useEffect(() => {
    setForm(selectedPort ? portToForm(selectedPort) : null)
    setError('')
  }, [selectedPort])

  const isVisualGrid =
    device &&
    (device.deviceType === 'switch' || device.deviceType === 'patch_panel' || device.deviceType === 'router')

  const linkedCount = devicePorts.filter((port) => port.linkState === 'up').length
  const totalCableCount = portLinks.length

  async function handleSave() {
    if (!selectedPort || !form) return

    setSaving(true)
    setError('')
    try {
      await updatePort(selectedPort.id, {
        name: form.name.trim(),
        speed: form.speed.trim() || undefined,
        linkState: form.linkState,
        vlanId: form.vlanId || undefined,
        description: form.description.trim() || undefined,
        face: form.face,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update port.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TopBar
        subtitle="Ports & cabling"
        title="Ports"
        meta={
          <>
            <Mono className="text-[var(--color-fg-muted)]">{linkedCount}</Mono>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              linked / {devicePorts.length} total | {totalCableCount} cables
            </span>
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-2)]/40">
          <div className="border-b border-[var(--color-line)] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              {portBearingDevices.length} devices
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {portBearingDevices.map((entry) => {
              const entryPorts = portsByDeviceId[entry.id] ?? []
              const linked = entryPorts.filter((port) => port.linkState === 'up').length
              const isActive = entry.id === selectedDeviceId
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    setSelectedDeviceId(entry.id)
                    setSelectedPortId(undefined)
                  }}
                  className={`flex w-full items-center gap-2.5 border-l-2 px-4 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-[var(--color-accent)] bg-[var(--color-surface)]'
                      : 'border-transparent hover:bg-[var(--color-surface)]/40'
                  }`}
                >
                  <DeviceTypeIcon type={entry.deviceType} className="size-3.5 shrink-0 text-[var(--color-fg-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-[var(--color-fg)]">{entry.hostname}</div>
                    <div className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                      {linked}/{entryPorts.length} linked
                    </div>
                  </div>
                  <StatusDot status={entry.status} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!device ? (
            <EmptyDevice />
          ) : (
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 xl:col-span-8">
                <div className="mb-5">
                  <div className="mb-1 flex items-center gap-2">
                    <DeviceTypeIcon type={device.deviceType} className="size-4 text-[var(--color-accent)]" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                      {device.deviceType.replace('_', ' ')}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight">{device.hostname}</h2>
                  <div className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">
                    {device.manufacturer} {device.model}
                    {device.managementIp && (
                      <>
                        <span className="mx-1.5 text-[var(--color-fg-faint)]">|</span>
                        <span className="font-mono">{device.managementIp}</span>
                      </>
                    )}
                  </div>
                </div>

                {isVisualGrid ? (
                  <PortGrid
                    device={device}
                    ports={devicePorts}
                    links={linkByPortId}
                    portsById={portById}
                    devicesById={deviceById}
                    onSelectPort={setSelectedPortId}
                    selectedPortId={selectedPortId}
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <CardLabel>Interfaces</CardLabel>
                        <CardHeading>{devicePorts.length} ports</CardHeading>
                      </CardTitle>
                    </CardHeader>
                    <CardBody className="p-0">
                      <PortList
                        ports={devicePorts}
                        links={linkByPortId}
                        portsById={portById}
                        devicesById={deviceById}
                        onSelectPort={setSelectedPortId}
                        selectedPortId={selectedPortId}
                      />
                    </CardBody>
                  </Card>
                )}
              </div>

              <div className="col-span-12 xl:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <CardLabel>Inspector</CardLabel>
                      <CardHeading>{selectedPort ? selectedPort.name : 'Select a port'}</CardHeading>
                    </CardTitle>
                    {selectedPort && <Badge tone="cyan">{selectedPort.kind}</Badge>}
                  </CardHeader>
                  <CardBody>
                    {!selectedPort || !form ? (
                      <div className="text-xs text-[var(--color-fg-subtle)]">
                        Select a port to edit its details.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Field label="Port name">
                          <Input
                            value={form.name}
                            onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                          />
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Speed">
                            <Input
                              value={form.speed}
                              onChange={(e) => setForm((prev) => (prev ? { ...prev, speed: e.target.value } : prev))}
                              placeholder="e.g. 10G"
                            />
                          </Field>
                          <Field label="Face">
                            <Select
                              value={form.face}
                              onChange={(value) => setForm((prev) => (prev ? { ...prev, face: value as PortFormState['face'] } : prev))}
                            >
                              <option value="front">Front</option>
                              <option value="rear">Rear</option>
                            </Select>
                          </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Link state">
                            <Select
                              value={form.linkState}
                              onChange={(value) => setForm((prev) => (prev ? { ...prev, linkState: value as Port['linkState'] } : prev))}
                            >
                              {LINK_STATES.map((state) => (
                                <option key={state} value={state}>
                                  {state}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="VLAN">
                            <Select
                              value={form.vlanId}
                              onChange={(value) => setForm((prev) => (prev ? { ...prev, vlanId: value } : prev))}
                            >
                              <option value="">Unassigned</option>
                              {vlans.map((vlan) => (
                                <option key={vlan.id} value={vlan.id}>
                                  {vlan.vlanId} - {vlan.name}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        </div>

                        <Field label="Description">
                          <textarea
                            value={form.description}
                            onChange={(e) => setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                            rows={3}
                            className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2.5 py-2 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:border-[var(--color-accent-soft)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent-soft)]"
                          />
                        </Field>

                        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
                          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                            Link
                          </div>
                          {selectedLink && peerDevice && peerPort ? (
                            <div className="space-y-1 text-xs">
                              <div className="inline-flex items-center gap-1.5">
                                <ArrowRight className="size-3 text-[var(--color-cyan)]" />
                                <span>{peerDevice.hostname}</span>
                                <span className="text-[var(--color-fg-faint)]">:</span>
                                <Mono className="text-[var(--color-cyan)]">{peerPort.name}</Mono>
                              </div>
                              <div className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                                {selectedLink.cableType ?? 'Cable'} | {selectedLink.cableLength ?? 'length n/a'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-[var(--color-fg-subtle)]">No linked cable.</div>
                          )}
                        </div>

                        {error && <div className="text-xs text-[var(--color-err)]">{error}</div>}

                        <div className="flex justify-end">
                          <Button variant="default" size="sm" disabled={saving} onClick={() => void handleSave()}>
                            <Save className="size-3.5" />
                            {saving ? 'Saving...' : 'Save port'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </span>
      {children}
    </label>
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:border-[var(--color-accent-soft)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent-soft)]"
    >
      {children}
    </select>
  )
}

function EmptyDevice() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="text-sm text-[var(--color-fg-subtle)]">Select a device</div>
      </div>
    </div>
  )
}
