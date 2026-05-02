/**
 * Seed the database with the homelab mock dataset.
 * Only runs if the labs table is empty — safe to call on every startup.
 */
import { db } from './db.js'

// ── Seed data (mirrors src/lib/mock-data.ts) ──────────────────

const now = Date.now()

const lab = {
  id: 'lab_home',
  name: 'Home Lab',
  description: 'Primary homelab in the basement closet.',
  location: 'Basement / NW closet',
}

const racks = [
  { id: 'rack_net', labId: 'lab_home', name: 'NET-01', totalU: 24, description: 'Network rack. Switching, firewall, controllers.', location: 'Wall-mount, eye-level', notes: null },
  { id: 'rack_cmp', labId: 'lab_home', name: 'CMP-01', totalU: 42, description: 'Compute rack. Hypervisors, storage, GPU host.', location: 'Floor-standing', notes: null },
]

const devices = [
  { id: 'd_pp24',      labId: 'lab_home', rackId: 'rack_net', hostname: 'pp-01',       displayName: 'Patch Panel A',       deviceType: 'patch_panel', manufacturer: 'TRENDnet',    model: 'TC-P24C6',           serial: 'TN-PP-2901',   managementIp: null,          status: 'online',      startU: 24, heightU: 1, face: 'front', tags: JSON.stringify(['cat6', 'unmanaged']),              notes: null, lastSeen: null },
  { id: 'd_sw_tor',    labId: 'lab_home', rackId: 'rack_net', hostname: 'sw-tor-01',   displayName: 'Top-of-Rack Switch',  deviceType: 'switch',      manufacturer: 'Ubiquiti',    model: 'USW-Pro-48-PoE',     serial: 'F8C0:7A10:21B4', managementIp: '10.0.10.2', status: 'online',      startU: 23, heightU: 1, face: 'front', tags: JSON.stringify(['poe', 'core']),                    notes: null, lastSeen: new Date(now - 30_000).toISOString() },
  { id: 'd_sw_agg',    labId: 'lab_home', rackId: 'rack_net', hostname: 'sw-agg-01',   displayName: 'Aggregation Switch',  deviceType: 'switch',      manufacturer: 'Ubiquiti',    model: 'USW-Pro-Aggregation', serial: 'F8C0:7A10:33A1', managementIp: '10.0.10.3', status: 'online',      startU: 22, heightU: 1, face: 'front', tags: JSON.stringify(['10g', 'core']),                    notes: null, lastSeen: new Date(now - 45_000).toISOString() },
  { id: 'd_fw',        labId: 'lab_home', rackId: 'rack_net', hostname: 'fw-01',        displayName: 'Edge Firewall',       deviceType: 'firewall',    manufacturer: 'Protectli',   model: 'VP4670',             serial: 'PT-VP-4711',   managementIp: '10.0.10.1', status: 'online',      startU: 21, heightU: 1, face: 'front', tags: JSON.stringify(['pfsense', 'edge']),                notes: null, lastSeen: new Date(now - 15_000).toISOString() },
  { id: 'd_unifi',     labId: 'lab_home', rackId: 'rack_net', hostname: 'unifi-01',     displayName: 'UniFi Cloud Key',     deviceType: 'server',      manufacturer: 'Ubiquiti',    model: 'UCK-G2-PLUS',        serial: null,           managementIp: '10.0.10.4', status: 'warning',     startU: 20, heightU: 1, face: 'front', tags: JSON.stringify(['controller']),                     notes: null, lastSeen: new Date(now - 600_000).toISOString() },
  { id: 'd_pdu_net',   labId: 'lab_home', rackId: 'rack_net', hostname: 'pdu-net-01',   displayName: 'Network PDU',         deviceType: 'pdu',         manufacturer: 'APC',         model: 'AP7900B',            serial: null,           managementIp: '10.0.10.250', status: 'online',    startU: 1,  heightU: 1, face: 'rear',  tags: JSON.stringify(['metered']),                        notes: null, lastSeen: null },
  { id: 'd_srv_pve1',  labId: 'lab_home', rackId: 'rack_cmp', hostname: 'pve-01',       displayName: 'Proxmox Node 1',      deviceType: 'server',      manufacturer: 'Supermicro',  model: 'SYS-5019D-FN8TP',   serial: 'SM-19D-A491',  managementIp: '10.0.10.11', status: 'online',     startU: 40, heightU: 1, face: 'front', tags: JSON.stringify(['hypervisor', 'xeon-d']),           notes: null, lastSeen: new Date(now - 20_000).toISOString() },
  { id: 'd_srv_pve2',  labId: 'lab_home', rackId: 'rack_cmp', hostname: 'pve-02',       displayName: 'Proxmox Node 2',      deviceType: 'server',      manufacturer: 'Supermicro',  model: 'SYS-5019D-FN8TP',   serial: 'SM-19D-A492',  managementIp: '10.0.10.12', status: 'online',     startU: 39, heightU: 1, face: 'front', tags: JSON.stringify(['hypervisor', 'xeon-d']),           notes: null, lastSeen: new Date(now - 25_000).toISOString() },
  { id: 'd_srv_pve3',  labId: 'lab_home', rackId: 'rack_cmp', hostname: 'pve-03',       displayName: 'Proxmox Node 3 (GPU)', deviceType: 'server',     manufacturer: 'Supermicro',  model: 'SYS-2029U-TN24R4T', serial: 'SM-29U-B112',  managementIp: '10.0.10.13', status: 'online',     startU: 36, heightU: 2, face: 'front', tags: JSON.stringify(['hypervisor', 'gpu', 'epyc']),      notes: null, lastSeen: new Date(now - 12_000).toISOString() },
  { id: 'd_srv_nas',   labId: 'lab_home', rackId: 'rack_cmp', hostname: 'truenas-01',   displayName: 'TrueNAS Storage',     deviceType: 'storage',     manufacturer: 'Custom',      model: '4U 24-Bay',          serial: null,           managementIp: '10.0.10.20', status: 'online',     startU: 30, heightU: 4, face: 'front', tags: JSON.stringify(['truenas', 'zfs', '24-bay']),       notes: null, lastSeen: new Date(now - 18_000).toISOString() },
  { id: 'd_srv_backup',labId: 'lab_home', rackId: 'rack_cmp', hostname: 'backup-01',    displayName: 'Backup Server',       deviceType: 'server',      manufacturer: 'HPE',         model: 'DL360 Gen10',        serial: null,           managementIp: '10.0.10.21', status: 'maintenance',startU: 28, heightU: 1, face: 'front', tags: JSON.stringify(['pbs']),                            notes: null, lastSeen: new Date(now - 86_400_000).toISOString() },
  { id: 'd_ups',       labId: 'lab_home', rackId: 'rack_cmp', hostname: 'ups-01',        displayName: 'Rack UPS',            deviceType: 'ups',         manufacturer: 'APC',         model: 'SMT2200RM2U',        serial: null,           managementIp: '10.0.10.251', status: 'online',    startU: 1,  heightU: 2, face: 'front', tags: JSON.stringify(['2200va']),                         notes: null, lastSeen: null },
  { id: 'd_pdu_cmp',   labId: 'lab_home', rackId: 'rack_cmp', hostname: 'pdu-cmp-01',   displayName: 'Compute PDU',         deviceType: 'pdu',         manufacturer: 'APC',         model: 'AP8941',             serial: null,           managementIp: '10.0.10.252', status: 'online',    startU: 42, heightU: 1, face: 'rear',  tags: JSON.stringify(['switched']),                       notes: null, lastSeen: null },
  { id: 'd_vm_gitea',  labId: 'lab_home', rackId: null,       hostname: 'gitea-01',     displayName: 'Gitea',               deviceType: 'vm',          manufacturer: 'Debian',      model: 'Bookworm VM',        serial: null,           managementIp: null,         status: 'online',      placement: 'virtual', parentDeviceId: 'd_srv_pve1', startU: null, heightU: null, face: null, tags: JSON.stringify(['git', 'dev']),                     notes: 'Hosted on pve-01', lastSeen: new Date(now - 90_000).toISOString(), cpuCores: 2,  memoryGb: 4,  storageGb: 120, specs: '2 vCPU | 4 GB RAM | 120 GB SSD' },
  { id: 'd_vm_ha',     labId: 'lab_home', rackId: null,       hostname: 'ha-01',        displayName: 'Home Assistant',      deviceType: 'vm',          manufacturer: 'Home Assistant', model: 'Appliance VM',    serial: null,           managementIp: null,         status: 'online',      placement: 'virtual', parentDeviceId: 'd_srv_pve1', startU: null, heightU: null, face: null, tags: JSON.stringify(['automation']),                    notes: 'Hosted on pve-01', lastSeen: new Date(now - 120_000).toISOString(), cpuCores: 4,  memoryGb: 8,  storageGb: 64,  specs: '4 vCPU | 8 GB RAM | 64 GB SSD' },
  { id: 'd_vm_plex',   labId: 'lab_home', rackId: null,       hostname: 'plex-01',      displayName: 'Plex',                deviceType: 'vm',          manufacturer: 'Ubuntu',      model: 'Media VM',           serial: null,           managementIp: null,         status: 'warning',     placement: 'virtual', parentDeviceId: 'd_srv_pve2', startU: null, heightU: null, face: null, tags: JSON.stringify(['media']),                         notes: 'Hosted on pve-02', lastSeen: new Date(now - 300_000).toISOString(), cpuCores: 8,  memoryGb: 16, storageGb: 250, specs: '8 vCPU | 16 GB RAM | 250 GB SSD' },
  { id: 'd_vm_next',   labId: 'lab_home', rackId: null,       hostname: 'nextcloud-01', displayName: 'Nextcloud',           deviceType: 'vm',          manufacturer: 'Ubuntu',      model: 'App VM',             serial: null,           managementIp: null,         status: 'online',      placement: 'virtual', parentDeviceId: 'd_srv_pve2', startU: null, heightU: null, face: null, tags: JSON.stringify(['files']),                         notes: 'Hosted on pve-02', lastSeen: new Date(now - 150_000).toISOString(), cpuCores: 4,  memoryGb: 8,  storageGb: 200, specs: '4 vCPU | 8 GB RAM | 200 GB SSD' },
  { id: 'd_vm_ollama', labId: 'lab_home', rackId: null,       hostname: 'ollama-01',    displayName: 'Ollama',              deviceType: 'vm',          manufacturer: 'Ubuntu',      model: 'GPU VM',             serial: null,           managementIp: null,         status: 'online',      placement: 'virtual', parentDeviceId: 'd_srv_pve3', startU: null, heightU: null, face: null, tags: JSON.stringify(['ai', 'gpu']),                     notes: 'Hosted on pve-03', lastSeen: new Date(now - 45_000).toISOString(), cpuCores: 16, memoryGb: 48, storageGb: 600, specs: '16 vCPU | 48 GB RAM | 600 GB SSD' },
]

