import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle, CardLabel, CardHeading, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Mono } from '@/components/shared/Mono'
import { Badge } from '@/components/ui/Badge'
import { VlanRangeBar } from '@/components/vlan/VlanRangeBar'
import { IpZoneBar } from '@/components/vlan/IpZoneBar'
import { AllocatePanel } from '@/components/shared/AllocatePanel'
import { deleteVlan, useStore } from '@/lib/store'
import { ChevronRight, Hash, Trash2 } from 'lucide-react'

export default function VlansView() {
  const ranges = useStore((s) => s.vlanRanges)
  const vlans = useStore((s) => s.vlans)
  const subnets = useStore((s) => s.subnets)
  const zones = useStore((s) => s.ipZones)
  const scopes = useStore((s) => s.scopes)
  const ipAssignments = useStore((s) => s.ipAssignments)

  const [selectedRangeId, setSelectedRangeId] = useState<string | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalUsed = vlans.length
  const totalReserved = ranges.reduce((s, r) => s + (r.endVlan - r.startVlan + 1), 0)

  const filteredVlans = useMemo(() => {
    if (!selectedRangeId) return vlans
    const r = ranges.find((rg) => rg.id === selectedRangeId)
    if (!r) return vlans
    return vlans.filter((v) => v.vlanId >= r.startVlan && v.vlanId <= r.endVlan)
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

  return (
    <>
      <TopBar
        subtitle="Layer 2 segmentation"
        title="VLANs"
        meta={
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {vlans.length} VLANs · {ranges.length} ranges · {totalReserved} IDs reserved
          </span>
        }
        actions={
          <AllocatePanel defaultTab="vlan" defaultRangeId={selectedRangeId} />
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Range allocation map (Flavor A) */}
        <Card>
          <CardHeader>
            <CardTitle>
              <CardLabel>Range allocation</CardLabel>
              <CardHeading>VLAN ID space · 1–4094</CardHeading>
            </CardTitle>
            <Mono className="text-[var(--color-fg-subtle)] text-[11px]">
              {totalUsed} / {totalReserved} used in reserved ranges
            </Mono>
          </CardHeader>
          <CardBody>
            <VlanRangeBar
              ranges={ranges}
              vlans={vlans}
              selectedRangeId={selectedRangeId}
              onSelectRange={(id) =>
                setSelectedRangeId(id === selectedRangeId ? undefined : id)
              }
            />
          </CardBody>
        </Card>

        {/* Range table */}
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
                {ranges.map((r) => {
                  const used = vlans.filter((v) => v.vlanId >= r.startVlan && v.vlanId <= r.endVlan).length
                  const total = r.endVlan - r.startVlan + 1
                  const free = total - used
                  const isActive = r.id === selectedRangeId
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRangeId(isActive ? undefined : r.id)}
                      className={`border-b border-[var(--color-line)] last:border-b-0 cursor-pointer transition-colors ${
                        isActive ? 'bg-[var(--color-surface)]' : 'hover:bg-[var(--color-surface)]/40'
                      }`}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-[1px]"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="font-medium text-[var(--color-fg)]">{r.name}</span>
                        </div>
                      </Td>
                      <Td>
                        <Mono className="text-[var(--color-fg-muted)]">
                          {r.startVlan}–{r.endVlan}
                        </Mono>
                      </Td>
                      <Td>
                        <Mono className="text-[var(--color-fg)]">{used}</Mono>
                      </Td>
                      <Td>
                        <Mono className="text-[var(--color-fg-subtle)]">{free}</Mono>
                      </Td>
                      <Td>
                        <span className="text-[11px] text-[var(--color-fg-subtle)]">
                          {r.purpose ?? '—'}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        {/* VLAN detail list (Flavor B — per-VLAN with subnet zones) */}
        <Card>
          <CardHeader>
            <CardTitle>
              <CardLabel>
                {selectedRangeId
                  ? `Filtered by ${ranges.find((r) => r.id === selectedRangeId)?.name}`
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
                  const subnet = subnets.find((s) => s.vlanId === vlan.id)
                  const subnetZones = subnet ? zones.filter((z) => z.subnetId === subnet.id) : []
                  const subnetScopes = subnet ? scopes.filter((sc) => sc.subnetId === subnet.id) : []
                  const ipCount = subnet
                    ? ipAssignments.filter((a) => a.subnetId === subnet.id).length
                    : 0
                  return (
                    <div key={vlan.id} className="px-4 py-4">
                      <div className="flex items-start gap-4 mb-3">
                        <div
                          className="grid place-items-center size-12 shrink-0 rounded-[var(--radius-sm)] border"
                          style={{
                            backgroundColor: `${vlan.color}15`,
                            borderColor: `${vlan.color}40`,
                          }}
                        >
                          <Mono
                            className="text-sm font-semibold"
                            style={{ color: vlan.color }}
                          >
                            {vlan.vlanId}
                          </Mono>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                              {vlan.name}
                            </h3>
                            <Hash className="size-3 text-[var(--color-fg-faint)]" />
                            <Mono className="text-[10px] text-[var(--color-fg-subtle)]">
                              VLAN {vlan.vlanId}
                            </Mono>
                          </div>
                          {vlan.description && (
                            <div className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5">
                              {vlan.description}
                            </div>
                          )}
                          {subnet && (
                            <div className="flex items-center gap-3 mt-1.5">
                              <Mono className="text-[11px] text-[var(--color-fg-muted)]">
                                {subnet.cidr}
                              </Mono>
                              <span className="text-[10px] text-[var(--color-fg-faint)]">·</span>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deletingId === vlan.id}
                            onClick={() => void handleDeleteVlan(vlan.id, vlan.name, vlan.vlanId)}
                          >
                            <Trash2 className="size-3.5" />
                            {deletingId === vlan.id ? 'Deleting...' : 'Delete'}
                          </Button>
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

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-normal">
      {children}
    </th>
  )
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-middle">{children}</td>
}
