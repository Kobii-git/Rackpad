import { useSyncExternalStore } from 'react'
import { api } from './api'
import type { DevicePatch, PortPatch } from './api'
import { cidrSize, intToIp, ipToInt, nextFreeStaticIp, nextFreeVlanId } from './utils'
import type {
  AuditEntry,
  Device,
  DhcpScope,
  IpAssignment,
  IpAssignmentType,
  IpZone,
  Lab,
  Port,
  PortLink,
  Rack,
  RackFace,
  Subnet,
  Vlan,
  VlanRange,
} from './types'

const DEFAULT_LAB: Lab = {
  id: 'lab_home',
  name: 'Home Lab',
  description: 'Primary homelab',
}

interface State {
  loading: boolean
  loaded: boolean
  error: string | null
  lab: Lab
  racks: Rack[]
  devices: Device[]
  ports: Port[]
  portLinks: PortLink[]
  vlans: Vlan[]
  vlanRanges: VlanRange[]
  subnets: Subnet[]
  scopes: DhcpScope[]
  ipZones: IpZone[]
  ipAssignments: IpAssignment[]
  auditLog: AuditEntry[]
}

let state: State = {
  loading: false,
  loaded: false,
  error: null,
  lab: DEFAULT_LAB,
  racks: [],
  devices: [],
  ports: [],
  portLinks: [],
  vlans: [],
  vlanRanges: [],
  subnets: [],
  scopes: [],
  ipZones: [],
  ipAssignments: [],
  auditLog: [],
}

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export const store = {
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  getState(): State {
    return state
  },
}

export function useStore<T>(selector: (snapshot: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(state),
    () => selector(state),
  )
}

function setState(next: State | ((prev: State) => State)) {
  state = typeof next === 'function' ? next(state) : next
  emit()
}

function pushAuditEntry(entry: AuditEntry) {
  setState((prev) => ({
    ...prev,
    auditLog: [entry, ...prev.auditLog],
  }))
}

function sortDevices(devices: Device[]) {
  return [...devices].sort((a, b) => a.hostname.localeCompare(b.hostname))
}

function sortPorts(ports: Port[]) {
  return [...ports].sort((a, b) => {
    const deviceCompare = a.deviceId.localeCompare(b.deviceId)
    return deviceCompare !== 0 ? deviceCompare : a.position - b.position
  })
}

function sortVlans(vlans: Vlan[]) {
  return [...vlans].sort((a, b) => a.vlanId - b.vlanId)
}

function sortIpAssignments(assignments: IpAssignment[]) {
  return [...assignments].sort((a, b) => ipToInt(a.ipAddress) - ipToInt(b.ipAddress))
}

function replaceDevice(devices: Device[], updated: Device) {
  return sortDevices(devices.map((device) => (device.id === updated.id ? updated : device)))
}

function replacePort(ports: Port[], updated: Port) {
  return sortPorts(ports.map((port) => (port.id === updated.id ? updated : port)))
}

function replacePortLink(portLinks: PortLink[], updated: PortLink) {
  const exists = portLinks.some((link) => link.id === updated.id)
  return exists
    ? portLinks.map((link) => (link.id === updated.id ? updated : link))
    : [...portLinks, updated]
}

function replaceIpAssignment(assignments: IpAssignment[], updated: IpAssignment) {
  const exists = assignments.some((assignment) => assignment.id === updated.id)
  return sortIpAssignments(
    exists
      ? assignments.map((assignment) => (assignment.id === updated.id ? updated : assignment))
      : [...assignments, updated],
  )
}

function removeIpAssignment(assignments: IpAssignment[], assignmentId: string) {
  return assignments.filter((assignment) => assignment.id !== assignmentId)
}

function removePortLink(portLinks: PortLink[], portLinkId: string) {
  return portLinks.filter((link) => link.id !== portLinkId)
}

