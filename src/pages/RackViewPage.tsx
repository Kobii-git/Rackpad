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
                 