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
  PortTemplatePatch,
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

function sortPortTemplates(templates: PortTemplate[]) {
  return [...templates].sort((a, b) => {
    if (Boolean(a.builtIn) !== Boolean(b.builtIn)) {
      return a.builtIn ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
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
    next = removeById(next, syncResult.deletedId)
  }
  if (syncResult.upserted) {
    next = replaceById(next, syncResult.upserted, sortIpAssignments)
  }
  return next
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

let initPromise: Promise<void> | null = null
let dataLoadPromise: Promise<void> | null = null

export function canEditInventory(user: AppUser | null) {
  return !!user && user.role !== 'viewer'
}

export function isAdmin(user: AppUser | null) {
  return user?.role === 'admin'
}

export async function initializeApp(force = false): Promise<void> {
  if (initPromise && !force) return initPromise

  setState((prev) => ({
    ...prev,
    authLoading: true,
    authError: null,
  }))

  initPromise = (async () => {
    try {
      const status = await api.getAuthStatus()

      if (status.needsBootstrap) {
        setAuthToken(null)
        setState((prev) => ({
          ...prev,
          authReady: true,
          authLoading: false,
          authError: null,
          needsBootstrap: true,
          currentUser: null,
          authExpiresAt: null,
          ...resetData(),
        }))
        return
      }

      const token = getAuthToken()
      if (!token) {
        setState((prev) => ({
          ...prev,
          authReady: true,
          authLoading: false,
          authError: null,
          needsBootstrap: false,
          currentUser: null,
          authExpiresAt: null,
          ...resetData(),
        }))
        return
      }

      const session = await api.getCurrentSession()
      setState((prev) => ({
        ...prev,
        authReady: true,
        authLoading: false,
        authError: null,
        needsBootstrap: false,
        currentUser: session.user,
        authExpiresAt: session.expiresAt,
      }))

      await loadAll(true)
    } catch (error) {
      if (isUnauthorized(error)) {
        clearSessionState(null)
        return
      }

      const message = error instanceof Error ? error.message : 'Failed to initialize Rackpad.'
      setState((prev) => ({
        ...prev,
        authReady: true,
        authLoading: false,
        authError: message,
      }))
      throw error
    } finally {
      initPromise = null
    }
  })()

  return initPromise
}

async function applyAuthSession(session: { token: string; expiresAt: string; user: AppUser }) {
  setAuthToken(session.token)
  setState((prev) => ({
    ...prev,
    authReady: true,
    authLoading: false,
    authError: null,
    needsBootstrap: false,
    currentUser: session.user,
    authExpiresAt: session.expiresAt,
  }))
  await loadAll(true)
}

export async function bootstrapAdmin(input: {
  username: string
  displayName?: string
  password: string
  loadDemoData?: boolean
}): Promise<void> {
  setState((prev) => ({
    ...prev,
    authLoading: true,
    authError: null,
  }))

  try {
    const session = await api.bootstrap(input)
    await applyAuthSession(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create the initial account.'
    setState((prev) => ({
      ...prev,
      authLoading: false,
      authError: message,
    }))
    throw error
  }
}

export async function login(input: { username: string; password: string }): Promise<void> {
  setState((prev) => ({
    ...prev,
    authLoading: true,
    authError: null,
  }))

  try {
    const session = await api.login(input)
    await applyAuthSession(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sign in.'
    setState((prev) => ({
      ...prev,
      authLoading: false,
      authError: message,
    }))
    throw error
  }
}

export async function logout(): Promise<void> {
  try {
    await api.logout()
  } catch {
    // Best effort only.
  }
  clearSessionState(null)
}

export async function loadAll(force = false): Promise<void> {
  const currentUser = state.currentUser
  if (!currentUser) return
  if (dataLoadPromise && !force) return dataLoadPromise

  setState((prev) => ({
    ...prev,
    loading: true,
    error: null,
  }))

  dataLoadPromise = (async () => {
    try {
      const requests = {
        racks: api.getRacks(),
        devices: api.getDevices(),
        ports: api.getPorts(),
        portLinks: api.getPortLinks(),
        vlans: api.getVlans(),
        vlanRanges: api.getVlanRanges(),
        subnets: api.getSubnets(),
        scopes: api.getDhcpScopes(),
        ipZones: api.getIpZones(),
        ipAssignments: api.getIpAssignments(),
        auditLog: api.getAuditLog({ limit: 500 }),
        deviceMonitors: api.getDeviceMonitors(),
        portTemplates: api.getPortTemplates(),
        users: currentUser.role === 'admin' ? api.getUsers() : Promise.resolve([] as AppUser[]),
      }

      const requestEntries = Object.entries(requests) as Array<[keyof typeof requests, Promise<unknown>]>
      const settled = await Promise.allSettled(requestEntries.map(([, request]) => request))
      const unauthorized = settled.find(
        (result) => result.status === 'rejected' && isUnauthorized(result.reason),
      )

      if (unauthorized) {
        clearSessionState('Your session expired. Please sign in again.')
        return
      }

      const resolved = new Map<keyof typeof requests, unknown>()
      const failures: string[] = []

      settled.forEach((result, index) => {
        const [key] = requestEntries[index]
        if (result.status === 'fulfilled') {
          resolved.set(key, result.value)
          return
        }
        failures.push(key)
      })

      setState((prev) => ({
        ...prev,
        loading: false,
        loaded: true,
        error:
          failures.length > 0
            ? `Some data failed to load: ${failures.join(', ')}. Showing the data that did load.`
            : null,
        racks: resolved.has('racks') ? sortByName(resolved.get('racks') as Rack[]) : prev.racks,
        devices: resolved.has('devices') ? sortDevices(resolved.get('devices') as Device[]) : prev.devices,
        ports: resolved.has('ports') ? sortPorts(resolved.get('ports') as Port[]) : prev.ports,
        portLinks: resolved.has('portLinks') ? (resolved.get('portLinks') as PortLink[]) : prev.portLinks,
        vlans: resolved.has('vlans') ? sortVlans(resolved.get('vlans') as Vlan[]) : prev.vlans,
        vlanRanges: resolved.has('vlanRanges') ? sortVlanRanges(resolved.get('vlanRanges') as VlanRange[]) : prev.vlanRanges,
        subnets: resolved.has('subnets') ? sortSubnets(resolved.get('subnets') as Subnet[]) : prev.subnets,
        scopes: resolved.has('scopes') ? sortScopes(resolved.get('scopes') as DhcpScope[]) : prev.scopes,
        ipZones: resolved.has('ipZones') ? sortIpZones(resolved.get('ipZones') as IpZone[]) : prev.ipZones,
        ipAssignments: resolved.has('ipAssignments')
          ? sortIpAssignments(resolved.get('ipAssignments') as IpAssignment[])
          : prev.ipAssignments,
        auditLog: resolved.has('auditLog') ? sortAudit(resolved.get('auditLog') as AuditEntry[]) : prev.auditLog,
        deviceMonitors: resolved.has('deviceMonitors')
          ? sortMonitors(resolved.get('deviceMonitors') as DeviceMonitor[])
          : prev.deviceMonitors,
        portTemplates: resolved.has('portTemplates')
          ? sortPortTemplates(resolved.get('portTemplates') as PortTemplate[])
          : prev.portTemplates,
        users: resolved.has('users') ? sortUsers(resolved.get('users') as AppUser[]) : prev.users,
      }))
    } catch (error) {
      if (isUnauthorized(error)) {
        clearSessionState('Your session expired. Please sign in again.')
        return
      }

      const message = error instanceof Error ? error.message : 'Failed to load Rackpad data.'
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }))
      throw error
    } finally {
      dataLoadPromise = null
    }
  })()

  return dataLoadPromise
}

export async function refreshUsers(): Promise<void> {
  if (!state.currentUser || state.currentUser.role !== 'admin') return
  const users = await api.getUsers()
  setState((prev) => ({
    ...prev,
    users: sortUsers(users),
  }))
}

export async function downloadAdminBackup(): Promise<string> {
  const { blob, filename } = await api.downloadAdminBackup()
  const downloadName =
    filename ??
    `rackpad-backup-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}.json`
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = downloadName
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
  return downloadName
}

export async function restoreAdminBackupSnapshot(snapshot: unknown) {
  const result = await api.restoreAdminBackup(snapshot)
  clearSessionState(null)
  await initializeApp(true)
  return result
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
    state.ipAssignments
      .filter((assignment) => assignment.subnetId === subnetId)
      .map((assignment) => ipToInt(assignment.ipAddress)),
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

export async function createRackRecord(input: Omit<Rack, 'id'>): Promise<Rack> {
  const created = await api.createRack(input)
  setState((prev) => ({
    ...prev,
    racks: sortByName([...prev.racks, created]),
  }))
  void recordAudit('rack.create', 'Rack', created.id, `Added rack ${created.name}`)
  return created
}

export async function updateRackRecord(id: string, changes: RackPatch): Promise<Rack> {
  const updated = await api.updateRack(id, changes)
  setState((prev) => ({
    ...prev,
    racks: replaceById(prev.racks, updated, sortByName),
  }))
  void recordAudit('rack.update', 'Rack', id, `Updated rack ${updated.name}`)
  return updated
}

export async function deleteRackRecord(id: string): Promise<void> {
  const rack = state.racks.find((entry) => entry.id === id)
  await api.deleteRack(id)
  await loadAll(true)
  if (rack) {
    void recordAudit('rack.delete', 'Rack', id, `Deleted rack ${rack.name}`)
  }
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
    ports: replaceById(prev.ports, updated, sortPorts),
  }))

  void recordAudit(
    'port.update',
    'Port',
    id,
    `Updated port ${updated.name} on ${state.devices.find((device) => device.id === updated.deviceId)?.hostname ?? updated.deviceId}`,
  )

  return updated
}