const deviceCapacityById: Record<string, { cpuCores?: number; memoryGb?: number; storageGb?: number; specs?: string }> = {
  d_srv_pve1: { cpuCores: 8, memoryGb: 64, storageGb: 2000, specs: 'Xeon-D host | 8 cores | 64 GB RAM | 2 TB NVMe' },
  d_srv_pve2: { cpuCores: 8, memoryGb: 64, storageGb: 2000, specs: 'Xeon-D host | 8 cores | 64 GB RAM | 2 TB NVMe' },
  d_srv_pve3: { cpuCores: 32, memoryGb: 128, storageGb: 8000, specs: 'EPYC host | 32 cores | 128 GB RAM | 8 TB mixed SSD' },
  d_srv_backup: { cpuCores: 16, memoryGb: 64, storageGb: 12000, specs: 'Backup node | 16 cores | 64 GB RAM | 12 TB usable' },
  d_srv_nas: { cpuCores: 12, memoryGb: 128, storageGb: 96000, specs: '24-bay TrueNAS | 12 cores | 128 GB ECC | 96 TB raw' },
}

// Helper to generate ports compactly
function makePorts(
  deviceId: string,
  prefix: string,
  count: number,
  kind: string,
  speed: string,
  linkedPositions: number[],
  nameOverrides?: (pos: number) => string,
  vlanId?: string
) {
  const rows = []
  for (let i = 0; i < count; i++) {
    const pos = i + 1
    const name = nameOverrides ? nameOverrides(pos) : `${prefix}${pos}`
    rows.push({
      id: `p_${deviceId}_${pos}`,
      deviceId,
      name,
      position: pos,
      kind,
      speed,
      linkState: linkedPositions.includes(pos) ? 'up' : 'down',
      vlanId: vlanId ?? null,
      description: null,
      face: 'front',
    })
  }
  return rows
}

