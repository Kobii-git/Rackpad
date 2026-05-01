import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle, CardLabel, CardHeading, CardBody } from '@/components/ui/Card'
import { Mono } from '@/components/shared/Mono'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { canEditInventory, createCable, deleteCable, updateCable, useStore } from '@/lib/store'
import type { Device, Port, PortLink } from '@/lib/types'
import { ArrowRight, Cable as CableIcon, Filter, Plus, Save, Trash2 } from 'lucide-react'

interface CableFormState {
  fromPortId: string
  toPortId: string
  cableType: string
  cableLength: string
  color: string
  notes: string
}

const EMPTY_FORM: CableFormState = {
  fromPortId: '',
  toPortId: '',
  cableType: '',
  cableLength: '',
  color: '',
  notes: '',
}

export default function CableView() {
  const currentUser = useStore((s) => s.currentUser)
  const portLinks = useStore((s) => s.portLinks)
  const ports = useStore((s) => s.ports)
  const devices = useStore((s) => s.devices)
  const canEdit = canEditInventory(currentUser)
  const [query, setQuery] = useState('')
  const [cableType, setCableType] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<CableFormState>(EMPTY_FORM)
  const [selectedLinkId, setSelectedLinkId] = useState<string>()
  const [editForm, setEditForm] = useState({
    cableType: '',
    cableLength: '',
    color: '',
    notes: '',
  })
  const [createError, setCreateError] = useState('')
  const [editError, setEditError] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const portById = useMemo(() => {
    return ports.reduce<Record<string, Port>>((acc, port) => {
      acc[port.id] = port
      return acc
    }, {})
  }, [ports])

  const deviceById = useMemo(() => {
    return devices.reduce<Record<string, Device>>((acc, device) => {
      acc[device.id] = device
      return acc
    }, {})
  }, [devices])

  const filtered = useMemo(() => {
    return [...portLinks]
      .filter((link) => {
        if (cableType && link.cableType !== cableType) return false
        if (!query) return true
        const fromPort = portById[link.fromPortId]
        const toPort = portById[link.toPortId]
        const fromDev = fromPort ? deviceById[fromPort.deviceId] : undefined
        const toDev = toPort ? deviceById[toPort.deviceId] : undefined
        const haystack = [
          fromDev?.hostname,
          toDev?.hostname,
          fromPort?.name,
          toPort?.name,
          link.cableType,
          link.color,
          link.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(query.toLowerCase())
      })
      .sort((a, b) => cableSortLabel(a, portById, deviceById).localeCompare(cableSortLabel(b, portById, deviceById)))
  }, [cableType, deviceById, portById, portLinks, query])

  const byType = useMemo(() => {
    return portLinks.reduce<Record<string, number>>((acc, link) => {
      const key = link.cableType ?? 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
  }, [portLinks])

  const linkedPortIds = useMemo(() => {
    const ids = new Set<string>()
    for (const link of portLinks) {
      ids.add(link.fromPortId)
      ids.add(link.toPortId)
    }
    return ids
  }, [portLinks])

  const availablePorts = useMemo(() => {
    return [...ports]
      .filter((port) => !linkedPortIds.has(port.id))
      .sort((a, b) => portOptionLabel(a, deviceById).localeCompare(portOptionLabel(b, deviceById)))
  }, [deviceById, linkedPortIds, ports])

  const selectedLink = selectedLinkId ? portLinks.find((link) => link.id === selectedLinkId) : undefined

  useEffect(() => {
    if (!filtered.length) {
      setSelectedLinkId(undefined)
      return
    }
    if (selectedLinkId && filtered.some((link) => link.id === selectedLinkId)) {
      return
    }
    setSelectedLinkId(filtered[0].id)
  }, [filtered, selectedLinkId])

  useEffect(() => {
    if (!selectedLink) {
      setEditForm({ cableType: '', cableLength: '', color: '', notes: '' })
      setEditError('')
      return
    }

    setEditForm({
      cableType: selectedLink.cableType ?? '',
      cableLength: selectedLink.cableLength ?? '',
      color: selectedLink.color ?? '',
      notes: selectedLink.notes ?? '',
    })
    setEditError('')
  }, [selectedLink])

  async function handleCreateCable() {
    setCreating(true)
    setCreateError('')
    try {
      const created = await createCable({
        fromPortId: createForm.fromPortId,
        toPortId: createForm.toPortId,
        cableType: createForm.cableType.trim() || undefined,
        cableLength: createForm.cableLength.trim() || undefined,
        color: createForm.color.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
      })
      setCreateForm(EMPTY_FORM)
      setSelectedLinkId(created.id)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create cable.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveCable() {
    if (!selectedLink) return

    setSaving(true)
    setEditError('')
    try {
      await updateCable(selectedLink.id, {
        cableType: editForm.cableType.trim() || undefined,
        cableLength: editForm.cableLength.trim() || undefined,
        color: editForm.color.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      })
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update cable.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCable(id: string) {
    setDeletingId(id)
    setEditError('')
    try {
      await deleteCable(id)
      setSelectedLinkId((current) => (current === id ? undefined : current))
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to delete cable.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <TopBar
        subtitle="Connections"
        title="Cables"
        meta={
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {portLinks.length} cables | {Object.keys(byType).length} types
          </span>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 xl:col-span-5">
            <CardHeader>
              <CardTitle>
                <CardLabel>Create</CardLabel>
                <CardHeading>Patch a new cable</CardHeading>
              </CardTitle>
              <Badge tone="cyan">{availablePorts.length} free ports</Badge>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="From port">
                  <Select
                    value={createForm.fromPortId}
                    onChange={(value) => setCreateForm((prev) => ({ ...prev, fromPortId: value }))}
                  >
                    <option value="">Select a port</option>
                    {availablePorts.map((port) => (
                      <option key={port.id} value={port.id}>
                        {portOptionLabel(port, deviceById)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="To port">
                  <Select
                    value={createForm.toPortId}
                    onChange={(value) => setCreateForm((prev) => ({ ...prev, toPortId: value }))}
                  >
                    <option value="">Select a port</option>
                    {availablePorts
                      .filter((port) => port.id !== createForm.fromPortId)
                      .map((port) => (
                        <option key={port.id} value={port.id}>
                          {portOptionLabel(port, deviceById)}
                        </option>
                      ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Cable type">
                  <Input
                    value={createForm.cableType}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, cableType: e.target.value }))}
                    placeholder="Cat6a, DAC, OM4..."
                  />
                </Field>
