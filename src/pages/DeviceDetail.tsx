import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DeviceDrawer } from '@/components/shared/DeviceDrawer'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader, CardHeading, CardLabel, CardTitle } from '@/components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { StatusDot } from '@/components/shared/StatusDot'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import { Mono } from '@/components/shared/Mono'
import { PortGrid } from '@/components/ports/PortGrid'
import { PortList } from '@/components/ports/PortList'
import { api } from '@/lib/api'
import {
  canEditInventory,
  deleteDevice,
  loadAll,
  runDeviceMonitorCheck,
  saveDeviceMonitorConfig,
  unassignIp,
  useStore,
} from '@/lib/store'
import type { Device, DeviceMonitor, Port, PortLink } from '@/lib/types'
import { ArrowLeft, Pencil, RefreshCcw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { relativeTime, statusLabel } from '@/lib/utils'

type MonitorForm = {
  enabled: boolean
  type: DeviceMonitor['type']
  target: string
  port: string
  path: string
  intervalMinutes: string
}

const EMPTY_MONITOR_FORM: MonitorForm = {
  enabled: false,
  type: 'none',
  target: '',
  port: '',
  path: '',
  intervalMinutes: '5',
}

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)
  const devices = useStore((s) => s.devices)
  const ports = useStore((s) => s.ports)
  const portLinks = useStore((s) => s.portLinks)
  const ipAssignments = useStore((s) => s.ipAssignments)
  const auditLog = useStore((s) => s.auditLog)
  const racks = useStore((s) => s.racks)
  const deviceMonitors = useStore((s) => s.deviceMonitors)
  const canEdit = canEditInventory(currentUser)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [selectedPortId, setSelectedPortId] = useState<string | undefined>()
  const [monitorForm, setMonitorForm] = useState<MonitorForm>(EMPTY_MONITOR_FORM)
  const [monitorSaving, setMonitorSaving] = useState(false)
  const [monitorRunning, setMonitorRunning] = useState(false)
  const [monitorError, setMonitorError] = useState('')
  const [activityEntries, setActivityEntries] = useState<typeof auditLog>([])
  const [activityLimit, setActivityLimit] = useState(500)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState('')

  const device = id ? devices.find((entry) => entry.id === id) : undefined
  const monitor = id ? deviceMonitors.find((entry) => entry.deviceId === id) : undefined

  const portsByDeviceId = useMemo(() => {
    return ports.reduce<Record<string, Port[]>>((acc, port) => {
      ;(acc[port.deviceId] ??= []).push(port)
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

  const portById = useMemo(() => {
    return ports.reduce<Record<string, Port>>((acc, port) => {
      acc[port.id] = port
      return acc
    }, {})
  }, [ports])

  const deviceById = useMemo(() => {
    return devices.reduce<Record<string, Device>>((acc, entry) => {
      acc[entry.id] = entry
      return acc
    }, {})
  }, [devices])

  useEffect(() => {
    if (!device) return

    if (!monitor) {
      setMonitorForm({
        ...EMPTY_MONITOR_FORM,
        type: device.managementIp ? 'icmp' : 'none',
        target: device.managementIp ?? '',
      })
      setMonitorError('')
      return
    }

    setMonitorForm({
      enabled: monitor.enabled,
      type: monitor.type,
      target: monitor.target ?? device.managementIp ?? '',
      port: monitor.port != null ? String(monitor.port) : '',
      path: monitor.path ?? '',
      intervalMinutes: monitor.intervalMs != null ? String(Math.max(1, Math.round(monitor.intervalMs / 60000))) : '5',
    })
    setMonitorError('')
  }, [device, monitor])

  const devicePorts = device?.id ? portsByDeviceId[device.id] ?? [] : []
  const rack = device?.rackId ? racks.find((entry) => entry.id === device.rackId) : undefined
  const deviceIps = device?.id ? ipAssignments.filter((assignment) => assignment.deviceId === device.id) : []
  const parentDevice = device?.parentDeviceId ? deviceById[device.parentDeviceId] : undefined
  const childDevices = device ? devices.filter((entry) => entry.parentDeviceId === device.id) : []
  const selectedPort = selectedPortId ? devicePorts.find((port) => port.id === selectedPortId) : undefined
  const selectedLink = selectedPort ? linkByPortId[selectedPort.id] : undefined
  const peerPortId = selectedPort && selectedLink
    ? (selectedLink.fromPortId === selectedPort.id ? selectedLink.toPortId : selectedLink.fromPortId)
    : undefined
  const peerPort = peerPortId ? portById[peerPortId] : undefined
  const peerDevice = peerPort ? deviceById[peerPort.deviceId] : undefined
  const linkedCount = devicePorts.filter((port) => port.linkState === 'up').length
  const isVisualGrid =
    device?.deviceType === 'switch' ||
    device?.deviceType === 'patch_panel' ||
    device?.deviceType === 'router'

  useEffect(() => {
    if (!devicePorts.length) {
      setSelectedPortId(undefined)
      return
    }
    if (!selectedPortId || !devicePorts.some((port) => port.id === selectedPortId)) {
      setSelectedPortId(devicePorts[0].id)
    }
  }, [devicePorts, selectedPortId])

  if (!device) {
    return (
      <>
        <TopBar subtitle="Devices" title="Not found" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 text-sm text-[var(--color-fg-subtle)]">Device not found.</div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/devices">
                <ArrowLeft />
                Back to devices
              </Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  useEffect(() => {
    if (!device) {
      setActivityEntries([])
      return
    }
    const filtered = auditLog.filter((entry) => entry.entityId === device.id)
    setActivityEntries(filtered)
    setActivityLimit(Math.max(500, filtered.length || 0))
    setActivityError('')
  }, [auditLog, device])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await loadAll(true)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleDelete() {
    if (!device) return
    if (!window.confirm(`Delete ${device.hostname}? This will remove its ports and IP assignments too.`)) {
      return
    }

    setDeleting(true)
    try {
      const deleted = await deleteDevice(device.id)
      if (deleted) {
        navigate('/devices')
      }
    } finally {
      setDeleting(false)
    }
  }

  async function handleUnassignIp(assignmentId: string) {
    setReleasingId(assignmentId)
    try {
      await unassignIp(assignmentId)
    } finally {
      setReleasingId(null)
    }
  }

  async function handleSaveMonitor() {
    if (!device) return
    setMonitorSaving(true)
    setMonitorError('')
    try {
      const usesPort =
        monitorForm.type === 'tcp' || monitorForm.type === 'http' || monitorForm.type === 'https'
      const usesPath = monitorForm.type === 'http' || monitorForm.type === 'https'
      await saveDeviceMonitorConfig(device.id, {
        enabled: monitorForm.enabled,
        type: monitorForm.enabled ? monitorForm.type : 'none',
        target: monitorForm.target.trim() || null,
        port: usesPort && monitorForm.port.trim() ? Number.parseInt(monitorForm.port, 10) : null,
        path: usesPath ? monitorForm.path.trim() || null : null,
        intervalMs: Math.max(1, Number.parseInt(monitorForm.intervalMinutes, 10) || 5) * 60 * 1000,
      })
      if (monitorForm.enabled && monitorForm.type !== 'none') {
        await runDeviceMonitorCheck(device.id)
      }
    } catch (err) {
      setMonitorError(err instanceof Error ? err.message : 'Failed to save monitor.')
    } finally {
      setMonitorSaving(false)
    }
  }

  async function handleRunMonitor() {
    if (!device) return
    setMonitorRunning(true)
    setMonitorError('')
    try {
      await runDeviceMonitorCheck(device.id)
    } catch (err) {
      setMonitorError(err instanceof Error ? err.message : 'Failed to run monitor.')
    } finally {
      setMonitorRunning(false)
    }
  }

  async function handleLoadMoreActivity() {
    if (!device) return
    const nextLimit = activityLimit + 250
    setActivityLoading(true)
    setActivityError('')
    try {
      const entries = await api.getAuditLog({ entityId: device.id, limit: nextLimit })
      setActivityEntries(entries)
      setActivityLimit(nextLimit)
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to load additional audit entries.')
    } finally {
      setActivityLoading(false)
    }
  }

  const showMonitorPortField =
    monitorForm.type === 'tcp' || monitorForm.type === 'http' || monitorForm.type === 'https'
  const showMonitorPathField = monitorForm.type === 'http' || monitorForm.type === 'https'
  const monitorTypeDescription = describeMonitorType(monitorForm.type)

  return (
    <>
      <TopBar
        subtitle={
          rack ? (
            <>
              Devices | <Link to="/racks" className="hover:text-[var(--color-fg-muted)]">{rack.name}</Link>
            </>
          ) : 'Devices'
        }
        title={device.hostname}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status={device.status} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
                {statusLabel[device.status]}
              </span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              | {device.manufacturer} {device.model}
            </span>
          </>
        }
        actions={
          <>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
              <RefreshCcw className="size-3.5" />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            {canEdit && (
              <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
                <Trash2 className="size-3.5" />
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/devices">
              <ArrowLeft className="size-3.5" />
              Devices
            </Link>
          </Button>
        </div>

        <Card className="relative mb-4 overflow-hidden">
          <span className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-60" />
          <div className="flex items-center gap-5 px-5 py-4">
            <div className="grid size-12 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-[var(--color-surface)]">
              <DeviceTypeIcon type={device.deviceType} className="size-5 text-[var(--color-accent)]" />
            </div>
            <div className="flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                {device.deviceType.replace('_', ' ')}
              </div>
              <h1 className="text-xl font-semibold tracking-tight">{device.hostname}</h1>
              <div className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">
                {device.displayName}
                {rack && (
                  <>
                    <span className="mx-1.5 text-[var(--color-fg-faint)]">|</span>
                    {rack.name} U{device.startU}
                    {(device.heightU ?? 1) > 1 ? `-${device.startU! + device.heightU! - 1}` : ''}
                  </>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-[11px]">
              <Stat label="Mgmt IP" value={device.managementIp} mono />
              <Stat label="Serial" value={device.serial} mono />
              <Stat label="Last seen" value={relativeTime(device.lastSeen)} />
              <Stat label="Ports" value={`${linkedCount}/${devicePorts.length} linked`} />
              <Stat label="IPs" value={String(deviceIps.length)} />
              <Stat label="Tags" value={device.tags?.join(', ') ?? '-'} />
            </dl>
          </div>
        </Card>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ports">Ports | {devicePorts.length}</TabsTrigger>
            <TabsTrigger value="network">Network | {deviceIps.length}</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <div className="grid grid-cols-12 gap-3">
              <Card className="col-span-12 md:col-span-6">
                <CardHeader>
                  <CardTitle>
                    <CardLabel>Hardware</CardLabel>
                    <CardHeading>Specifications</CardHeading>
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <dl className="space-y-2 text-xs">
                    <Row label="Manufacturer" value={device.manufacturer} />
                    <Row label="Model" value={device.model} mono />
                    <Row label="Serial" value={device.serial} mono />
                    <Row label="Type" value={device.deviceType.replace('_', ' ')} />
                  </dl>
                </CardBody>
              </Card>
              <Card className="col-span-12 md:col-span-6">
                <CardHeader>
                  <CardTitle>
                    <CardLabel>Placement</CardLabel>
                    <CardHeading>Rack position</CardHeading>
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <dl className="space-y-2 text-xs">
                    <Row label="Placement" value={formatPlacement(device.placement)} />
                    <Row label="Rack" value={rack?.name} />
                    <Row
                      label={device.placement === 'wireless' ? 'Connected AP' : device.placement === 'virtual' ? 'Host device' : 'Parent'}
                      value={parentDevice?.hostname}
                    />
                    <Row label="Face" value={device.face} />
                    <Row
                      label="U position"
                      value={
                        device.startU
                          ? `U${device.startU}${(device.heightU ?? 1) > 1 ? `-${device.startU + (device.heightU ?? 1) - 1}` : ''} (${device.heightU ?? 1}U)`
                          : undefined
                      }
                    />
                    <Row label="Last seen" value={relativeTime(device.lastSeen)} />
                  </dl>
                </CardBody>
              </Card>
              {childDevices.length > 0 && (
                <Card className="col-span-12">
                  <CardHeader>
                    <CardTitle>
                      <CardLabel>Relationships</CardLabel>
                      <CardHeading>
                        {device.deviceType === 'ap' ? 'Connected clients' : 'Hosted / child devices'}
                      </CardHeading>
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {childDevices
                        .sort((a, b) => a.hostname.localeCompare(b.hostname))
                        .map((child) => (
                          <Link
                            key={child.id}
                            to={`/devices/${child.id}`}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 transition-colors hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface)]"
                          >
                            <div className="flex items-center gap-2">
                              <DeviceTypeIcon type={child.deviceType} className="size-4 text-[var(--color-accent)]" />
                              <span className="text-sm text-[var(--color-fg)]">{child.hostname}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                              {child.displayName || child.managementIp || formatPlacement(child.placement)}
                            </div>
                          </Link>
                        ))}
                    </div>
                  </CardBody>
                </Card>
              )}
              {device.tags && device.tags.length > 0 && (
                <Card className="col-span-12">
                  <CardHeader>
                    <CardTitle>
                      <CardLabel>Metadata</CardLabel>
                      <CardHeading>Tags</CardHeading>
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="flex flex-wrap gap-1.5">
                      {device.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ports" className="pt-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 xl:col-span-8">
                {devicePorts.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <CardLabel>Interfaces</CardLabel>
                        <CardHeading>No ports documented</CardHeading>
                      </CardTitle>
                    </CardHeader>
                    <CardBody>
                      <div className="text-sm text-[var(--color-fg-subtle)]">
                        Add or template ports for this device to inspect cabling, VLANs, and interface notes here.
                      </div>
                    </CardBody>
                  </Card>
                ) : isVisualGrid ? (
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
                <PortInspectorCard
                  port={selectedPort}
                  peerPort={peerPort}
                  peerDevice={peerDevice}
                  link={selectedLink}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="network" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <CardLabel>Addresses</CardLabel>
                  <CardHeading>IP assignments</CardHeading>
                </CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <div className="divide-y divide-[var(--color-line)]">
                  {deviceIps.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                      No IPs assigned to this device.
                    </div>
                  ) : (
                    deviceIps.map((ip) => (
                      <div key={ip.id} className="grid grid-cols-12 items-center gap-3 px-4 py-2">
                        <Mono className="col-span-3 text-[var(--color-fg)]">{ip.ipAddress}</Mono>
                        <div className="col-span-3 text-xs">{ip.hostname}</div>
                        <div className="col-span-4 text-[11px] text-[var(--color-fg-subtle)]">
                          {ip.description ?? '-'}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          <Badge tone="cyan">{ip.assignmentType}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={releasingId === ip.id || !canEdit}
                            onClick={() => void handleUnassignIp(ip.id)}
                          >
                            {releasingId === ip.id ? 'Releasing...' : 'Unassign'}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <CardLabel>Health checks</CardLabel>
                  <CardHeading>Automated device monitoring</CardHeading>
                </CardTitle>
                <Badge tone={monitor?.lastResult === 'online' ? 'ok' : monitor?.lastResult === 'offline' ? 'err' : 'neutral'}>
                  <ShieldCheck className="size-3" />
                  {monitor?.lastResult ?? 'not configured'}
                </Badge>
              </CardHeader>
              <CardBody className="space-y-4">
                <label className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]">
                  <input
                    type="checkbox"
                    checked={monitorForm.enabled}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMonitorForm((prev) => ({ ...prev, enabled: event.target.checked }))
                    }
                  />
                  Enable health checks for this device
                </label>

                <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg-subtle)]">
                  Rackpad runs these checks from the server or Docker container itself. A device stays
                  <span className="mx-1 font-mono text-[var(--color-fg)]">unknown</span>
                  until a monitor is enabled and at least one check has run.
                </div>

                <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg-subtle)]">
                  {monitorTypeDescription}
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Type">
                    <Select
                      value={monitorForm.type}
                      onChange={(value) => setMonitorForm((prev) => ({ ...prev, type: value as MonitorForm['type'] }))}
                      disabled={!canEdit}
                    >
                      <option value="none">none</option>
                      <option value="icmp">icmp</option>
                      <option value="tcp">tcp</option>
                      <option value="http">http</option>
                      <option value="https">https</option>
                    </Select>
                  </Field>
                  <Field label="Target">
                    <Input
                      value={monitorForm.target}
                      disabled={!canEdit}
                      onChange={(event) => setMonitorForm((prev) => ({ ...prev, target: event.target.value }))}
                      placeholder="10.0.10.12 or host.example"
                    />
                  </Field>
                  {showMonitorPortField && (
                    <Field label="Port">
                      <Input
                        value={monitorForm.port}
                        disabled={!canEdit}
                        onChange={(event) => setMonitorForm((prev) => ({ ...prev, port: event.target.value }))}
                        placeholder={monitorForm.type === 'tcp' ? '22, 443, 8006' : monitorForm.type === 'https' ? '443' : '80'}
                      />
                    </Field>
                  )}
                  <Field label="Every (minutes)">
                    <Input
                      value={monitorForm.intervalMinutes}
                      disabled={!canEdit}
                      onChange={(event) => setMonitorForm((prev) => ({ ...prev, intervalMinutes: event.target.value }))}
                      placeholder="5"
                    />
                  </Field>
                </div>

                {showMonitorPathField && (
                  <Field label="HTTP path">
                    <Input
                      value={monitorForm.path}
                      disabled={!canEdit}
                      onChange={(event) => setMonitorForm((prev) => ({ ...prev, path: event.target.value }))}
                      placeholder="/health"
                    />
                  </Field>
                )}

                <div className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] p-4 md:grid-cols-3">
                  <MonitorStat label="Last check" value={monitor?.lastCheckAt ? new Date(monitor.lastCheckAt).toLocaleString() : 'Never'} />
                  <MonitorStat label="Last result" value={monitor?.lastResult ?? 'unknown'} />
                  <MonitorStat label="Message" value={monitor?.lastMessage ?? 'No checks have run yet.'} />
                </div>

                {monitorError && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-err)]/30 bg-[var(--color-err)]/10 px-3 py-2 text-sm text-[var(--color-err)]">
                    {monitorError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => void handleRunMonitor()} disabled={monitorRunning}>
                    <ShieldCheck className="size-3.5" />
                    {monitorRunning ? 'Running...' : 'Run now'}
                  </Button>
                  {canEdit && (
                    <Button size="sm" onClick={() => void handleSaveMonitor()} disabled={monitorSaving}>
                      <Save className="size-3.5" />
                      {monitorSaving ? 'Saving...' : 'Save monitor'}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <CardLabel>Documentation</CardLabel>
                  <CardHeading>Device notes</CardHeading>
                </CardTitle>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
                    <Pencil className="size-3.5" />
                    Edit notes
                  </Button>
                )}
              </CardHeader>
              <CardBody>
                {device.notes?.trim() ? (
                  <div className="whitespace-pre-wrap text-sm leading-6 text-[var(--color-fg)]">
                    {device.notes}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--color-fg-subtle)]">
                    No notes documented for this device yet.
                  </div>
                )}
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <CardLabel>History</CardLabel>
                  <CardHeading>Audit log</CardHeading>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => void handleLoadMoreActivity()} disabled={activityLoading}>
                  <RefreshCcw className="size-3.5" />
                  {activityLoading ? 'Loading...' : 'Load more'}
                </Button>
              </CardHeader>
              <CardBody className="p-0">
                {activityError && (
                  <div className="border-b border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-err)]">
                    {activityError}
                  </div>
                )}
                <ul className="divide-y divide-[var(--color-line)]">
                  {activityEntries.length === 0 ? (
                    <li className="px-4 py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                      No audit entries for this device.
                    </li>
                  ) : (
                    activityEntries.map((entry) => (
                      <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--color-surface)]/40">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs">{entry.summary}</div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Mono className="text-[10px] text-[var(--color-fg-subtle)]">{entry.user}</Mono>
                            <span className="text-[10px] text-[var(--color-fg-faint)]">|</span>
                            <Mono className="text-[10px] text-[var(--color-fg-subtle)]">{entry.action}</Mono>
                          </div>
                        </div>
                        <span className="whitespace-nowrap font-mono text-[10px] text-[var(--color-fg-faint)]">
                          {relativeTime(entry.ts)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </CardBody>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {canEdit && <DeviceDrawer device={device} open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
    </>
  )
}

function PortInspectorCard({
  port,
  peerPort,
  peerDevice,
  link,
}: {
  port?: Port
  peerPort?: Port
  peerDevice?: Device
  link?: PortLink
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <CardLabel>Inspector</CardLabel>
          <CardHeading>{port ? port.name : 'Select a port'}</CardHeading>
        </CardTitle>
        {port ? <Badge tone="cyan">{port.kind.replace('_', ' ')}</Badge> : null}
      </CardHeader>
      <CardBody className="space-y-4">
        {!port ? (
          <div className="text-sm text-[var(--color-fg-subtle)]">
            Click a port to inspect its speed, VLAN, description, and cable peer.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <InspectorRow label="State">
                <span className="inline-flex items-center gap-2 text-sm text-[var(--color-fg)]">
                  <StatusDot link={port.linkState} />
                  {formatLinkState(port.linkState)}
                </span>
              </InspectorRow>
              <InspectorRow label="Speed" value={port.speed ?? 'Not set'} mono />
              <InspectorRow label="Face" value={port.face ?? 'front'} />
              <InspectorRow label="Position" value={String(port.position)} mono />
              <InspectorRow label="VLAN" value={port.vlanId ?? 'Unassigned'} mono />
              <InspectorRow label="Type" value={port.kind.replace('_', ' ')} />
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                Description
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]">
                {port.description?.trim() || 'No description documented.'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                Link peer
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2">
                {peerDevice && peerPort ? (
                  <div className="space-y-1 text-sm">
                    <div className="text-[var(--color-fg)]">
                      {peerDevice.hostname}
                      <span className="mx-1 text-[var(--color-fg-faint)]">|</span>
                      <Mono className="text-[var(--color-cyan)]">{peerPort.name}</Mono>
                    </div>
                    <div className="text-[11px] text-[var(--color-fg-subtle)]">
                      {link?.cableType ?? 'Cable'} | {link?.cableLength ?? 'length n/a'}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[var(--color-fg-subtle)]">No linked cable.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link to="/ports">Open in ports workspace</Link>
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

function InspectorRow({
  label,
  value,
  mono,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  children?: ReactNode
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      {children ?? (
        <div className={`mt-1 text-sm text-[var(--color-fg)] ${mono ? 'font-mono' : ''}`}>{value ?? '-'}</div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
  disabled,
  children,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-fg)] focus-visible:border-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-soft)]"
    >
      {children}
    </select>
  )
}

function MonitorStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-1 text-sm text-[var(--color-fg)]">{value}</div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-3 capitalize">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className={`text-right text-[var(--color-fg)] normal-case ${mono ? 'font-mono text-[11px]' : 'text-xs'}`}>
        {value}
      </dd>
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className={mono ? 'font-mono text-[var(--color-fg)]' : 'text-[var(--color-fg)]'}>
        {value ?? '-'}
      </dd>
    </div>
  )
}

function describeMonitorType(type: MonitorForm['type']) {
  switch (type) {
    case 'icmp':
      return 'ICMP is best for simple reachability. It answers "can the Rackpad server or container reach this host on the network?"'
    case 'tcp':
      return 'TCP checks a specific service port from the Rackpad server. Port 22 only shows online when SSH itself is reachable from the server or container.'
    case 'http':
      return 'HTTP checks fetch a URL from the Rackpad server and expect a successful response.'
    case 'https':
      return 'HTTPS checks fetch a secure URL from the Rackpad server and expect a successful response.'
    default:
      return 'Choose a monitor type to enable automated health checks for this device.'
  }
}

function formatLinkState(state: Port['linkState']) {
  switch (state) {
    case 'up':
      return 'Up'
    case 'down':
      return 'Down'
    case 'disabled':
      return 'Disabled'
    default:
      return 'Unknown'
  }
}

function formatPlacement(placement?: Device['placement']) {
  switch (placement) {
    case 'rack':
      return 'Rack mounted'
    case 'wireless':
      return 'WiFi linked'
    case 'virtual':
      return 'Virtual'
    case 'room':
      return 'Loose / room'
    default:
      return 'Loose / room'
  }
}