function normalizeDeviceChanges(
  changes: Partial<Omit<Device, 'id' | 'labId'>>,
): DevicePatch {
  const patch: DevicePatch = {}
  const nullableKeys = [
    'rackId',
    'displayName',
    'manufacturer',
    'model',
    'serial',
    'managementIp',
    'startU',
    'heightU',
    'face',
    'tags',
    'notes',
    'lastSeen',
  ] as const
  const requiredKeys = ['hostname', 'deviceType', 'status'] as const

  for (const key of nullableKeys) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      ;(patch as Record<string, unknown>)[key] = changes[key] ?? null
    }
  }

  for (const key of requiredKeys) {
    if (Object.prototype.hasOwnProperty.call(changes, key) && changes[key] !== undefined) {
      ;(patch as Record<string, unknown>)[key] = changes[key]
    }
  }

  return patch
}

function isValidIpv4(ipAddress: string) {
  const octets = ipAddress.split('.')
  if (octets.length !== 4) return false
  return octets.every((octet) => {
    if (!/^\d+$/.test(octet)) return false
    const value = Number.parseInt(octet, 10)
    return value >= 0 && value <= 255
  })
}

function findSubnetForIp(ipAddress: string) {
  const ipValue = ipToInt(ipAddress)
  return state.subnets.find((subnet) => {
    const [networkAddress, prefixRaw] = subnet.cidr.split('/')
    const prefix = Number.parseInt(prefixRaw, 10)
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false
    const network = ipToInt(networkAddress)
    const broadcast = network + cidrSize(subnet.cidr) - 1
    return ipValue > network && ipValue < broadcast
  })
}

function validateManagementIp(
  managementIp: string | undefined,
  options: { existingAssignmentId?: string } = {},
) {
  const ipAddress = managementIp?.trim()
  if (!ipAddress) return null
  if (!isValidIpv4(ipAddress)) {
    throw new Error('Management IP must be a valid IPv4 address.')
  }

  const subnet = findSubnetForIp(ipAddress)
  if (!subnet) {
    throw new Error('Management IP must fall inside a documented subnet before it can be assigned.')
  }

  const conflict = state.ipAssignments.find(
    (assignment) =>
      assignment.subnetId === subnet.id &&
      assignment.ipAddress === ipAddress &&
      assignment.id !== options.existingAssignmentId,
  )
  if (conflict) {
    throw new Error(`IP ${ipAddress} is already assigned.`)
  }

  return { ipAddress, subnet }
}

function findManagementAssignment(
  deviceId: string,
  previousManagementIp?: string,
  nextManagementIp?: string,
) {
  const candidates = state.ipAssignments.filter(
    (assignment) => assignment.deviceId === deviceId && assignment.assignmentType === 'device',
  )

  return (
    (previousManagementIp
      ? candidates.find((assignment) => assignment.ipAddress === previousManagementIp)
      : undefined) ??
    (nextManagementIp
      ? candidates.find((assignment) => assignment.ipAddress === nextManagementIp)
      : undefined) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  )
}

async function recordAudit(
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
) {
  try {
    const audit = await api.createAuditEntry({
      user: 'admin',
      action,
      entityType,
      entityId,
      summary,
    })
    pushAuditEntry(audit)
  } catch (error) {
    console.error('Failed to write audit log entry', error)
  }
}

async function syncDeviceManagementAssignment(
  device: Device,
  previousManagementIp?: string,
): Promise<{ upserted?: IpAssignment; deletedId?: string }> {
  const existingAssignment = findManagementAssignment(
    device.id,
    previousManagementIp,
    device.managementIp,
  )
  const validated = validateManagementIp(device.managementIp, {
    existingAssignmentId: existingAssignment?.id,
  })

  if (!validated) {
    if (!existingAssignment) return {}
    await api.deleteIpAssignment(existingAssignment.id)
    return { deletedId: existingAssignment.id }
  }

  const payload = {
    subnetId: validated.subnet.id,
    ipAddress: validated.ipAddress,
    assignmentType: 'device' as const,
    deviceId: device.id,
    hostname: device.hostname,
    description: existingAssignment?.description ?? 'Management IP',
  }

  if (existingAssignment) {
    const updated = await api.updateIpAssignment(existingAssignment.id, payload)
    return { upserted: updated }
  }

  const created = await api.createIpAssignment(payload)
  return { upserted: created }
}