export async function createPortRecord(input: Omit<Port, 'id'>): Promise<Port> {
  const created = await api.createPort(input)
  setState((prev) => ({
    ...prev,
    ports: sortPorts([...prev.ports, created]),
  }))
  void recordAudit(
    'port.create',
    'Port',
    created.id,
    `Added port ${created.name} on ${state.devices.find((device) => device.id === created.deviceId)?.hostname ?? created.deviceId}`,
  )
  return created
}

export async function deletePortRecord(id: string): Promise<void> {
  const port = state.ports.find((entry) => entry.id === id)
  await api.deletePort(id)
  await loadAll(true)
  if (port) {
    void recordAudit(
      'port.delete',
      'Port',
      id,
      `Deleted port ${port.name} from ${state.devices.find((device) => device.id === port.deviceId)?.hostname ?? port.deviceId}`,
    )
  }
}

export async function createPortTemplateRecord(
  input: Omit<PortTemplate, 'builtIn' | 'id'> & { id?: string },
): Promise<PortTemplate> {
  const created = await api.createPortTemplate(input)
  setState((prev) => ({
    ...prev,
    portTemplates: sortPortTemplates([...prev.portTemplates, created]),
  }))
  void recordAudit(
    'port.template.create',
    'PortTemplate',
    created.id,
    `Added port template ${created.name}`,
  )
  return created
}

