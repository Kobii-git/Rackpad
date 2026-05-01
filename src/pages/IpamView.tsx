import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader, CardHeading, CardLabel, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Mono } from '@/components/shared/Mono'
import { IpUtilizationBar } from '@/components/ip/IpUtilizationBar'
import { IpZoneBar } from '@/components/vlan/IpZoneBar'
import { AllocatePanel } from '@/components/shared/AllocatePanel'
import {
  canEditInventory,
  createDhcpScopeRecord,
  createIpZoneRecord,
  createSubnetRecord,
  deleteDhcpScopeRecord,
  deleteIpZoneRecord,
  deleteSubnetRecord,
  unassignIp,
  updateDhcpScopeRecord,
  updateIpZoneRecord,
  updateSubnetRecord,
  useStore,
} from '@/lib/store'
import type { Device, DhcpScope, IpAssignment, IpZone, Subnet, Vlan } from '@/lib/types'
import { Hash, Network, Plus, Save, Trash2 } from 'lucide-react'
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

type SubnetForm = {
  cidr: string
  name: string
  description: string
  vlanId: string
}

type ScopeForm = {
  name: string
  startIp: string
  endIp: string
  gateway: string
  dnsServers: string
  description: string
}

type ZoneForm = {
  kind: IpZone['kind']
  startIp: string
  endIp: string
  description: string
}

const EMPTY_SUBNET_FORM: SubnetForm = {
  cidr: '',
  name: '',
  description: '',
  vlanId: '',
}

const EMPTY_SCOPE_FORM: ScopeForm = {
  name: '',
  startIp: '',
  endIp: '',
  gateway: '',
  dnsServers: '',
  description: '',
}

const EMPTY_ZONE_FORM: ZoneForm = {
  kind: 'static',
  startIp: '',
  endIp: '',
  description: '',
}

