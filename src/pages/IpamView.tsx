import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle, CardLabel, CardHeading, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Mono } from '@/components/shared/Mono'
import { IpUtilizationBar } from '@/components/ip/IpUtilizationBar'
import { IpZoneBar } from '@/components/vlan/IpZoneBar'
import { AllocatePanel } from '@/components/shared/AllocatePanel'
import { unassignIp, useStore } from '@/lib/store'
import type { Device, IpAssignment, Vlan } from '@/lib/types'
import { Hash, Network } from 'lucide-react'
import { cidrSize } from '@/lib/utils'

const TYPE_LABELS: Record<IpAssignment['assignmentType'], string> = {
  device: 'Devices',
  interface: 'Interfaces',
  vm: 'VMs',
  container: 'Containers',
  reserved: 'Reservations',
  infrastructure: 'Infrastructure',
}

const VISIBLE_ASSIGNMENT_TYPES: IpAssignment['assignmentType'][] = [
  'device',
  'interface',
  'vm',
  'container',
  'reserved',
  'infrastructure',
]

export default function IpamView() {
  const subnets = useStore((s) => s.subnets)
  const vlans = useStore((s) => s.vlans)
  const devices = useStore((s) => s.devices)
  const allAssignments = useStore((s) => s.ipAssignments)
  const allScopes = useStore((s) => s.scopes)
  const allZones = useStore((s) => s.ipZones)
  const [subnetId, setSubnetId] = useState('')
  const [releasingId, setReleasingId] = useState<string | null>(null)

  useEffect(() => {
    if (!subnets.length) return
    if (!subnetId || !subnets.some((subnet) => subnet.id === subnetId)) {
      setSubnetId(subnets[0].id)
    }
  }, [subnetId, subnets])

  const vlanById = useMemo(() => {
    return vlans.reduce<Record<string, Vlan>>((acc, vlan) => {
      acc[vlan.id] = vlan
      return acc
    }, {})
  }, [vlans])

  const deviceById = useMemo(() => {
    return devices.reduce<Record<string, Device>>((acc, device) => {
      acc[device.id] = device
      return acc
    }, {})
  }, [devices])

  const subnet = subnets.find((entry) => entry.id === subnetId) ?? subnets[0]

  const assignments = useMemo(
    () => allAssignments.filter((assignment) => assignment.subnetId === subnet?.id),
    [allAssignments, subnet?.id],
  )
  const subnetScopes = useMemo(
    () => allScopes.filter((scope) => scope.subnetId === subnet?.id),
    [allScopes, subnet?.id],
  )
  const subnetZones = useMemo(
    () => allZones.filter((zone) => zone.subnetId === subnet?.id),
    [allZones, subnet?.id],
  )

  const ipsBySubnetId = useMemo(() => {
    return allAssignments.reduce<Record<string, IpAssignment[]>>((acc, assignment) => {
      ;(acc[assignment.subnetId] ??= []).push(assignment)
      return acc
    }, {})
  }, [allAssignments])

  const grouped = useMemo(() => {
    return assignments.reduce<Record<string, IpAssignment[]>>((acc, assignment) => {
      ;(acc[assignment.assignmentType] ??= []).push(assignment)
      return acc
    }, {})
  }, [assignments])

  if (!subnet) {
    return null
  }

  const vlan = subnet.vlanId ? vlanById[subnet.vlanId] : undefined

  async function handleUnassign(assignmentId: string) {
    setReleasingId(assignmentId)
    try {
      await unassignIp(assignmentId)
    } finally {
      setReleasingId(null)
    }
  }

  return (
    <>
      <TopBar
        subtitle="Address management"
        title="IPAM"
        meta={
          <>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              {subnets.length} subnets
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              | {vlans.length} VLANs
            </span>
          </>
        }
        actions={<AllocatePanel defaultTab="ip" defaultSubnetId={subnet.id} />}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-72 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-2)]/40">
          <div className="border-b border-[var(--color-line)] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              Subnets
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {subnets.map((entry) => {
              const isActive = entry.id === subnet.id
              const entryVlan = entry.vlanId ? vlanById[entry.vlanId] : undefined
              const ipCount = (ipsBySubnetId[entry.id] ?? []).length
              const total = cidrSize(entry.cidr) - 2
              const pct = Math.round((ipCount / Math.max(1, total)) * 100)
              return (
                <button
                  key={entry.id}
                  onClick={() => setSubnetId(entry.id)}
                  className={`w-full border-l-2 px-4 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'border-[var(--color-accent)] bg-[var(--color-surface)]'
                      : 'border-transparent hover:bg-[var(--color-surface)]/40'
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-2">
                    <Network className="size-3 text-[var(--color-fg-muted)]" />
                    <Mono className="text-xs text-[var(--color-fg)]">{entry.cidr}</Mono>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[11px] text-[var(--color-fg-subtle)]">{entry.name}</span>
                    {entryVlan && (
                      <span
                        className="rounded-[1px] px-1 font-mono text-[10px]"
                        style={{ backgroundColor: `${entryVlan.color}20`, color: entryVlan.color }}
                      >
                        VL{entryVlan.vlanId}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-0.5 overflow-hidden bg-[var(--color-bg)]">
                    <div className="h-full bg-[var(--color-accent)]" style={{ width: `${pct}%`, opacity: 0.7 }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                Subnet
              </div>
              <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight">
                <span className="font-mono">{subnet.cidr}</span>
                <span className="font-sans text-[var(--color-fg-muted)]">/</span>
                <span className="font-sans">{subnet.name}</span>
              </h2>
              {vlan && (
                <div className="mt-1 flex items-center gap-2">
                  <Hash className="size-3 text-[var(--color-fg-subtle)]" />
                  <span
                    className="rounded-[1px] px-1.5 py-0.5 font-mono text-[11px]"
                    style={{ backgroundColor: `${vlan.color}20`, color: vlan.color }}
                  >
                    VLAN {vlan.vlanId} - {vlan.name}
                  </span>
                  {vlan.description && (
                    <span className="text-[11px] text-[var(--color-fg-subtle)]">{vlan.description}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {subnetZones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <CardLabel>Layout</CardLabel>
                  <CardHeading>Zone allocation</CardHeading>
                </CardTitle>
              </CardHeader>
              <CardBody>
                <IpZoneBar subnet={subnet} zones={subnetZones} scopes={subnetScopes} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                <CardLabel>Allocation</CardLabel>
                <CardHeading>Address utilization</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <IpUtilizationBar subnet={subnet} assignments={assignments} />
            </CardBody>
          </Card>

          {subnetScopes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <CardLabel>DHCP</CardLabel>
                  <CardHeading>Scopes</CardHeading>
                </CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <div className="divide-y divide-[var(--color-line)]">
                  {subnetScopes.map((scope) => (
                    <div key={scope.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                          {scope.name}
                        </span>
                        <Mono className="text-[var(--color-fg-muted)]">
                          {scope.startIp} -&gt; {scope.endIp}
                        </Mono>
                      </div>
                      {scope.gateway && (
                        <div className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                          gw <span className="text-[var(--color-fg)]">{scope.gateway}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {VISIBLE_ASSIGNMENT_TYPES.map((type) => {
            const items = grouped[type]
            if (!items || items.length === 0) return null

            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle>
                    <CardLabel>{TYPE_LABELS[type]}</CardLabel>
                    <CardHeading>{items.length} assigned</CardHeading>
                  </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[var(--color-line)]">
                    {items
                      .sort((a, b) => a.ipAddress.localeCompare(b.ipAddress, undefined, { numeric: true }))
                      .map((assignment) => {
                        const device = assignment.deviceId ? deviceById[assignment.deviceId] : undefined
                        return (
                          <div
                            key={assignment.id}
                            className="grid grid-cols-12 items-center gap-3 px-4 py-2 transition-colors hover:bg-[var(--color-surface)]/40"
                          >
                            <Mono className="col-span-3 text-[var(--color-fg)]">{assignment.ipAddress}</Mono>
                            <div className="col-span-2 text-xs">{assignment.hostname ?? '-'}</div>
                            <div className="col-span-4 text-[11px] text-[var(--color-fg-subtle)]">
                              {device ? `${device.hostname} (${device.deviceType})` : assignment.description ?? '-'}
                            </div>
                            <div className="col-span-3 flex items-center justify-end gap-2">
                              <Badge tone={badgeTone(type)}>{type}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={releasingId === assignment.id}
                                onClick={() => void handleUnassign(assignment.id)}
                              >
                                {releasingId === assignment.id ? 'Releasing...' : 'Unassign'}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </div>
    </>
  )
}

function badgeTone(type: IpAssignment['assignmentType']) {
  switch (type) {
    case 'device':
      return 'cyan' as const
    case 'vm':
      return 'accent' as const
    case 'container':
      return 'info' as const
    case 'reserved':
      return 'warn' as const
    case 'infrastructure':
      return 'neutral' as const
    default:
      return 'neutral' as const
  }
}