const ports = [
  // Patch panel — 24 cat6 ports (positions 49+ don't exist on a 24-port panel so just offset SFP by 48+1)
  ...makePorts('d_pp24', '', 24, 'rj45', '1G', [1, 2, 3, 4, 5, 8, 9, 12, 17, 22]),

  // ToR switch: 48 PoE RJ45 + 4 SFP+
  ...makePorts('d_sw_tor', '', 48, 'rj45', '1G', [1, 2, 3, 4, 5, 8, 9, 12, 17, 22, 23, 24, 25, 31, 33, 47, 48]),
  ...makePorts('d_sw_tor', 'SFP+', 4, 'sfp_plus', '10G', [1, 2], (pos) => `SFP+${pos}`).map((p, i) => ({ ...p, id: `p_d_sw_tor_${48 + i + 1}`, position: 48 + i + 1 })),

  // Aggregation switch: 28 SFP+
  ...makePorts('d_sw_agg', 'SFP+', 28, 'sfp_plus', '10G', [1, 2, 3, 4, 5, 6, 7, 8], (pos) => `SFP+${pos}`),

  // Firewall: 6 RJ45
  ...makePorts('d_fw', 'igb', 6, 'rj45', '1G', [1, 2, 3], (pos) => `igb${pos - 1}`),

  // Unifi: 1 RJ45
  ...makePorts('d_unifi', 'eth', 1, 'rj45', '1G', [1], () => 'eth0'),

  // PVE-01: 4 RJ45 + 2 SFP+
  ...makePorts('d_srv_pve1', 'eno', 4, 'rj45', '1G', [1, 2], (pos) => `eno${pos}`),
  ...makePorts('d_srv_pve1', 'enp', 2, 'sfp_plus', '10G', [1, 2], (pos) => `enp1s0f${pos - 1}`).map((p, i) => ({ ...p, id: `p_d_srv_pve1_${4 + i + 1}`, position: 4 + i + 1 })),

  // PVE-02: same as PVE-01
  ...makePorts('d_srv_pve2', 'eno', 4, 'rj45', '1G', [1, 2], (pos) => `eno${pos}`),
  ...makePorts('d_srv_pve2', 'enp', 2, 'sfp_plus', '10G', [1, 2], (pos) => `enp1s0f${pos - 1}`).map((p, i) => ({ ...p, id: `p_d_srv_pve2_${4 + i + 1}`, position: 4 + i + 1 })),

  // PVE-03: 2 RJ45 + 4 SFP+
  ...makePorts('d_srv_pve3', 'eno', 2, 'rj45', '1G', [1], (pos) => `eno${pos}`),
  ...makePorts('d_srv_pve3', 'enp', 4, 'sfp_plus', '10G', [1, 2, 3, 4], (pos) => `enp4s0f${pos - 1}`).map((p, i) => ({ ...p, id: `p_d_srv_pve3_${2 + i + 1}`, position: 2 + i + 1 })),

  // TrueNAS: 2 RJ45 + 2 SFP+
  ...makePorts('d_srv_nas', 'igb', 2, 'rj45', '1G', [1], (pos) => `igb${pos - 1}`),
  ...makePorts('d_srv_nas', 'ix', 2, 'sfp_plus', '10G', [1, 2], (pos) => `ix${pos - 1}`).map((p, i) => ({ ...p, id: `p_d_srv_nas_${2 + i + 1}`, position: 2 + i + 1 })),

  // Backup: 4 RJ45 (all down — forced offline)
  ...makePorts('d_srv_backup', 'eno', 4, 'rj45', '1G', [], (pos) => `eno${pos}`),
]