function applyAssignmentSync(
  assignments: IpAssignment[],
  syncResult: { upserted?: IpAssignment; deletedId?: string },
) {
  let next = assignments
  if (syncResult.deletedId) {
    next = removeIpAssignment(next, syncResult.deletedId)
  }
  if (syncResult.upserted) {
    next = replaceIpAssignment(next, syncResult.upserted)
  }
  return next
}

export function previewNextStaticIp(subnetId: string): string | null {
  const subnet = state.subnets.find((entry) => entry.id === subnetId)
  if (!subnet) return null

  const dhcpScopes = state.scopes.filter((scope) => scope.subnetId === subnetId)
  const subnetZones = state.ipZones.filter((zone) => zone.subnetId === subnetId)
  const staticZones = subnetZones
    .filter((zone) => zone.kind === 'static')
    .sort((a, b) => ipToInt(a.startIp) - ipToInt(b.startIp))
  const reservedZones = subnetZones.filter((zone) => zone.kind === 'reserved')
  const assignedSet = new Set(
    state.ipAssignments.filter((assignment) => assignment.subnetId === subnetId).map((assignment) => ipToInt(assignment.ipAddress)),
  )

  if (staticZones.length > 0) {
    for (const zone of staticZones) {
      const start = ipToInt(zone.startIp)
      const end = ipToInt(zone.endIp)
      for (let candidate = start; candidate <= end; candidate += 1) {
        if (!assignedSet.has(candidate)) {
          return intToIp(candidate)
        }
      }
    }
  }

  return nextFreeStaticIp(
    subnet.cidr,
    dhcpScopes,
    reservedZones,
    [...assignedSet].map(intToIp),
    {
      skipDhcp: true,
      skipReserved: false,
    },
  )
}

export function previewNextVlanId(rangeId: string): number | null {
  const range = state.vlanRanges.find((entry) => entry.id === rangeId)
  if (!range) return null
  return nextFreeVlanId(
    range.startVlan,
    range.endVlan,
    state.vlans.map((vlan) => vlan.vlanId),
  )
}

let loadPromise: Promise<void> | null = null

export async function loadAll(force = false): Promise<void> {
  if (loadPromise && !force) return loadPromise

  setState((prev) => ({
    ...prev,
    loading: true,
    error: null,
  }))

  loadPromise = (async () => {
    try {
      const [
        racks,
        devices,
        ports,
        portLinks,
        vlans,
        vlanRanges,
        subnets,
        scopes,
        ipZones,
        ipAssignments,
        auditLog,
      ] = await Promise.all([
        api.getRacks(),
        api.getDevices(),
        api.getPorts(),
        api.getPortLinks(),
        api.getVlans(),
        api.getVlanRanges(),
        api.getSubnets(),
        api.getDhcpScopes(),
        api.getIpZones(),
        api.getIpAssignments(),
        api.getAuditLog({ limit: 100 }),
      ])

      setState((prev) => ({
        ...prev,
        loading: false,
        loaded: true,
        error: null,
        racks,
        devices,
        ports,
        portLinks,
        vlans,
        vlanRanges,
        subnets,
        scopes,
        ipZones,
        ipAssignments,
        auditLog,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Rackpad data'
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }))
      throw error
    } finally {
      loadPromise = null
    }
  })()

  return loadPromise
}

export async function updatePort(
  id: string,
  changes: Partial<Omit<Port, 'id' | 'deviceId' | 'position'>>,
): Promise<Port | null> {
  const existing = state.ports.find((port) => port.id === id)
  if (!existing) return null

  const patch: PortPatch = {}
  const allowedKeys = ['name', 'kind', 'speed', 'linkState', 'vlanId', 'description', 'face'] as const
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      ;(patch as Record<string, unknown>)[key] = changes[key] ?? null
    }
  }

  const updated = await api.updatePort(id, patch)
  setState((prev) => ({
    ...prev,
    ports: replacePort(prev.ports, updated),
  }))

  void recordAudit(
    'port.update',
    'Port',
    id,
    `Updated port ${updated.name} on ${state.devices.find((device) => device.id === updated.deviceId)?.hostname ?? updated.deviceId}`,
  )

  return updated
}

