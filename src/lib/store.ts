import { useSyncExternalStore } from 'react'
import { api, ApiError, getAuthToken, setAuthToken } from './api'
import type {
  AppUser,
  AuditEntry,
  Device,
  DeviceMonitor,
  DhcpScope,
  IpAssignment,
  IpAssignmentType,
  IpZone,
  Lab,
  Port,
  PortLink,
  PortTemplate,
  Rack,
  RackFace,
  Subnet,
  UserRole,
  Vlan,
  VlanRange,
} from './types'
import type {
  DevicePatch,
  DhcpScopePatch,
  MonitorPatch,
  PortPatch,
  RackPatch,
  SubnetPatch,
  UserPatch,
  VlanRangePatch,
} from './api'
import { cidrSize, intToIp, ipToInt, nextFreeStaticIp, nextFreeVlanId } from './utils'

const DEFAULT_LAB: Lab = {
  id: 'lab_home',
  name: 'Home Lab',
  description: 'Primary homelab',
}

interface State {
  authReady: boolean
  authLoading: boolean
  authError: string | null
  needsBootstrap: boolean
  currentUser: AppUser | null
  authExpiresAt: string | null
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
  users: AppUser[]
  deviceMonitors: DeviceMonitor[]
  portTemplates: PortTemplate[]
}

const EMPTY_DATA = {
  racks: [] as Rack[],
  devices: [] as Device[],
  ports: [] as Port[],
  portLinks: [] as PortLink[],
  vlans: [] as Vlan[],
  vlanRanges: [] as VlanRange[],
  subnets: [] as Subnet[],
  scopes: [] as DhcpScope[],
  ipZones: [] as IpZone[],
  ipAssignments: [] as IpAssignment[],
  auditLog: [] as AuditEntry[],
  users: [] as AppUser[],
  deviceMonitors: [] as DeviceMonitor[],
  portTemplates: [] as PortTemplate[],
}

let state: State = {
  authReady: false,
  authLoading: false,
  authError: null,
  needsBootstrap: false,
  currentUser: null,
  authExpiresAt: null,
  loading: false,
  loaded: false,
  error: null,
  lab: DEFAULT_LAB,
  ...EMPTY_DATA,
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

function resetData(): Pick<State, keyof typeof EMPTY_DATA | 'loaded' | 'loading' | 'error'> {
  return {
    loading: false,
    loaded: false,
    error: null,
    ...EMPTY_DATA,
  }
}

function clearSessionState(authError: string | null = null) {
  setAuthToken(null)
  setState((prev) => ({
    ...prev,
    authReady: true,
    authLoading: false,
    authError,
    needsBootstrap: false,
    currentUser: null,
    authExpiresAt: null,
    ...resetData(),
  }))
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

function sortDevices(devices: Device[]) {
  return [...devices].sort((a, b) => a.hostname.localeCompare(b.hostname))
}

function sortPorts(ports: Port[]) {
  return [...ports].sort((a, b) => {
    const byDevice = a.deviceId.localeCompare(b.deviceId)
    return byDevice !== 0 ? byDevice : a.position - b.position
  })
}

function sortVlans(vlans: Vlan[]) {
  return [...vlans].sort((a, b) => a.vlanId - b.vlanId)
}

function sortVlanRanges(ranges: VlanRange[]) {
  return [...ranges].sort((a, b) => a.startVlan - b.startVlan)
}

function sortSubnets(subnets: Subnet[]) {
  return [...subnets].sort((a, b) => a.cidr.localeCompare(b.cidr))
}

function sortIpZones(zones: IpZone[]) {
  return [...zones].sort((a, b) => {
    const bySubnet = a.subnetId.localeCompare(b.subnetId)
    return bySubnet !== 0 ? bySubnet : ipToInt(a.startIp) - ipToInt(b.startIp)
  })
}

function sortScopes(scopes: DhcpScope[]) {
  return [...scopes].sort((a, b) => {
    const bySubnet = a.subnetId.localeCompare(b.subnetId)
    return bySubnet !== 0 ? bySubnet : a.name.localeCompare(b.name)
  })
}

function sortIpAssignments(assignments: IpAssignment[]) {
  return [...assignments].sort((a, b) => {
    const bySubnet = a.subnetId.localeCompare(b.subnetId)
    return bySubnet !== 0 ? bySubnet : ipToInt(a.ipAddress) - ipToInt(b.ipAddress)
  })
}

function sortAudit(entries: AuditEntry[]) {
  return [...entries].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
}

function sortUsers(users: AppUser[]) {
  return [...users].sort((a, b) => a.username.localeCompare(b.username))
}

function sortMonitors(monitors: DeviceMonitor[]) {
  return [...monitors].sort((a, b) => a.deviceId.localeCompare(b.deviceId))
}

function replaceById<T extends { id: string }>(items: T[], updated: T, sorter?: (value: T[]) => T[]) {
  const exists = items.some((item) => item.id === updated.id)
  const next = exists
    ? items.map((item) => (item.id === updated.id ? updated : item))
    : [...items, updated]
  return sorter ? sorter(next) : next
}

function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id)
}

function normalizeDeviceChanges(changes: Partial<Omit<Device, 'id' | 'labId'>>): DevicePatch {
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

function pushAuditEntry(entry: AuditEntry) {
  setState((prev) => ({
    ...prev,
    auditLog: sortAudit([entry, ...prev.auditLog]),
  }))
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

async function recordAudit(action: string, entityType: string, entityId: string, summary: string) {
  try {
    const audit = await api.createAuditEntry({
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
    existingAssignme