const portLinks = [
  { id: 'l_1',  fromPortId: 'p_d_pp24_1',       toPortId: 'p_d_sw_tor_1',  cableType: 'Cat6',     cableLength: '0.5m', color: 'blue',   notes: null },
  { id: 'l_2',  fromPortId: 'p_d_pp24_2',       toPortId: 'p_d_sw_tor_2',  cableType: 'Cat6',     cableLength: '0.5m', color: 'blue',   notes: null },
  { id: 'l_3',  fromPortId: 'p_d_pp24_3',       toPortId: 'p_d_sw_tor_3',  cableType: 'Cat6',     cableLength: '0.5m', color: 'blue',   notes: null },
  { id: 'l_4',  fromPortId: 'p_d_pp24_4',       toPortId: 'p_d_sw_tor_4',  cableType: 'Cat6',     cableLength: '0.5m', color: 'blue',   notes: null },
  { id: 'l_5',  fromPortId: 'p_d_pp24_5',       toPortId: 'p_d_sw_tor_5',  cableType: 'Cat6',     cableLength: '0.5m', color: 'blue',   notes: null },
  { id: 'l_6',  fromPortId: 'p_d_sw_tor_49',    toPortId: 'p_d_sw_agg_1',  cableType: 'DAC',      cableLength: '1m',   color: 'black',  notes: null },
  { id: 'l_7',  fromPortId: 'p_d_sw_tor_50',    toPortId: 'p_d_sw_agg_2',  cableType: 'DAC',      cableLength: '1m',   color: 'black',  notes: null },
  { id: 'l_8',  fromPortId: 'p_d_fw_1',         toPortId: 'p_d_sw_tor_47', cableType: 'Cat6',     cableLength: '1m',   color: 'red',    notes: null },
  { id: 'l_9',  fromPortId: 'p_d_fw_2',         toPortId: 'p_d_sw_tor_48', cableType: 'Cat6',     cableLength: '1m',   color: 'green',  notes: null },
  { id: 'l_10', fromPortId: 'p_d_unifi_1',      toPortId: 'p_d_sw_tor_24', cableType: 'Cat6',     cableLength: '0.5m', color: 'yellow', notes: null },
  { id: 'l_11', fromPortId: 'p_d_srv_pve1_5',   toPortId: 'p_d_sw_agg_3',  cableType: 'DAC',      cableLength: '3m',   color: 'black',  notes: null },
  { id: 'l_12', fromPortId: 'p_d_srv_pve1_6',   toPortId: 'p_d_sw_agg_4',  cableType: 'DAC',      cableLength: '3m',   color: 'black',  notes: null },
  { id: 'l_13', fromPortId: 'p_d_srv_pve2_5',   toPortId: 'p_d_sw_agg_5',  cableType: 'DAC',      cableLength: '3m',   color: 'black',  notes: null },
  { id: 'l_14', fromPortId: 'p_d_srv_pve2_6',   toPortId: 'p_d_sw_agg_6',  cableType: 'DAC',      cableLength: '3m',   color: 'black',  notes: null },
  { id: 'l_15', fromPortId: 'p_d_srv_pve3_3',   toPortId: 'p_d_sw_agg_7',  cableType: 'DAC',      cableLength: '3m',   color: 'black',  notes: null },
  { id: 'l_16', fromPortId: 'p_d_srv_pve3_4',   toPortId: 'p_d_sw_agg_8',  cableType: 'DAC',      cableLength: '3m',   color: 'black',  notes: null },
  { id: 'l_17', fromPortId: 'p_d_srv_nas_3',    toPortId: 'p_d_sw_tor_31', cableType: 'OM4 LC-LC', cableLength: '3m',  color: 'aqua',   notes: null },
  { id: 'l_18', fromPortId: 'p_d_srv_nas_4',    toPortId: 'p_d_sw_tor_33', cableType: 'OM4 LC-LC', cableLength: '3m',  color: 'aqua',   notes: null },
  { id: 'l_19', fromPortId: 'p_d_srv_pve1_1',   toPortId: 'p_d_sw_tor_25', cableType: 'Cat6',     cableLength: '3m',   color: 'gray',   notes: null },
  { id: 'l_20', fromPortId: 'p_d_srv_pve2_1',   toPortId: 'p_d_sw_tor_8',  cableType: 'Cat6',     cableLength: '3m',   color: 'gray',   notes: null },
]