export interface CreateCableInput {
  fromPortId: string
  toPortId: string
  cableType?: string
  cableLength?: string
  color?: string
  notes?: string
}

export async function createCable(input: CreateCableInput): Promise<PortLink> {
  const fromPort = state.ports.find((port) => port.id === input.fromPortId)
  const toPort = state.ports.find((port) => port.id === input.toPortId)

  if (!fromPort || !toPort) {
    throw new Error('Both cable endpoints must exist.')
  }
  if (fromPort.id === toPort.id) {
    throw new Error('A port cannot be connected to itself.')
  }
  if (state.portLinks.some((link) => [link.fromPortId, link.toPortId].includes(fromPort.id))) {
    throw new Error(`${fromPort.name} is already linked.`)
  }
  if (state.portLinks.some((link) => [link.fromPortId, link.toPortId].includes(toPort.id))) {
    throw new Error(`${toPort.name} is already linked.`)
  }

  const created = await api.createPortLink(input)

  setState((prev) => ({
    ...prev,
    portLinks: replacePortLink(prev.portLinks, created),
    ports: sortPorts(
      prev.ports.map((port) =>
        port.id === created.fromPortId || port.id === created.toPortId
          ? { ...port, linkState: 'up' }
          : port,
      ),
    ),
  }))

  const fromDevice = state.devices.find((device) => device.id === fromPort.deviceId)
  const toDevice = state.devices.find((device) => device.id === toPort.deviceId)

  void recordAudit(
    'port.link',
    'PortLink',
    created.id,
    `Linked ${fromDevice?.hostname ?? fromPort.deviceId}:${fromPort.name} to ${toDevice?.hostname ?? toPort.deviceId}:${toPort.name}`,
  )

  return created
}

export async function deleteCable(id: string): Promise<boolean> {
  const link = state.portLinks.find((entry) => entry.id === id)
  if (!link) return false

  const remainingLinks = state.portLinks.filter((entry) => entry.id !== id)
  await api.deletePortLink(id)

  setState((prev) => ({
    ...prev,
    portLinks: removePortLink(prev.portLinks, id),
    ports: sortPorts(
      prev.ports.map((port) => {
        if (port.id !== link.fromPortId && port.id !== link.toPortId) {
          return port
        }
        const stillLinked = remainingLinks.some(
          (entry) => entry.fromPortId === port.id || entry.toPortId === port.id,
        )
        return { ...port, linkState: stillLinked ? 'up' : 'down' }
      }),
    ),
  }))

  const fromPort = state.ports.find((port) => port.id === link.fromPortId)
  const toPort = state.ports.find((port) => port.id === link.toPortId)
  const fromDevice = fromPort ? state.devices.find((device) => device.id === fromPort.deviceId) : undefined
  const toDevice = toPort ? state.devices.find((device) => device.id === toPort.deviceId) : undefined

  void recordAudit(
    'port.unlink',
    'PortLink',
    id,
    `Removed cable ${fromDevice?.hostname ?? link.fromPortId}:${fromPort?.name ?? link.fromPortId} to ${toDevice?.hostname ?? link.toPortId}:${toPort?.name ?? link.toPortId}`,
  )

  return true
}

export async function updateCable(
  id: string,
  changes: Partial<Omit<PortLink, 'id' | 'fromPortId' | 'toPortId'>>,
): Promise<PortLink | null> {
  const existing = state.portLinks.find((link) => link.id === id)
  if (!existing) return null

  const patch: Record<string, unknown> = {}
  const allowedKeys = ['cableType', 'cableLength', 'color', 'notes'] as const
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      patch[key] = changes[key] ?? null
    }
  }

  const updated = await api.updatePortLink(id, patch)

  setState((prev) => ({
    ...prev,
    portLinks: replacePortLink(prev.portLinks, updated),
  }))

  const fromPort = state.ports.find((port) => port.id === updated.fromPortId)
  const toPort = state.ports.find((port) => port.id === updated.toPortId)
  const fromDevice = fromPort ? state.devices.find((device) => device.id === fromPort.deviceId) : undefined
  const toDevice = toPort ? state.devices.find((device) => device.id === toPort.deviceId) : undefined

  void recordAudit(
    'port.link.update',
    'PortLink',
    id,
    `Updated cable ${fromDevice?.hostname ?? updated.fromPortId}:${fromPort?.name ?? updated.fromPortId} to ${toDevice?.hostname ?? updated.toPortId}:${toPort?.name ?? updated.toPortId}`,
  )

  return updated
}

