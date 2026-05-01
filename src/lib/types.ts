// Rackpad domain types
// These mirror what the Prisma schema will be later. Keeping them strict here
// means the GUI is implicitly speccing the backend.

export type ID = string

export type DeviceType =
  | 'switch'
  | 'router'
  | 'firewall'
  | 'server'
  | 'patch_panel'
  | 'storage'
  | 'pdu'
  | 'ups'
  | 'kvm'
  | 'other'

export type PortKind =
  | 'rj45'
  | 'sfp'
  | 'sfp_plus'
  | 'qsfp'
  | 'fiber'
  | 'power'
  | 'console'
  | 'usb'

export type RackFace = 'front' | 'rear'

export type LinkState = 'up' | 'down' | 'disabled' | 'unknown'

export type DeviceStatus = 'online' | 'offline' | 'warning' | 'unknown' | 'maintenance'

export type IpAssignmentType =
  | 'device'
  | 'interface'
  | 'vm'
  | 'container'
  | 'reserved'
  | 'infrastructure'

// ----- Lab / Rack -----

export interface Lab {
  id: ID
  name: string
  description?: string
  location?: string
}

export interface Rack {
  id: ID
  labId: ID
  name: string
  totalU: number
  description?: string
  location?: string
  notes?: string
}

// ----- Device -----

export interface Device {
  id: ID
  labId: ID
  rackId?: ID
  hostname: string
  displayName?: string
  deviceType: DeviceType
  manufacturer?: string
  model?: string
  serial?: string
  managementIp?: string
  status: DeviceStatus
  // Rack placement
  startU?: number          // bottom-most U (U1 at the bottom of the rack)
  heightU?: number         // device height in U
  face?: RackFace
  // Misc
  tags?: string[]
  notes?: string
  lastSeen?: string        // ISO date
}

// ----- Port -----

export interface Port {
  id: ID
  deviceId: ID
  name: string             // "1", "1/1/1", "eth0", "mgmt", etc
  position: number         // ordering on device face
  kind: PortKind
  speed?: string           // "1G", "10G", "40G", "100G"
  linkState: LinkState
  vlanId?: ID
  description?: string
  face?: RackFace
}

// ----- Cable / Link between ports -----

export interface PortLink {
  id: ID
  fromPortId: ID
  toPortId: ID
  cableType?: string       // "Cat6", "Cat6a", "DAC", "OM4 LC-LC"
  cableLength?: string     // "0.5m", "1m", "3m"
  color?: string           // "yellow", "blue" — physical cable jacket color
  notes?: string
}

// ----- IPAM -----

export interface Subnet {
  id: ID
  labId: ID
  cidr: string             // "10.0.10.0/24"
  name: string
  description?: string
  vlanId?: ID
}

export interface DhcpScope {
  id: ID
  subnetId: ID
  name: string
  startIp: string
  endIp: string
  gateway?: string
  dnsServers?: string[]
  description?: string
}

export interface IpAssignment {
  id: ID
  subnetId: ID
  ipAddress: string
  assignmentType: IpAssignmentType
  deviceId?: ID
  portId?: ID
  vmId?: ID
  containerId?: ID
  hostname?: string
  description?: string
}

// ----- VLAN -----

export interface Vlan {
  id: ID
  labId: ID
  vlanId: number           // 1-4094
  name: string
  description?: string
  color?: string
}

// VLAN ID range — documents how the 1-4094 ID space is sliced
// e.g. "IoT 20-29", "DMZ 30-39"
export interface VlanRange {
  id: ID
  labId: ID
  name: string             // "IoT", "DMZ", "Servers"
  startVlan: number        // 1-4094
  endVlan: number          // inclusive
  purpose?: string         // free text
  color?: string
}

// IP zone — documents how a subnet is sliced into static / DHCP / reserved bands
// e.g. ".10-.99 static", ".100-.199 DHCP", ".200-.250 reserved"
export type IpZoneKind = 'static' | 'dhcp' | 'reserved' | 'infrastructure'

export interface IpZone {
  id: ID
  subnetId: ID
  kind: IpZoneKind
  startIp: string          // inclusive
  endIp: string            // inclusive
  description?: string
}

// ----- Audit -----

export interface AuditEntry {
  id: ID
  ts: string               // ISO date
  user: string
  action: string           // "device.create", "ip.assign", etc
  entityType: string
  entityId: ID
  summary: string
}

// ----- Aggregate types for UI convenience -----

export interface DeviceWithPorts extends Device {
  ports: Port[]
}

export interface RackOccupant {
  device: Device
  startU: number
  heightU: number
}