const vlans = [
  { id: 'v_default', labId: 'lab_home', vlanId: 10, name: 'Default',  description: 'Mgmt + servers',           color: '#6a9bd4' },
  { id: 'v_iot',     labId: 'lab_home', vlanId: 20, name: 'IoT',      description: 'Smart home, cameras',      color: '#6abf69' },
  { id: 'v_dmz',     labId: 'lab_home', vlanId: 30, name: 'DMZ',      description: 'Public-facing services',   color: '#d46060' },
  { id: 'v_storage', labId: 'lab_home', vlanId: 40, name: 'Storage',  description: 'iSCSI, NFS, replication',  color: '#b574d4' },
  { id: 'v_guest',   labId: 'lab_home', vlanId: 50, name: 'Guest',    description: 'Guest WiFi',               color: '#d4a13c' },
]

const vlanRanges = [
  { id: 'vr_mgmt',    labId: 'lab_home', name: 'Management', startVlan: 1,   endVlan: 19,  purpose: 'Core infrastructure and management', color: '#6a9bd4' },
  { id: 'vr_iot',     labId: 'lab_home', name: 'IoT',        startVlan: 20,  endVlan: 29,  purpose: 'Smart home and IoT devices',         color: '#6abf69' },
  { id: 'vr_dmz',     labId: 'lab_home', name: 'DMZ',        startVlan: 30,  endVlan: 39,  purpose: 'Public-facing services',             color: '#d46060' },
  { id: 'vr_storage', labId: 'lab_home', name: 'Storage',    startVlan: 40,  endVlan: 49,  purpose: 'Storage traffic',                    color: '#b574d4' },
  { id: 'vr_user',    labId: 'lab_home', name: 'User',       startVlan: 50,  endVlan: 99,  purpose: 'Guest and user VLANs',               color: '#d4a13c' },
]

const subnets = [
  { id: 's_default', labId: 'lab_home', cidr: '10.0.10.0/24', name: 'Default / Mgmt', description: null, vlanId: 'v_default' },
  { id: 's_iot',     labId: 'lab_home', cidr: '10.0.20.0/24', name: 'IoT',            description: null, vlanId: 'v_iot' },
  { id: 's_dmz',     labId: 'lab_home', cidr: '10.0.30.0/24', name: 'DMZ',            description: null, vlanId: 'v_dmz' },
  { id: 's_storage', labId: 'lab_home', cidr: '10.0.40.0/24', name: 'Storage',        description: null, vlanId: 'v_storage' },
  { id: 's_guest',   labId: 'lab_home', cidr: '10.0.50.0/24', name: 'Guest',          description: null, vlanId: 'v_guest' },
]

