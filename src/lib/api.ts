import type {
  AuditEntry,
  Device,
  DhcpScope,
  IpAssignment,
  IpZone,
  Port,
  PortLink,
  Rack,
  Subnet,
  Vlan,
  VlanRange,
} from './types'

const API_BASE = '/api'

type QueryValue = string | number | boolean | undefined | null
type Nullable<T> = {
  [K in keyof T]?: T[K] | null
}

export type DevicePatch = Nullable<Omit<Device, 'id' | 'labId'>>
export type IpAssignmentPatch = Nullable<Omit<IpAssignment, 'id'>>
export type VlanPatch = Nullable<Omit<Vlan, 'id' | 'labId'>>
export type PortPatch = Nullable<Omit<Port, 'id' | 'deviceId' | 'position'>>
export type PortLinkPatch = Nullable<Omit<PortLink, 'id' | 'fromPortId' | 'toPortId'>>

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return `${url.pathname}${url.search}`
}

async function request<T>(path: string, init?: RequestInit, query?: Record<string, QueryValue>): Promise<T> {
  const res = await fetch(buildUrl(path, query), {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const body = await res.json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Keep the generic message if the response isn't JSON.
    }
    throw new Error(message)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export const api = {
  getRacks(params?: { labId?: string }) {
    return request<Rack[]>('/racks', undefined, params)
  },

  getDevices(params?: { rackId?: string; labId?: string }) {
    return request<Device[]>('/devices', undefined, params)
  },

  getPorts(params?: { deviceId?: string }) {
    return request<Port[]>('/ports', undefined, params)
  },

  getPortLinks() {
    return request<PortLink[]>('/port-links')
  },

  getVlans(params?: { labId?: string }) {
    return request<Vlan[]>('/vlans', undefined, params)
  },

  getVlanRanges(params?: { labId?: string }) {
    return request<VlanRange[]>('/vlans/ranges', undefined, params)
  },

  getSubnets(params?: { labId?: string }) {
    return request<Subnet[]>('/subnets', undefined, params)
  },

  getDhcpScopes(params?: { subnetId?: string }) {
    return request<DhcpScope[]>('/dhcp-scopes', undefined, params)
  },

  getIpZones(params?: { subnetId?: string }) {
    return request<IpZone[]>('/ip-zones', undefined, params)
  },

  getIpAssignments(params?: { subnetId?: string; deviceId?: string }) {
    return request<IpAssignment[]>('/ip-assignments', undefined, params)
  },

  getAuditLog(params?: { entityId?: string; entityType?: string; limit?: number }) {
    return request<AuditEntry[]>('/audit-log', undefined, params)
  },

  updatePort(id: string, body: PortPatch) {
    return request<Port>(`/ports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  createPortLink(body: Omit<PortLink, 'id'> & { id?: string }) {
    return request<PortLink>('/port-links', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  updatePortLink(id: string, body: PortLinkPatch) {
    return request<PortLink>(`/port-links/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  deletePortLink(id: string) {
    return request<void>(`/port-links/${id}`, {
      method: 'DELETE',
    })
  },

  createDevice(body: Omit<Device, 'id'> & { id?: string }) {
    return request<Device>('/devices', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  updateDevice(id: string, body: DevicePatch) {
    return request<Device>(`/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  deleteDevice(id: string) {
    return request<void>(`/devices/${id}`, {
      method: 'DELETE',
    })
  },

  createVlan(body: Omit<Vlan, 'id'> & { id?: string }) {
    return request<Vlan>('/vlans', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  updateVlan(id: string, body: VlanPatch) {
    return request<Vlan>(`/vlans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  deleteVlan(id: string) {
    return request<void>(`/vlans/${id}`, {
      method: 'DELETE',
    })
  },

  createIpAssignment(body: Omit<IpAssignment, 'id'> & { id?: string }) {
    return request<IpAssignment>('/ip-assignments', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  updateIpAssignment(id: string, body: IpAssignmentPatch) {
    return request<IpAssignment>(`/ip-assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  deleteIpAssignment(id: string) {
    return request<void>(`/ip-assignments/${id}`, {
      method: 'DELETE',
    })
  },

  createAuditEntry(body: Omit<AuditEntry, 'id' | 'ts'> & { id?: string; ts?: string }) {
    return request<AuditEntry>('/audit-log', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
}