export async function updatePortTemplateRecord(
  id: string,
  changes: PortTemplatePatch,
): Promise<PortTemplate> {
  const updated = await api.updatePortTemplate(id, changes)
  setState((prev) => ({
    ...prev,
    portTemplates: replaceById(prev.portTemplates, updated, sortPortTemplates),
  }))
  void recordAudit(
    'port.template.update',
    'PortTemplate',
    id,
    `Updated port template ${updated.name}`,
  )
  return updated
}

export async function deletePortTemplateRecord(id: string): Promise<void> {
  const existing = state.portTemplates.find((template) => template.id === id)
  await api.deletePortTemplate(id)
  setState((prev) => ({
    ...prev,
    portTemplates: removeById(prev.portTemplates, id),
  }))
  if (existing) {
    void recordAudit(
      'port.template.delete',
      'PortTemplate',
      id,
      `Deleted port template ${existing.name}`,
    )
  }
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
    portLinks: replaceById(prev.portLinks, created),
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
    portLinks: removeById(prev.portLinks, id),
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
    portLinks: replaceById(prev.portLinks, updated),
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
  portTemplateId?: string
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
    portTemplateId: input.portTemplateId,
  })

  let syncResult: { upserted?: IpAssignment; deletedId?: string } = {}

  try {
    syncResult = await syncDeviceManagementAssignment(created)
  } catch (error) {
    await api.deleteDevice(created.id)
    throw error
  }

  const createdPorts = await api.getPorts({ deviceId: created.id })

  setState((prev) => ({
    ...prev,
    devices: sortDevices([...prev.devices, created]),
    ports: sortPorts([...prev.ports, ...createdPorts]),
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
  changes: Partial<Omit<Device, 'id' | 'labId'>> & { portTemplateId?: string },
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
    portTemplateId: changes.portTemplateId ?? undefined,
  })
  const syncResult = await syncDeviceManagementAssignment(updated, existing.managementIp)

  let nextPorts = state.ports
  if (changes.portTemplateId) {
    const refreshedPorts = await api.getPorts({ deviceId: id })
    nextPorts = sortPorts([
      ...state.ports.filter((port) => port.deviceId !== id),
      ...refreshedPorts,
    ])
  }

  setState((prev) => ({
    ...prev,
    devices: replaceById(prev.devices, updated, sortDevices),
    ports: nextPorts,
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
    (assignment) =>
      assignment.deviceId === id ||
      (assignment.portId != null && devicePortIds.includes(assignment.portId)),
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
      (assignment) =>
        assignment.deviceId !== id &&
        (assignment.portId == null || !devicePortIds.includes(assignment.portId)),
    ),
    deviceMonitors: prev.deviceMonitors.filter((monitor) => monitor.deviceId !== id),
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
    ipAssignments: replaceById(prev.ipAssignments, created, sortIpAssignments),
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
    devices: updatedDevice ? replaceById(prev.devices, updatedDevice, sortDevices) : prev.devices,
    ipAssignments: removeById(prev.ipAssignments, id),
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

export async function createVlanRangeRecord(input: Omit<VlanRange, 'id'>): Promise<VlanRange> {
  const created = await api.createVlanRange(input)
  setState((prev) => ({
    ...prev,
    vlanRanges: sortVlanRanges([...prev.vlanRanges, created]),
  }))
  void recordAudit('vlan.range.create', 'VlanRange', created.id, `Added VLAN range ${created.name}`)
  return created
}

export async function updateVlanRangeRecord(id: string, changes: VlanRangePatch): Promise<VlanRange> {
  const updated = await api.updateVlanRange(id, changes)
  setState((prev) => ({
    ...prev,
    vlanRanges: replaceById(prev.vlanRanges, updated, sortVlanRanges),
  }))
  void recordAudit('vlan.range.update', 'VlanRange', id, `Updated VLAN range ${updated.name}`)
  return updated
}

export async function deleteVlanRangeRecord(id: string): Promise<void> {
  const range = state.vlanRanges.find((entry) => entry.id === id)
  await api.deleteVlanRange(id)
  setState((prev) => ({
    ...prev,
    vlanRanges: removeById(prev.vlanRanges, id),
  }))
  if (range) {
    void recordAudit('vlan.range.delete', 'VlanRange', id, `Deleted VLAN range ${range.name}`)
  }
}

export async function createSubnetRecord(input: Omit<Subnet, 'id'>): Promise<Subnet> {
  const created = await api.createSubnet(input)
  setState((prev) => ({
    ...prev,
    subnets: sortSubnets([...prev.subnets, created]),
  }))
  void recordAudit('subnet.create', 'Subnet', created.id, `Added subnet ${created.cidr} (${created.name})`)
  return created
}

export async function updateSubnetRecord(id: string, changes: SubnetPatch): Promise<Subnet> {
  const updated = await api.updateSubnet(id, changes)
  setState((prev) => ({
    ...prev,
    subnets: replaceById(prev.subnets, updated, sortSubnets),
  }))
  void recordAudit('subnet.update', 'Subnet', id, `Updated subnet ${updated.cidr}`)
  return updated
}

export async function deleteSubnetRecord(id: string): Promise<void> {
  const subnet = state.subnets.find((entry) => entry.id === id)
  await api.deleteSubnet(id)
  await loadAll(true)
  if (subnet) {
    void recordAudit('subnet.delete', 'Subnet', id, `Deleted subnet ${subnet.cidr}`)
  }
}

export async function createDhcpScopeRecord(input: Omit<DhcpScope, 'id'>): Promise<DhcpScope> {
  const created = await api.createDhcpScope(input)
  setState((prev) => ({
    ...prev,
    scopes: sortScopes([...prev.scopes, created]),
  }))
  void recordAudit('dhcp.scope.create', 'DhcpScope', created.id, `Added DHCP scope ${created.name}`)
  return created
}

export async function updateDhcpScopeRecord(id: string, changes: DhcpScopePatch): Promise<DhcpScope> {
  const updated = await api.updateDhcpScope(id, changes)
  setState((prev) => ({
    ...prev,
    scopes: replaceById(prev.scopes, updated, sortScopes),
  }))
  void recordAudit('dhcp.scope.update', 'DhcpScope', id, `Updated DHCP scope ${updated.name}`)
  return updated
}

export async function deleteDhcpScopeRecord(id: string): Promise<void> {
  const scope = state.scopes.find((entry) => entry.id === id)
  await api.deleteDhcpScope(id)
  setState((prev) => ({
    ...prev,
    scopes: removeById(prev.scopes, id),
  }))
  if (scope) {
    void recordAudit('dhcp.scope.delete', 'DhcpScope', id, `Deleted DHCP scope ${scope.name}`)
  }
}

export async function createIpZoneRecord(input: Omit<IpZone, 'id'>): Promise<IpZone> {
  const created = await api.createIpZone(input)
  setState((prev) => ({
    ...prev,
    ipZones: sortIpZones([...prev.ipZones, created]),
  }))
  void recordAudit('ip.zone.create', 'IpZone', created.id, `Added ${created.kind} zone ${created.startIp}-${created.endIp}`)
  return created
}

export async function updateIpZoneRecord(id: string, changes: {
  kind?: IpZone['kind']
  startIp?: string
  endIp?: string
  description?: string
}): Promise<IpZone> {
  const updated = await api.updateIpZone(id, changes)
  setState((prev) => ({
    ...prev,
    ipZones: replaceById(prev.ipZones, updated, sortIpZones),
  }))
  void recordAudit('ip.zone.update', 'IpZone', id, `Updated ${updated.kind} zone ${updated.startIp}-${updated.endIp}`)
  return updated
}

export async function deleteIpZoneRecord(id: string): Promise<void> {
  const zone = state.ipZones.find((entry) => entry.id === id)
  await api.deleteIpZone(id)
  setState((prev) => ({
    ...prev,
    ipZones: removeById(prev.ipZones, id),
  }))
  if (zone) {
    void recordAudit('ip.zone.delete', 'IpZone', id, `Deleted ${zone.kind} zone ${zone.startIp}-${zone.endIp}`)
  }
}

export async function createUserAccount(input: {
  username: string
  displayName?: string
  password: string
  role: UserRole
  disabled?: boolean
}): Promise<AppUser> {
  const created = await api.createUser(input)
  setState((prev) => ({
    ...prev,
    users: sortUsers([...prev.users, created]),
  }))
  void recordAudit('user.create', 'User', created.id, `Added user ${created.username}`)
  return created
}

export async function updateUserAccount(id: string, changes: UserPatch): Promise<AppUser> {
  const updated = await api.updateUser(id, changes)
  setState((prev) => ({
    ...prev,
    users: replaceById(prev.users, updated, sortUsers),
    currentUser: prev.currentUser?.id === id ? updated : prev.currentUser,
  }))
  void recordAudit('user.update', 'User', id, `Updated user ${updated.username}`)
  return updated
}

export async function deleteUserAccount(id: string): Promise<void> {
  const user = state.users.find((entry) => entry.id === id)
  await api.deleteUser(id)
  setState((prev) => ({
    ...prev,
    users: removeById(prev.users, id),
  }))
  if (user) {
    void recordAudit('user.delete', 'User', id, `Deleted user ${user.username}`)
  }
}

export async function saveDeviceMonitorConfig(deviceId: string, changes: MonitorPatch): Promise<DeviceMonitor> {
  const updated = await api.saveDeviceMonitor(deviceId, changes)
  setState((prev) => ({
    ...prev,
    deviceMonitors: replaceById(prev.deviceMonitors, updated, sortMonitors),
  }))
  void recordAudit('monitor.update', 'DeviceMonitor', updated.id, `Updated monitor for ${state.devices.find((device) => device.id === deviceId)?.hostname ?? deviceId}`)
  return updated
}

export async function runDeviceMonitorCheck(deviceId: string): Promise<DeviceMonitor> {
  const [monitor, device] = await Promise.all([
    api.runDeviceMonitor(deviceId),
    api.getDevice(deviceId),
  ])

  setState((prev) => ({
    ...prev,
    deviceMonitors: replaceById(prev.deviceMonitors, monitor, sortMonitors),
    devices: replaceById(prev.devices, device, sortDevices),
  }))

  return monitor
}

export async function runAllDeviceMonitorChecks(): Promise<void> {
  await api.runAllDeviceMonitors()
  await loadAll(true)
}