const dhcpScopes = [
  { id: 'sc_default', subnetId: 's_default', name: 'default-pool', startIp: '10.0.10.100', endIp: '10.0.10.199', gateway: '10.0.10.1',  dnsServers: JSON.stringify(['10.0.10.1', '1.1.1.1']), description: null },
  { id: 'sc_iot',     subnetId: 's_iot',     name: 'iot-pool',     startIp: '10.0.20.100', endIp: '10.0.20.250', gateway: '10.0.20.1',  dnsServers: null, description: null },
  { id: 'sc_dmz',     subnetId: 's_dmz',     name: 'dmz-pool',     startIp: '10.0.30.100', endIp: '10.0.30.150', gateway: '10.0.30.1',  dnsServers: null, description: null },
]

const ipZones = [
  { id: 'iz_default_infra',   subnetId: 's_default', kind: 'infrastructure', startIp: '10.0.10.1',   endIp: '10.0.10.9',   description: 'Gateways and core infra' },
  { id: 'iz_default_static',  subnetId: 's_default', kind: 'static',         startIp: '10.0.10.10',  endIp: '10.0.10.99',  description: 'Static assignments' },
  { id: 'iz_default_dhcp',    subnetId: 's_default', kind: 'dhcp',           startIp: '10.0.10.100', endIp: '10.0.10.199', description: 'DHCP pool' },
  { id: 'iz_default_reserved',subnetId: 's_default', kind: 'reserved',       startIp: '10.0.10.200', endIp: '10.0.10.254', description: 'Reserved' },
]

