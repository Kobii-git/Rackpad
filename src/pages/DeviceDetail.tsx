import { useEffect, useMemo, useState } from 'react'
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
  const [monitorForm, setMonitorForm] = useState<MonitorForm>(EMPTY_MONITOR_FORM)
  const [monitorSaving, setMonitorSaving] = useState(false)
  const [monitorRunning, setMonitorRunning] = useState(false)
  const [monitorError, setMonitorError] = useState('')

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
    if (!monitor) {
      setMonitorForm(EMPTY_MONITOR_FORM)
      setMonitorError('')
      return
    }

    setMonitorForm({
      enabled: monitor.enabled,
      type: monitor.type,
      target: monitor.target ?? '',
      port: monitor.port != null ? String(monitor.port) : '',
      path: monitor.path ?? '',
      intervalMinutes: monitor.intervalMs != null ? String(Math.max(1, Math.round(monitor.intervalMs / 60000))) : '5',
    })
    setMonitorError('')
  }, [monitor])

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

  const devicePorts = portsByDeviceId[device.id] ?? []
  const linkedCount = devicePorts.filter((port) => port.linkState === 'up').length
  const rack = device.rackId ? racks.find((entry) => entry.id === device.rackId) : undefined
  const deviceIps = ipAssignments.filter((assignment) => assignment.deviceId === device.id)
  const isVisualGrid =
    device.deviceType === 'switch' ||
    device.deviceType === 'patch_panel' ||
    device.deviceType === 'router'
  const deviceAudit = auditLog.filter((entry) => entry.entityId === device.id)

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
      await saveDeviceMonitorConfig(device.id, {
        enabled: monitorForm.enabled,
        type: monitorForm.enabled ? monitorForm.type : 'none',
        target: monitorForm.target.trim() || null,
        port: monitorForm.port.trim() ? Number.parseInt(monitorForm.port, 10) : null,
        path: monitorForm.path.trim() || null,
        intervalMs: Math.max(1, Number.parseInt(monitorForm.intervalMinutes, 10) || 5) * 60 * 1000,
      })
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
                    <Row label="Rack" value={rack?.name} />
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
            {isVisualGrid ? (
              <PortGrid
                device={device}
                ports={devicePorts}
                li