export default function IpamView() {
  const currentUser = useStore((s) => s.currentUser)
  const subnets = useStore((s) => s.subnets)
  const vlans = useStore((s) => s.vlans)
  const devices = useStore((s) => s.devices)
  const allAssignments = useStore((s) => s.ipAssignments)
  const allScopes = useStore((s) => s.scopes)
  const allZones = useStore((s) => s.ipZones)
  const canEdit = canEditInventory(currentUser)

  const [subnetId, setSubnetId] = useState('')
  const [releasingId, setReleasingId] = useState<string | null>(null)

  const [creatingSubnet, setCreatingSubnet] = useState(false)
  const [subnetForm, setSubnetForm] = useState<SubnetForm>(EMPTY_SUBNET_FORM)
  const [subnetSaving, setSubnetSaving] = useState(false)
  const [subnetDeleting, setSubnetDeleting] = useState(false)
  const [subnetError, setSubnetError] = useState('')

  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null)
  const [creatingScope, setCreatingScope] = useState(false)
  const [scopeForm, setScopeForm] = useState<ScopeForm>(EMPTY_SCOPE_FORM)
  const [scopeSaving, setScopeSaving] = useState(false)
  const [scopeDeleting, setScopeDeleting] = useState(false)
  const [scopeError, setScopeError] = useState('')

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [creatingZone, setCreatingZone] = useState(false)
  const [zoneForm, setZoneForm] = useState<ZoneForm>(EMPTY_ZONE_FORM)
  const [zoneSaving, setZoneSaving] = useState(false)
  const [zoneDeleting, setZoneDeleting] = useState(false)
  const [zoneError, setZoneError] = useState('')

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

  useEffect(() => {
    if (!subnet || creatingSubnet) return
    setSubnetForm({
      cidr: subnet.cidr,
      name: subnet.name,
      description: subnet.description ?? '',
      vlanId: subnet.vlanId ?? '',
    })
    setSubnetError('')
  }, [creatingSubnet, subnet])

  useEffect(() => {
    if (!subnetScopes.length) {
      setSelectedScopeId(null)
      return
    }
    if (!selectedScopeId || !subnetScopes.some((scope) => scope.id === selectedScopeId)) {
      setSelectedScopeId(subnetScopes[0].id)
    }
  }, [selectedScopeId, subnetScopes])

  const selectedScope = selectedScopeId
    ? subnetScopes.find((scope) => scope.id === selectedScopeId)
    : undefined

  useEffect(() => {
    if (creatingScope) {
      setScopeForm(EMPTY_SCOPE_FORM)
      setScopeError('')
      return
    }
    if (!selectedScope) return
    setScopeForm({
      name: selectedScope.name,
      startIp: selectedScope.startIp,
      endIp: selectedScope.endIp,
      gateway: selectedScope.gateway ?? '',
      dnsServers: (selectedScope.dnsServers ?? []).join(', '),
      description: selectedScope.description ?? '',
    })
    setScopeError('')
  }, [creatingScope, selectedScope])

  useEffect(() => {
    if (!subnetZones.length) {
      setSelectedZoneId(null)
      return
    }
    if (!selectedZoneId || !subnetZones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(subnetZones[0].id)
    }
  }, [selectedZoneId, subnetZones])

  const selectedZone = selectedZoneId
    ? subnetZones.find((zone) => zone.id === selectedZoneId)
    : undefined

  useEffect(() => {
    if (creatingZone) {
      setZoneForm(EMPTY_ZONE_FORM)
      setZoneError('')
      return
    }
    if (!selectedZone) return
    setZoneForm({
      kind: selectedZone.kind,
      startIp: selectedZone.startIp,
      endIp: selectedZone.endIp,
      description: selectedZone.description ?? '',
    })
    setZoneError('')
  }, [creatingZone, selectedZone])

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

  if (!subnet && !creatingSubnet) {
    return (
      <>
        <TopBar
          subtitle="Address management"
          title="IPAM"
          actions={
            canEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatingSubnet(true)
                  setSubnetForm(EMPTY_SUBNET_FORM)
                }}
              >
                <Plus className="size-3.5" />
                Add subnet
              </Button>
            ) : undefined
          }
        />
        <div className="flex flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>
                <CardLabel>IPAM</CardLabel>
                <CardHeading>No subnets documented yet</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="text-sm text-[var(--color-fg-subtle)]">
                Create a subnet to start documenting IP allocations, DHCP scopes, and static zones.
              </div>
              {canEdit && (
                <SubnetEditor
                  creating={creatingSubnet}
                  form={subnetForm}
                  vlans={vlans}
                  error={subnetError}
                  saving={subnetSaving}
                  deleting={false}
                  canDelete={false}
                  onChange={setSubnetForm}
                  onSave={async () => {
                    setSubnetSaving(true)
                    setSubnetError('')
                    try {
                      const created = await createSubnetRecord({
                        labId: 'lab_home',
                        cidr: subnetForm.cidr.trim(),
                        name: subnetForm.name.trim(),
                        description: subnetForm.description.trim() || undefined,
                        vlanId: subnetForm.vlanId || undefined,
                      })
                      setSubnetId(created.id)
                      setCreatingSubnet(false)
                    } catch (err) {
                      setSubnetError(err instanceof Error ? err.message : 'Failed to create subnet.')
                    } finally {
                      setSubnetSaving(false)
                    }
                  }}
                  onDelete={async () => {}}
                  onNew={() => {
                    setCreatingSubnet(true)
                    setSubnetForm(EMPTY_SUBNET_FORM)
                  }}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </>
    )
  }

  const vlan = subnet?.vlanId ? vlanById[subnet.vlanId] : undefined

  async function handleUnassign(assignmentId: string) {
    setReleasingId(assignmentId)
    try {
      await unassignIp(assignmentId)
    } finally {
      setReleasingId(null)
    }
  }

  async function handleSaveSubnet() {
    if (!subnet) return
    setSubnetSaving(true)
    setSubnetError('')
    try {
      if (creatingSubnet) {
        const created = await createSubnetRecord({
          labId: 'lab_home',
          cidr: subnetForm.cidr.trim(),
          name: subnetForm.name.trim(),
          description: subnetForm.description.trim() || undefined,
          vlanId: subnetForm.vlanId || undefined,
        })
        setSubnetId(created.id)
        setCreatingSubnet(false)
        return
      }

      await updateSubnetRecord(subnet.id, {
        cidr: subnetForm.cidr.trim(),
        name: subnetForm.name.trim(),
        description: subnetForm.description.trim() || null,
        vlanId: subnetForm.vlanId || null,
      })
    } catch (err) {
      setSubnetError(err instanceof Error ? err.message : 'Failed to save subnet.')
    } finally {
      setSubnetSaving(false)
    }
  }

  async function handleDeleteSubnet() {
    if (!subnet) return
    if (!window.confirm(`Delete subnet ${subnet.cidr}? This also removes its scopes, zones, and assignments.`)) {
      return
    }
    setSubnetDeleting(true)
    setSubnetError('')
    try {
      await deleteSubnetRecord(subnet.id)
      setSubnetId('')
    } catch (err) {