const ipAssignments = [
  { id: 'ip_1',  subnetId: 's_default', ipAddress: '10.0.10.1',  assignmentType: 'device',    deviceId: 'd_fw',        portId: null, vmId: null, containerId: null, hostname: 'fw-01',          description: 'Edge firewall LAN' },
  { id: 'ip_2',  subnetId: 's_default', ipAddress: '10.0.10.2',  assignmentType: 'device',    deviceId: 'd_sw_tor',    portId: null, vmId: null, containerId: null, hostname: 'sw-tor-01',      description: null },
  { id: 'ip_3',  subnetId: 's_default', ipAddress: '10.0.10.3',  assignmentType: 'device',    deviceId: 'd_sw_agg',    portId: null, vmId: null, containerId: null, hostname: 'sw-agg-01',      description: null },
  { id: 'ip_4',  subnetId: 's_default', ipAddress: '10.0.10.4',  assignmentType: 'device',    deviceId: 'd_unifi',     portId: null, vmId: null, containerId: null, hostname: 'unifi-01',       description: null },
  { id: 'ip_5',  subnetId: 's_default', ipAddress: '10.0.10.11', assignmentType: 'device',    deviceId: 'd_srv_pve1',  portId: null, vmId: null, containerId: null, hostname: 'pve-01',         description: null },
  { id: 'ip_6',  subnetId: 's_default', ipAddress: '10.0.10.12', assignmentType: 'device',    deviceId: 'd_srv_pve2',  portId: null, vmId: null, containerId: null, hostname: 'pve-02',         description: null },
  { id: 'ip_7',  subnetId: 's_default', ipAddress: '10.0.10.13', assignmentType: 'device',    deviceId: 'd_srv_pve3',  portId: null, vmId: null, containerId: null, hostname: 'pve-03',         description: null },
  { id: 'ip_8',  subnetId: 's_default', ipAddress: '10.0.10.20', assignmentType: 'device',    deviceId: 'd_srv_nas',   portId: null, vmId: null, containerId: null, hostname: 'truenas-01',     description: null },
  { id: 'ip_9',  subnetId: 's_default', ipAddress: '10.0.10.21', assignmentType: 'device',    deviceId: 'd_srv_backup',portId: null, vmId: null, containerId: null, hostname: 'backup-01',      description: null },
  { id: 'ip_10', subnetId: 's_default', ipAddress: '10.0.10.250',assignmentType: 'device',    deviceId: 'd_pdu_net',   portId: null, vmId: null, containerId: null, hostname: 'pdu-net-01',     description: null },
  { id: 'ip_11', subnetId: 's_default', ipAddress: '10.0.10.251',assignmentType: 'device',    deviceId: 'd_ups',       portId: null, vmId: null, containerId: null, hostname: 'ups-01',         description: null },
  { id: 'ip_12', subnetId: 's_default', ipAddress: '10.0.10.252',assignmentType: 'device',    deviceId: 'd_pdu_cmp',   portId: null, vmId: null, containerId: null, hostname: 'pdu-cmp-01',     description: null },
  { id: 'ip_v1', subnetId: 's_default', ipAddress: '10.0.10.50', assignmentType: 'vm',        deviceId: null,          portId: null, vmId: 'vm_1', containerId: null, hostname: 'gitea',        description: 'Gitea on pve-01' },
  { id: 'ip_v2', subnetId: 's_default', ipAddress: '10.0.10.51', assignmentType: 'vm',        deviceId: null,          portId: null, vmId: 'vm_2', containerId: null, hostname: 'home-assistant',description: 'HA on pve-01' },
  { id: 'ip_v3', subnetId: 's_default', ipAddress: '10.0.10.52', assignmentType: 'vm',        deviceId: null,          portId: null, vmId: 'vm_3', containerId: null, hostname: 'plex',         description: 'Plex on pve-02' },
  { id: 'ip_v4', subnetId: 's_default', ipAddress: '10.0.10.53', assignmentType: 'vm',        deviceId: null,          portId: null, vmId: 'vm_4', containerId: null, hostname: 'nextcloud',    description: 'Nextcloud on pve-02' },
  { id: 'ip_v5', subnetId: 's_default', ipAddress: '10.0.10.54', assignmentType: 'vm',        deviceId: null,          portId: null, vmId: 'vm_5', containerId: null, hostname: 'ollama',       description: 'LLM host on pve-03' },
  { id: 'ip_c1', subnetId: 's_default', ipAddress: '10.0.10.70', assignmentType: 'container', deviceId: null,          portId: null, vmId: null, containerId: 'ct_1', hostname: 'pihole',       description: null },
  { id: 'ip_c2', subnetId: 's_default', ipAddress: '10.0.10.71', assignmentType: 'container', deviceId: null,          portId: null, vmId: null, containerId: 'ct_2', hostname: 'unbound',      description: null },
  { id: 'ip_c3', subnetId: 's_default', ipAddress: '10.0.10.72', assignmentType: 'container', deviceId: null,          portId: null, vmId: null, containerId: 'ct_3', hostname: 'wireguard',    description: null },
  { id: 'ip_r1', subnetId: 's_default', ipAddress: '10.0.10.5',  assignmentType: 'reserved',  deviceId: null,          portId: null, vmId: null, containerId: null, hostname: 'reserved',      description: 'Future controller' },
  { id: 'ip_r2', subnetId: 's_default', ipAddress: '10.0.10.6',  assignmentType: 'reserved',  deviceId: null,          portId: null, vmId: null, containerId: null, hostname: 'reserved',      description: null },
  { id: 'ip_i1', subnetId: 's_iot',     ipAddress: '10.0.20.10', assignmentType: 'device',    deviceId: null,          portId: null, vmId: null, containerId: null, hostname: 'cam-front-door', description: null },
  { id: 'ip_i2', subnetId: 's_iot',     ipAddress: '10.0.20.11', assignmentType: 'device',    deviceId: null,          portId: null, vmId: null, containerId: null, hostname: 'cam-back-yard',  description: null },
  { id: 'ip_i3', subnetId: 's_iot',     ipAddress: '10.0.20.12', assignmentType: 'device',    deviceId: null,          portId: null, vmId: null, containerId: null, hostname: 'thermostat',     description: null },
]

const auditLog = [
  { id: 'a1', ts: new Date(now - 3 * 60_000).toISOString(),         user: 'admin',  action: 'ip.assign',     entityType: 'IpAssignment', entityId: 'ip_v5',        summary: 'Assigned 10.0.10.54 to ollama (vm)' },
  { id: 'a2', ts: new Date(now - 12 * 60_000).toISOString(),        user: 'admin',  action: 'device.update', entityType: 'Device',       entityId: 'd_unifi',      summary: 'Marked unifi-01 status: warning' },
  { id: 'a3', ts: new Date(now - 47 * 60_000).toISOString(),        user: 'admin',  action: 'port.link',     entityType: 'PortLink',     entityId: 'l_18',         summary: 'Linked truenas-01:ix1 ↔ sw-tor-01:31' },
  { id: 'a4', ts: new Date(now - 2 * 3600_000).toISOString(),       user: 'editor', action: 'device.create', entityType: 'Device',       entityId: 'd_srv_pve3',   summary: 'Created pve-03 in CMP-01 U36-37' },
  { id: 'a5', ts: new Date(now - 4 * 3600_000).toISOString(),       user: 'admin',  action: 'subnet.create', entityType: 'Subnet',       entityId: 's_storage',    summary: 'Created subnet 10.0.40.0/24 (Storage)' },
  { id: 'a6', ts: new Date(now - 26 * 3600_000).toISOString(),      user: 'editor', action: 'device.move',   entityType: 'Device',       entityId: 'd_srv_backup', summary: 'Moved backup-01 to maintenance' },
]

