import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader, CardHeading, CardLabel, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Mono } from '@/components/shared/Mono'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { VlanRangeBar } from '@/components/vlan/VlanRangeBar'
import { IpZoneBar } from '@/components/vlan/IpZoneBar'
import { AllocatePanel } from '@/components/shared/AllocatePanel'
import {
  canEditInventory,
  createVlanRangeRecord,
  deleteVlan,
  deleteVlanRangeRecord,
  updateVlanRangeRecord,
  useStore,
} from '@/lib/store'
import { ChevronRight, Hash, Plus, Save, Trash2 } from 'lucide-react'

type RangeForm = {
  name: string
  startVlan: string
  endVlan: string
  purpose: string
  color: string
}

const EMPTY_RANGE_FORM: RangeForm = {
  name: '',
  startVlan: '',
  endVlan: '',
  purpose: '',
  color: '',
}

export default function VlansView() {
  const currentUser = useStore((s) => s.currentUser)
  const ranges = useStore((s) => s.vlanRanges)
  const vlans = useStore((s) => s.vlans)
  const subnets = useStore((s) => s.subnets)
  const zones = useStore((s) => s.ipZones)
  const scopes = useStore((s) => s.scopes)
  const ipAssignments = useStore((s) => s.ipAssignments)
  const canEdit = canEditInventory(currentUser)

  const [selectedRangeId, setSelectedRangeId] = useState<string | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [creatingRange, setCreatingRange] = useState(false)
  const [rangeForm, setRangeForm] = useState<RangeForm>(EMPTY_RANGE_FORM)
  const [rangeSaving, setRangeSaving] = useState(false)
  const [rangeDeleting, setRangeDeleting] = useState(false)
  const [rangeError, setRangeError] = useState('')

  useEffect(() => {
    if (!ranges.length) return
    if (!selectedRangeId || !ranges.some((range) => range.id === selectedRangeId)) {
      setSelectedRangeId(ranges[0].id)
    }
  }, [ranges, selectedRangeId])

  const selectedRange = selectedRangeId
    ? ranges.find((range) => range.id === selectedRangeId)
    : undefined

  useEffect(() => {
    if (creatingRange) {
      setRangeForm(EMPTY_RANGE_FORM)
      setRangeError('')
      return
    }
    if (!selectedRange) return
    setRangeForm({
      name: selectedRange.name,
      startVlan: String(selectedRange.startVlan),
      endVlan: String(selectedRange.endVlan),
      purpose: selectedRange.purpose ?? '',
      color: selectedRange.color ?? '',
    })
    setRangeError('')
  }, [creatingRange, selectedRange])

  const totalUsed = vlans.length
  const totalReserved = ranges.reduce((sum, range) => sum + (range.endVlan - range.startVlan + 1), 0)

  const filteredVlans = useMemo(() => {
    if (!selectedRangeId) return vlans
    const range = ranges.find((entry) => entry.id === selectedRangeId)
    if (!range) return vlans
    return vlans.filter((vlan) => vlan.vlanId >= range.startVlan && vlan.vlanId <= range.endVlan)
  }, [vlans, ranges, selectedRangeId])

  async function handleDeleteVlan(id: string, name: string, vlanId: number) {
    if (!window.confirm(`Delete VLAN ${vlanId} (${name})? Any linked subnet will become unassigned.`)) {
      return
    }

    setDeletingId(id)
    try {
      await deleteVlan(id)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSaveRange() {
    setRangeSaving(true)
    setRangeError('')
    try {
      if (creatingRange) {
        const created = await createVlanRangeRecord({
          labId: 'lab_home',
          name: rangeForm.name.trim(),
          startVlan: Number.parseInt(rangeForm.startVlan, 10),
          endVlan: Number.parseInt(rangeForm.endVlan, 10),
          purpose: rangeForm.purpose.trim() || undefined,
          color: rangeForm.color.trim() || undefined,
        })
        setSelectedRangeId(created.id)
        setCreatingRange(false)
        return
      }

      if (!selectedRange) return
      await updateVlanRangeRecord(selectedRange.id, {
        name: rangeForm.name.trim(),
        startVlan: Number.parseInt(rangeForm.startVlan, 10),
        endVlan: Number.parseInt(rangeForm.endVlan, 10),
        purpose: rangeForm.purpose.trim() || null,
        color: rangeForm.color.trim() || null,
      })
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Failed to save VLAN range.')
    } finally {
      setRangeSaving(false)
    }
  }

  async function handleDeleteRange() {
    if (!selectedRange) return
    if (!window.confirm(`Delete VLAN range ${selectedRange.name}?`)) return

    setRangeDeleting(true)
    setRangeError('')
    try {
      await deleteVlanRangeRecord(selectedRange.id)
      setSelectedRangeId(undefined)
      setCreatingRange(false)
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Failed to delete VLAN range.')
    } finally {
      setRangeDeleting(false)
    }
  }

  return (
    <>
      <TopBar
        subtitle="Layer 2 segmentation"
        title="VLANs"
        meta={
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {vlans.length} VLANs | {ranges.length} ranges | {totalReserved} IDs reserved
          </span>
        }
        actions={
          canEdit ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatingRange(true)
                  setRangeForm(EMPTY_RANGE_FORM)
                }}
              >
                <Plus className="size-3.5" />
                Add range
              </Button>
              <AllocatePanel defaultTab="vlan" defaultRangeId={selectedRangeId} />
            </>
          ) : undefined
        }
      />

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <Card>
          <CardHeader>
            <CardTitle>
              <CardLabel>Range allocation</CardLabel>
              <CardHeading>VLAN ID space | 1-4094</CardHeading>
            </CardTitle>
            <Mono className="text-[11px] text-[var(--color-fg-subtle)]">
              {totalUsed} / {totalReserved} used in reserved ranges
            </Mono>
          </CardHeader>
          <CardBody>
            <VlanRangeBar
              ranges={ranges}
              vlans={vlans}
              selectedRangeId={selectedRangeId}
              onSelectRange={(id) => {
                setSelectedRangeId(id === selectedRangeId ? undefined : id)
                setCreatingRange(false)
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <CardLabel>Documented ranges</CardLabel>
              <CardHeading>{ranges.length} ranges</CardHeading>
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] bg-[var(--color-bg-2)]">
                  <Th>Range</Th>
                  <Th>IDs</Th>
                  <Th>Used</Th>
                  <Th>Free</Th>
                  <Th>Purpose</Th>
                </tr>
              </thead>
              <tbody>
                {ranges.map((range) => {
                  const used = vlans.filter((vlan) => vlan.vlanId >= range.startVlan && vlan.vlanId <= range.endVlan).length
                  const total = range.endVlan - range.startVlan + 1
                  const free = total - used
                  const isActive = range.id === selectedRangeId && !creatingRange
                  return (
                    <tr
                      key={range.id}
                      onClick={() => {
                        setSelectedRangeId(isActive ? undefined : range.id)
                        setCreatingRange(false)
                      }}
                      className={`cursor-pointer border-b border-[var(--color-line)] transition-colors last:border-b-0 ${
                        isActive ? 'bg-[var(--color-surface)]' : 'hover:bg-[var(--color-surface)]/40'
                      }`}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-[1px]" style={{ backgroundColor: range.color }} />
                          <span className="font-medium text-[var(--color-fg)]">{range.name}</span>
                        </div>
                      </Td>
                      <Td>
                        <Mono className="text-[var(--color-fg-muted)]">
                          {range.startVlan}-{range.endVlan}
                        </Mono>
                      </Td>
                      <Td>
                        <Mono className="text-[var(--color-fg)]">{used}</Mono>
                      </Td>
                      <Td>
                        <Mono className="text-[var(--color-fg-subtle)]">{free}</Mono>
                      </Td>
                      <Td>
                        <span className="text-[11px] text-[var(--color-fg-subtle)]">{range.purpose ?? '-'}</span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>
                <CardLabel>{creatingRange ? 'New range' : 'Range editor'}</CardLabel>
                <CardHeading>{creatingRange ? 'Create VLAN range' : selectedRange ? `Edit ${selectedRange.name}` : 'Select a range'}</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {creatingRange || selectedRange ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Name">
                      <Input
                        value={rangeForm.name}
                        onChange={(event) => setRangeForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Servers"
                      />
                    </Field>
                    <Field label="Color">
                      <Input
                        value={rangeForm.color}
                        onChange={(event) => setRangeForm((prev) => ({ ...prev, color: event.target.value }))}
                        placeholder="#4f8cff"
                   