export interface CreateDeviceInput {
  hostname: string
  deviceType: Device['deviceType']
  displayName?: string
  manufacturer?: string
  model?: string
  serial?: string
  managementIp?: string
  status?: Device['status']
  rackId?: string
  startU?: number
  heightU?: number
  face?: RackFace
  tags?: string[]
  notes?: string
}

export async function createDevice(input: CreateDeviceInput): Promise<Device> {
  const trimmedHostname = input.hostname.trim()
  const trimmedManagementIp = input.managementIp?.trim() || undefined

  validateManagementIp(trimmedManagementIp)

  const created = await api.createDevice({
    labId: state.lab.id,
    hostname: trimmedHostname,
    deviceType: input.deviceType,
    displayName: input.displayName,
    manufacturer: input.manufacturer,
    model: input.model,
    serial: input.serial,
    managementIp: trimmedManagementIp,
    status: input.status ?? 'unknown',
    rackId: input.rackId,
    startU: input.startU,
    heightU: input.heightU ?? 1,
    face: input.face ?? 'front',
    tags: input.tags,
    notes: input.notes,
    lastSeen: new Date().toISOString(),
  })

  let syncResult: { upserted?: IpAssignment; deletedId?: string } = {}

  try {
    syncResult = await syncDeviceManagementAssignment(created)
  } catch (error) {
    await api.deleteDevice(created.id)
    throw error
  }

  setState((prev) => ({
    ...prev,
    devices: sortDevices([...prev.devices, created]),
    ipAssignments: applyAssignmentSync(prev.ipAssignments, syncResult),
  }))

  void recordAudit(
    'device.create',
    'Device',
    created.id,
    `Added device ${created.hostname} (${created.deviceType})`,
  )

  return created
}

export async function updateDevice(
  id: string,
  changes: Partial<Omit<Device, 'id' | 'labId'>>,
): Promise<Device | null> {
  const existing = state.devices.find((device) => device.id === id)
  if (!existing) return null

  const nextManagementIp =
    Object.prototype.hasOwnProperty.call(changes, 'managementIp')
      ? changes.managementIp?.trim() || undefined
      : existing.managementIp

  validateManagementIp(nextManagementIp, {
    existingAssignmentId: findManagementAssignment(id, existing.managementIp, nextManagementIp)?.id,
  })

  const updated = await api.updateDevice(id, {
    ...normalizeDeviceChanges(changes),
    managementIp:
      Object.prototype.hasOwnProperty.call(changes, 'managementIp') ? nextManagementIp ?? null : undefined,
  })
  const syncResult = await syncDeviceManagementAssignment(updated, existing.managementIp)

  setState((prev) => ({
    ...prev,
    devices: replaceDevice(prev.devices, updated),
    ipAssignments: applyAssignmentSync(prev.ipAssignments, syncResult),
  }))

  void recordAudit(
    'device.update',
    'Device',
    id,
    `Updated device ${updated.hostname}`,
  )

  return updated
}

export async function deleteDevice(id: string): Promise<boolean> {
  const device = state.devices.find((entry) => entry.id === id)
  if (!device) return false

  const devicePortIds = state.ports.filter((port) => port.deviceId === id).map((port) => port.id)
  const relatedAssignments = state.ipAssignments.filter(
    (assignment) => assignment.deviceId === id || (assignment.portId != null && devicePortIds.includes(assignment.portId)),
  )

  await Promise.all(relatedAssignments.map((assignment) => api.deleteIpAssignment(assignment.id)))
  await api.deleteDevice(id)

  setState((prev) => ({
    ...prev,
    devices: prev.devices.filter((entry) => entry.id !== id),
    ports: prev.ports.filter((port) => port.deviceId !== id),
    portLinks: prev.portLinks.filter(
      (link) => !devicePortIds.includes(link.fromPortId) && !devicePortIds.includes(link.toPortId),
    ),
    ipAssignments: prev.ipAssignments.filter(
      (assignment) => assignment.deviceId !== id && (assignment.portId == null || !devicePortIds.includes(assignment.portId)),
    ),
  }))

  void recordAudit(
    'device.delete',
    'Device',
    id,
    `Deleted device ${device.hostname}`,
  )

  return true
}