// ── Insert ─────────────────────────────────────────────────────

export function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM labs').get() as { count: number }
  if (count > 0) return

  console.log('[rackpad] Seeding database with initial homelab data…')

  const insertLab = db.prepare('INSERT INTO labs VALUES (@id, @name, @description, @location)')
  const insertRack = db.prepare('INSERT INTO racks VALUES (@id, @labId, @name, @totalU, @description, @location, @notes)')
  const insertDevice = db.prepare(`
    INSERT INTO devices
      (id, labId, rackId, hostname, displayName, deviceType, manufacturer, model, serial, managementIp, status,
       startU, heightU, face, tags, notes, lastSeen, placement, parentDeviceId, cpuCores, memoryGb, storageGb, specs)
    VALUES
      (@id, @labId, @rackId, @hostname, @displayName, @deviceType, @manufacturer, @model, @serial, @managementIp, @status,
       @startU, @heightU, @face, @tags, @notes, @lastSeen, @placement, @parentDeviceId, @cpuCores, @memoryGb, @storageGb, @specs)
  `)
  const insertPort = db.prepare('INSERT INTO ports VALUES (@id, @deviceId, @name, @position, @kind, @speed, @linkState, @vlanId, @description, @face)')
  const insertVlan = db.prepare('INSERT INTO vlans VALUES (@id, @labId, @vlanId, @name, @description, @color)')
  const insertVlanRange = db.prepare('INSERT INTO vlanRanges VALUES (@id, @labId, @name, @startVlan, @endVlan, @purpose, @color)')
  const insertPortLink = db.prepare('INSERT INTO portLinks VALUES (@id, @fromPortId, @toPortId, @cableType, @cableLength, @color, @notes)')
  const insertSubnet = db.prepare('INSERT INTO subnets VALUES (@id, @labId, @cidr, @name, @description, @vlanId)')
  const insertDhcpScope = db.prepare('INSERT INTO dhcpScopes VALUES (@id, @subnetId, @name, @startIp, @endIp, @gateway, @dnsServers, @description)')
  const insertIpZone = db.prepare('INSERT INTO ipZones VALUES (@id, @subnetId, @kind, @startIp, @endIp, @description)')
  const insertIpAssignment = db.prepare('INSERT INTO ipAssignments VALUES (@id, @subnetId, @ipAddress, @assignmentType, @deviceId, @portId, @vmId, @containerId, @hostname, @description)')
  const insertAudit = db.prepare('INSERT INTO auditLog VALUES (@id, @ts, @user, @action, @entityType, @entityId, @summary)')

  // Wrap everything in a transaction so seed is atomic
  const seed = db.transaction(() => {
    insertLab.run(lab)
    for (const r of racks) insertRack.run(r)

    // VLANs must come before ports (foreign key vlanId)
    for (const v of vlans) insertVlan.run(v)
    for (const vr of vlanRanges) insertVlanRange.run(vr)

    for (const d of devices) {
      const capacity = deviceCapacityById[d.id] ?? {}
      insertDevice.run({
        ...d,
        placement: d.placement ?? (d.rackId ? 'rack' : d.deviceType === 'vm' ? 'virtual' : d.deviceType === 'ap' ? 'wireless' : 'room'),
        parentDeviceId: d.parentDeviceId ?? null,
        cpuCores: d.cpuCores ?? capacity.cpuCores ?? null,
        memoryGb: d.memoryGb ?? capacity.memoryGb ?? null,
        storageGb: d.storageGb ?? capacity.storageGb ?? null,
        specs: d.specs ?? capacity.specs ?? null,
      })
    }
    for (const p of ports) insertPort.run(p)
    for (const l of portLinks) insertPortLink.run(l)

    for (const s of subnets) insertSubnet.run(s)
    for (const sc of dhcpScopes) insertDhcpScope.run(sc)
    for (const iz of ipZones) insertIpZone.run(iz)
    for (const ip of ipAssignments) insertIpAssignment.run(ip)
    for (const a of auditLog) insertAudit.run(a)
  })

  seed()
  console.log('[rackpad] Seed complete.')
}

export function ensureDefaultLab() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM labs').get() as { count: number }
  if (count > 0) return

  db.prepare('INSERT INTO labs VALUES (@id, @name, @description, @location)').run({
    ...lab,
    description: 'Primary homelab workspace.',
    location: null,
  })
}
