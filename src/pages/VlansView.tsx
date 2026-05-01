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
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Start VLAN">
                      <Input
                        type="number"
                        min={1}
                        max={4094}
                        value={rangeForm.startVlan}
                        onChange={(event) => setRangeForm((prev) => ({ ...prev, startVlan: event.target.value }))}
                        placeholder="100"
                      />
                    </Field>
                    <Field label="End VLAN">
                      <Input
                        type="number"
                        min={1}
                        max={4094}
                        value={rangeForm.endVlan}
                        onChange={(event) => setRangeForm((prev) => ({ ...prev, endVlan: event.target.value }))}
                        placeholder="149"
                      />
                    </Field>
                  </div>
                  <Field label="Purpose">
                    <Input
                      value={rangeForm.purpose}
                      onChange={(event) => setRangeForm((prev) => ({ ...prev, purpose: event.target.value }))}
                      placeholder="Server LANs, storage, management"
                    />
                  </Field>

                  {rangeError && (
                    <div className="rounded-[var(--radius-sm)] border border-[var(--color-err)]/30 bg-[var(--color-err)]/10 px-3 py-2 text-sm text-[var(--color-err)]">
                      {rangeError}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCreatingRange(false)
                        setRangeError('')
                      }}
                    >
                      Cancel
                    </Button>
                    <div className="flex items-center gap-2">
                      {!creatingRange && selectedRange && (
                        <Button variant="destructive" size="sm" onClick={() => void handleDeleteRange()} disabled={rangeDeleting}>
                          <Trash2 className="size-3.5" />
                          {rangeDeleting ? 'Deleting...' : 'Delete range'}
                        </Button>
                      )}
                      <Button size="sm" onClick={() => void handleSaveRange()} disabled={rangeSaving}>
                        <Save className="size-3.5" />
                        {rangeSaving ? 'Saving...' : creatingRange ? 'Create range' : 'Save range'}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-[var(--color-fg-subtle)]">
                  Select a range from the table above or create a new one.
                </div>
              )}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <CardLabel>
                {selectedRangeId
                  ? `Filtered by ${ranges.find((range) => range.id === selectedRangeId)?.name}`
                  : 'All VLANs'}
              </CardLabel>
              <CardHeading>{filteredVlans.length} configured</CardHeading>
            </CardTitle>
            {selectedRangeId && (
              <button
                onClick={() => setSelectedRangeId(undefined)}
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
              >
                Clear filter
              </button>
            )}
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-[var(--color-line)]">
              {filteredVlans
                .sort((a, b) => a.vlanId - b.vlanId)
                .map((vlan) => {
                  const subnet = subnets.find((entry) => entry.vlanId === vlan.id)
                  const subnetZones = subnet ? zones.filter((zone) => zone.subnetId === subnet.id) : []
                  const subnetScopes = subnet ? scopes.filter((scope) => scope.subnetId === subnet.id) : []
                  const ipCount = subnet ? ipAssignments.filter((assignment) => assignment.subnetId === subnet.id).length : 0
                  return (
                    <div key={vlan.id} className="px-4 py-4">
                      <div className="mb-3 flex items-start gap-4">
                        <div
                          className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] border"
                          style={{
                            backgroundColor: `${vlan.color}15`,
                            borderColor: `${vlan.color}40`,
                          }}
                        >
                          <Mono className="text-sm font-semibold" style={{ color: vlan.color }}>
                            {vlan.vlanId}
                          </Mono>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--color-fg)]">{vlan.name}</h3>
                            <Hash className="size-3 text-[var(--color-fg-faint)]" />
                            <Mono className="text-[10px] text-[var(--color-fg-subtle)]">VLAN {vlan.vlanId}</Mono>
                          </div>
                          {vlan.description && (
                            <div className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">{vlan.description}</div>
                          )}
                          {subnet && (
                            <div className="mt-1.5 flex items-center gap-3">
                              <Mono className="text-[11px] text-[var(--color-fg-muted)]">{subnet.cidr}</Mono>
                              <span className="text-[10px] text-[var(--color-fg-faint)]">|</span>
                              <span className="text-[11px] text-[var(--color-fg-subtle)]">
                                {ipCount} addresses assigned
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {subnet && (
                            <Link
                              to="/ipam"
                              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:text-[var(--color-accent-strong)]"
                            >
                              IPAM
                              <ChevronRight className="size-3" />
                            </Link>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === vlan.id}
                              onClick={() => void handleDeleteVlan(vlan.id, vlan.name, vlan.vlanId)}
                            >
                              <Trash2 className="size-3.5" />
                              {deletingId === vlan.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          )}
                        </div>
                      </div>
                      {subnet && (subnetZones.length > 0 || subnetScopes.length > 0) && (
                        <div className="pl-16">
                          <IpZoneBar subnet={subnet} zones={subnetZones} scopes={subnetScopes} />
                        </div>
                      )}
                    </div>
                  )
                })}
              {filteredVlans.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                  No VLANs in this range yet.
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
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

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-3 py-1.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
      {children}
    </th>
  )
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-middle">{children}</td>
}
