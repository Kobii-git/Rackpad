import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { DeviceDrawer } from '@/components/shared/DeviceDrawer'
import { TopBar } from '@/components/layout/TopBar'
import { RackView } from '@/components/rack/RackView'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Mono } from '@/components/shared/Mono'
import { StatusDot } from '@/components/shared/StatusDot'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import { Card, CardHeader, CardTitle, CardLabel, CardHeading, CardBody } from '@/components/ui/Card'
import {
  canEditInventory,
  createRackRecord,
  deleteRackRecord,
  updateRackRecord,
  useStore,
} from '@/lib/store'
import { ExternalLink, Pencil, Plus, Save, Server, Trash2 } from 'lucide-react'
import type { Port, RackFace } from '@/lib/types'
import { statusLabel } from '@/lib/utils'

type RackForm = {
  name: string
  totalU: string
  description: string
  location: string
  notes: string
}

const EMPTY_FORM: RackForm = {
  name: '',
  totalU: '42',
  description: '',
  location: '',
  notes: '',
}

export default function RackViewPage() {
  const currentUser = useStore((s) => s.currentUser)
  const racks = useStore((s) => s.racks)
  const devices = useStore((s) => s.devices)
  const ports = useStore((s) => s.ports)
  const canEdit = canEditInventory(currentUser)
  const [rackId, setRackId] = useState('')
  const [face, setFace] = useState<RackFace>('front')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [creatingRack, setCreatingRack] = useState(false)
  const [savingRack, setSavingRack] = useState(false)
  const [deletingRack, setDeletingRack] = useState(false)
  const [rackError, setRackError] = useState('')
  const [rackForm, setRackForm] = useState<RackForm>(EMPTY_FORM)

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

  useEffect(() => {
    if (!rack || creatingRack) return
    setRackForm({
      name: rack.name,
      totalU: String(rack.totalU),
      description: rack.description ?? '',
      location: rack.location ?? '',
      notes: rack.notes ?? '',
    })
  }, [creatingRack, rack])

  const rackDevices = rack ? devices.filter((device) => device.rackId === rack.id) : []
  const selectedDevice = selectedDeviceId
    ? devices.find((device) => device.id === selectedDeviceId)
    : undefined

  async function handleSaveRack() {
    setSavingRack(true)
    setRackError('')
    try {
      if (creatingRack) {
        const created = await createRackRecord({
          labId: 'lab_home',
          name: rackForm.name.trim(),
          totalU: Number.parseInt(rackForm.totalU, 10) || 42,
          description: rackForm.description.trim() || undefined,
          location: rackForm.location.trim() || undefined,
          notes: rackForm.notes.trim() || undefined,
        })
        setRackId(created.id)
        setCreatingRack(false)
        setEditorOpen(false)
        return
      }

      if (!rack) return
      await updateRackRecord(rack.id, {
        name: rackForm.name.trim(),
        totalU: Number.parseInt(rackForm.totalU, 10) || 42,
        description: rackForm.description.trim() || null,
        location: rackForm.location.trim() || null,
        notes: rackForm.notes.trim() || null,
      })
      setEditorOpen(false)
    } catch (err) {
      setRackError(err instanceof Error ? err.message : 'Failed to save rack.')
    } finally {
      setSavingRack(false)
    }
  }

  async function handleDeleteRack() {
    if (!rack) return
    if (!window.confirm(`Delete rack ${rack.name}? Devices will become unracked.`)) return

    setDeletingRack(true)
    setRackError('')
    try {
      await deleteRackRecord(rack.id)
      setRackId('')
      setEditorOpen(false)
    } catch (err) {
      setRackError(err instanceof Error ? err.message : 'Failed to delete rack.')
    } finally {
      setDeletingRack(false)
    }
  }

  if (!rack && !creatingRack) {
    return (
      <>
        <TopBar
          subtitle="Physical layout"
          title="Racks"
          actions={
            canEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatingRack(true)
                  setEditorOpen(true)
                  setRackForm(EMPTY_FORM)
                }}
              >
                <Plus className="size-3.5" />
                Add rack
              </Button>
            ) : undefined
          }
        />
        <div className="flex flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>
                <CardLabel>Inventory</CardLabel>
                <CardHeading>No racks documented yet</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="text-sm text-[var(--color-fg-subtle)]">
                Create your first rack to start placing devices physically.
              </div>
              {canEdit && (
                <Button
                  onClick={() => {
                    setCreatingRack(true)
                    setEditorOpen(true)
                    setRackForm(EMPTY_FORM)
                  }}
                >
                  <Plus className="size-3.5" />
                  Create first rack
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
        {editorOpen && <RackEditorCard
          creatingRack={creatingRack}
          rackForm={rackForm}
          setRackForm={setRackForm}
          rackError={rackError}
          savingRack={savingRack}
          deletingRack={deletingRack}
          canDelete={false}
          onSave={() => void handleSaveRack()}
          onDelete={() => void handleDeleteRack()}
          onCancel={() => {
            setCreatingRack(false)
            setEditorOpen(false)
            setRackError('')
          }}
        />}
      </>
    )
  }

  return (
    <>
      <TopBar
        subtitle="Physical layout"
        title="Racks"
        actions={
          canEdit ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatingRack(true)
                  setEditorOpen(true)
                  setRackForm(EMPTY_FORM)
                }}
              >
                <Plus className="size-3.5" />
                Add rack
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatingRack(false)
                  setEditorOpen((value) => !value)
                }}
              >
                <Pencil className="size-3.5" />
                {editorOpen && !creatingRack ? 'Hide rack editor' : 'Edit rack'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
                <Plus className="size-3.5" />
                Add device
              </Button>
            </>
          ) : undefined
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
              const isActive = entry.id === rack?.id
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    setRackId(entry.id)
                    setSelectedDeviceId(undefined)
                    setCreatingRack(false)
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
          {rack && (
            <>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                    Rack
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-[var(--color-fg)]">{rack.name}</h2>
                  <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">{rack.location}</div>
                </div>

                <Tabs value={face} onValueChange={(value) => setFace(value as RackFace)}>
                  <TabsList>
                    <TabsTrigger value="front">Front</TabsTrigger>
                    <TabsTrigger value="rear">Rear</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {editorOpen && canEdit && (
                <div className="mb-5">
                  <RackEditorCard
                    creatingRack={creatingRack}
                    rackForm={rackForm}
                    setRackForm={setRackForm}
                    rackError={rackError}
                    savingRack={savingRack}
                    deletingRack={deletingRack}
                    canDelete={!creatingRack}
                    onSave={() => void handleSaveRack()}
                    onDelete={() => void handleDeleteRack()}
                    onCancel={() => {
                      setCreatingRack(false)
                      setEditorOpen(false)
                      setRackError('')
                    }}
                  />
                </div>
              )}

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
                              value={`${selectedDevice.face} | U${selectedDevice.startU}${
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
            </>
          )}
        </div>
      </div>

      {rack && (
        <DeviceDrawer
          open={drawerOpen}
          defaultRackId={rack.id}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  )
}

function RackEditorCard({
  creatingRack,
  rackForm,
  setRackForm,
  rackError,
  savingRack,
  deletingRack,
  canDelete,
  onSave,
  onDelete,
  onCancel,
}: {
  creatingRack: boolean
  rackForm: RackForm
  setRackForm: React.Dispatch<React.SetStateAction<RackForm>>
  rackError: string
  savingRack: boolean
  deletingRack: boolean
  canDelete: boolean
  onSave: () => void
  onDelete: () => void
  onCancel: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <CardLabel>{creatingRack ? 'New rack' : 'Rack editor'}</CardLabel>
          <CardHeading>{creatingRack ? 'Create rack' : 'Update rack metadata'}</CardHeading>
        </CardTitle>
        <Badge tone="info">
          <Server className="size-3" />
          Physical layout
        </Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Rack name">
            <Input
              value={rackForm.name}
              onChange={(event) => setRackForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Rack A"
            />
          </Field>
          <Field label="Total U">
            <Input
              type="number"
              min={1}
              max={100}
              value={rackForm.totalU}
              onChange={(event) => setRackForm((prev) => ({ ...prev, totalU: event.target.value }))}
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Location">
            <Input
              value={rackForm.location}
              onChange={(event) => setRackForm((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="Garage wall, office, DC row A"
            />
          </Field>
          <Field label="Description">
            <Input
              value={rackForm.description}
              onChange={(event) => setRackForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Main homelab rack"
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            rows={3}
            value={rackForm.notes}
            onChange={(event) => setRackForm((prev) => ({ ...prev, notes: event.target.value }))}
            className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2.5 py-2 text-sm text-[var(--color-fg)] focus-visible:border-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-soft)]"
            placeholder="Power feeds, cooling notes, ownership..."
          />
        </Field>

        {rackError && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-err)]/30 bg-[var(--color-err)]/10 px-3 py-2 text-sm text-[var(--color-err)]">
            {rackError}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete} disabled={deletingRack}>
                <Trash2 className="size-3.5" />
                {deletingRack ? 'Deleting...' : 'Delete rack'}
              </Button>
            )}
            <Button size="sm" onClick={onSave} disabled={savingRack}>
              <Save className="size-3.5" />
              {savingRack ? 'Saving...' : creatingRack ? 'Create rack' : 'Save rack'}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
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