export interface AllocateIpInput {
  subnetId: string
  hostname: string
  description?: string
  assignmentType: IpAssignmentType
  deviceId?: string
}

export async function allocateIp(input: AllocateIpInput): Promise<IpAssignment | null> {
  const ipAddress = previewNextStaticIp(input.subnetId)
  if (!ipAddress) return null

  const subnet = state.subnets.find((entry) => entry.id === input.subnetId)
  const created = await api.createIpAssignment({
    subnetId: input.subnetId,
    ipAddress,
    assignmentType: input.assignmentType,
    deviceId: input.deviceId,
    hostname: input.hostname,
    description: input.description,
  })

  setState((prev) => ({
    ...prev,
    ipAssignments: replaceIpAssignment(prev.ipAssignments, created),
  }))

  void recordAudit(
    'ip.assign',
    'IpAssignment',
    created.id,
    `Assigned ${ipAddress} to ${input.hostname} (${input.assignmentType}) in ${subnet?.name ?? 'subnet'}`,
  )

  return created
}

export async function unassignIp(id: string): Promise<boolean> {
  const assignment = state.ipAssignments.find((entry) => entry.id === id)
  if (!assignment) return false

  const device = assignment.deviceId
    ? state.devices.find((entry) => entry.id === assignment.deviceId)
    : undefined

  let updatedDevice: Device | undefined
  if (device?.managementIp === assignment.ipAddress) {
    updatedDevice = await api.updateDevice(device.id, { managementIp: null })
  }

  await api.deleteIpAssignment(id)

  setState((prev) => ({
    ...prev,
    devices: updatedDevice ? replaceDevice(prev.devices, updatedDevice) : prev.devices,
    ipAssignments: removeIpAssignment(prev.ipAssignments, id),
  }))

  void recordAudit(
    'ip.release',
    'IpAssignment',
    id,
    `Released ${assignment.ipAddress}${assignment.hostname ? ` from ${assignment.hostname}` : ''}`,
  )

  return true
}

export interface AllocateVlanInput {
  rangeId: string
  name: string
  description?: string
  color?: string
}

export async function allocateVlan(input: AllocateVlanInput): Promise<Vlan | null> {
  const vlanId = previewNextVlanId(input.rangeId)
  if (vlanId == null) return null

  const range = state.vlanRanges.find((entry) => entry.id === input.rangeId)
  const created = await api.createVlan({
    labId: state.lab.id,
    vlanId,
    name: input.name,
    description: input.description,
    color: input.color ?? range?.color,
  })

  setState((prev) => ({
    ...prev,
    vlans: sortVlans([...prev.vlans, created]),
  }))

  void recordAudit(
    'vlan.create',
    'Vlan',
    created.id,
    `Created VLAN ${vlanId} (${input.name}) in ${range?.name ?? 'range'}`,
  )

  return created
}

export async function deleteVlan(id: string): Promise<boolean> {
  const vlan = state.vlans.find((entry) => entry.id === id)
  if (!vlan) return false

  await api.deleteVlan(id)

  setState((prev) => ({
    ...prev,
    vlans: prev.vlans.filter((entry) => entry.id !== id),
    ports: prev.ports.map((port) => (port.vlanId === id ? { ...port, vlanId: undefined } : port)),
    subnets: prev.subnets.map((subnet) => (subnet.vlanId === id ? { ...subnet, vlanId: undefined } : subnet)),
  }))

  void recordAudit(
    'vlan.delete',
    'Vlan',
    id,
    `Deleted VLAN ${vlan.vlanId} (${vlan.name})`,
  )

  return true
}
