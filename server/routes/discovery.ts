import { execFile } from 'node:child_process'
import { reverse } from 'node:dns/promises'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { createId } from '../lib/ids.js'
import { runIcmpProbe } from '../lib/monitoring.js'
import {
  asObject,
  ensureCidr,
  ensureIsoDate,
  optionalEnum,
  optionalString,
  ValidationError,
} from '../lib/validation.js'

const DEVICE_TYPES = [
  'switch',
  'router',
  'firewall',
  'server',
  'ap',
  'endpoint',
  'vm',
  'patch_panel',
  'storage',
  'pdu',
  'ups',
  'kvm',
  'other',
] as const

const DEVICE_PLACEMENTS = ['rack', 'room', 'wireless', 'virtual'] as const
const DISCOVERY_STATUSES = ['new', 'imported', 'dismissed'] as const
const execFileAsync = promisify(execFile)
const OUI_VENDOR_MAP: Record<string, string> = {
  '24:a4:3c': 'Ubiquiti',
  '74:83:c2': 'Ubiquiti',
  'f4:92:bf': 'Ubiquiti',
  '00:1b:54': 'Cisco',
  '00:25:45': 'Cisco',
  '3c:ce:73': 'Cisco',
  'b8:27:eb': 'Raspberry Pi',
  'dc:a6:32': 'Raspberry Pi',
  'e4:5f:01': 'Raspberry Pi',
  '3c:fd:fe': 'Intel',
  'b0:08:75': 'Intel',
  'f0:18:98': 'Apple',
  '3c:22:fb': 'Apple',
  'd8:3a:dd': 'TP-Link',
  'f4:f2:6d': 'Aruba',
  '00:30:48': 'Supermicro',
}

function parseDiscoveredDevice(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    labId: String(row.labId),
    ipAddress: String(row.ipAddress),
    hostname: row.hostname ? String(row.hostname) : null,
    displayName: row.displayName ? String(row.displayName) : null,
    deviceType: row.deviceType ? String(row.deviceType) : null,
    placement: row.placement ? String(row.placement) : null,
    macAddress: row.macAddress ? String(row.macAddress) : null,
    vendor: row.vendor ? String(row.vendor) : null,
    source: String(row.source),
    status: String(row.status),
    notes: row.notes ? String(row.notes) : null,
    importedDeviceId: row.importedDeviceId ? String(row.importedDeviceId) : null,
    lastSeen: row.lastSeen ? String(row.lastSeen) : null,
    lastScannedAt: String(row.lastScannedAt),
  }
}

function ipToInt(ipAddress: string) {
  return ipAddress.split('.').reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>> 0
}

function intToIp(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join('.')
}

function cidrHosts(cidr: string) {
  ensureCidr(cidr)
  const [networkAddress, prefixRaw] = cidr.split('/')
  const prefix = Number.parseInt(prefixRaw, 10)
  const hostCount = Math.pow(2, 32 - prefix) - 2

  if (hostCount < 1) {
    throw new ValidationError('CIDR must include at least one usable host.')
  }
  if (hostCount > 254) {
    throw new ValidationError('Discovery scans are limited to /24 or smaller networks.')
  }

  const network = ipToInt(networkAddress)
  return Array.from({ length: hostCount }, (_, index) => intToIp(network + index + 1))
}

function inferDeviceType(hostname: string | null) {
  const value = hostname?.toLowerCase() ?? ''
  if (!value) return 'endpoint' as const
  if (value.includes('ap') || value.includes('wifi') || value.includes('wlan')) return 'ap' as const
  if (value.includes('vm')) return 'vm' as const
  if (value.includes('fw') || value.includes('firewall') || value.includes('pfsense') || value.includes('opnsense')) return 'firewall' as const
  if (value.includes('sw') || value.includes('switch')) return 'switch' as const
  if (value.includes('rtr') || value.includes('router') || value.includes('gw')) return 'router' as const
  if (value.includes('srv') || value.includes('proxmox') || value.includes('esx') || value.includes('host')) return 'server' as const
  if (value.includes('nas') || value.includes('storage')) return 'storage' as const
  return 'endpoint' as const
}

function inferPlacement(deviceType: (typeof DEVICE_TYPES)[number]) {
  if (deviceType === 'ap') return 'wireless' as const
  if (deviceType === 'vm') return 'virtual' as const
  return 'room' as const
}

async function reverseLookup(ipAddress: string) {
  try {
    const names = await reverse(ipAddress)
    const hostname = names[0]?.replace(/\.$/, '') ?? null
    return hostname
  } catch {
    return null
  }
}

function normalizeMacAddress(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim().replaceAll('-', ':').toLowerCase()
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(normalized)) return null
  if (normalized === '00:00:00:00:00:00') return null
  return normalized
}

function vendorFromMac(macAddress: string | null) {
  if (!macAddress) return null
  return OUI_VENDOR_MAP[macAddress.slice(0, 8)] ?? null
}

async function lookupMacAddress(ipAddress: string) {
  const fromProc = await lookupMacFromProc(ipAddress)
  if (fromProc) return fromProc

  try {
    const { stdout } = await execFileAsync('arp', ['-a'], { timeout: 4000 })
    return parseArpOutput(String(stdout), ipAddress)
  } catch {
    return null
  }
}

async function lookupMacFromProc(ipAddress: string) {
  try {
    const raw = await readFile('/proc/net/arp', 'utf8')
    const match = raw
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .find((columns) => columns[0] === ipAddress)
    return normalizeMacAddress(match?.[3])
  } catch {
    return null
  }
}

function parseArpOutput(output: string, ipAddress: string) {
  const lines = output.split(/\r?\n/)
  for (const line of lines) {
    if (!line.includes(ipAddress)) continue

    const windowsMatch = line.match(/((?:[0-9a-f]{2}-){5}[0-9a-f]{2})/i)
    if (windowsMatch) {
      return normalizeMacAddress(windowsMatch[1])
    }

    const unixMatch = line.match(/((?:[0-9a-f]{2}:){5}[0-9a-f]{2})/i)
    if (unixMatch) {
      return normalizeMacAddress(unixMatch[1])
    }
  }
  return null
}

async function scanHost(ipAddress: string) {
  const result = await runIcmpProbe(ipAddress)
  if (result.result !== 'online') return null

  const [hostname, macAddress] = await Promise.all([reverseLookup(ipAddress), lookupMacAddress(ipAddress)])
  const deviceType = inferDeviceType(hostname)
  const displayName = hostname ? hostname.split('.')[0] : null

  return {
    ipAddress,
    hostname,
    displayName,
    deviceType,
    placement: inferPlacement(deviceType),
    macAddress,
    vendor: vendorFromMac(macAddress),
    source: 'icmp-scan',
    lastSeen: new Date().toISOString(),
  }
}

async function scanHosts(hosts: string[], concurrency = 24) {
  const results: Array<Awaited<ReturnType<typeof scanHost>>> = []
  let index = 0

  async function worker() {
    while (index < hosts.length) {
      const current = hosts[index]
      index += 1
      const result = await scanHost(current)
      if (result) results.push(result)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, hosts.length) }, () => worker()))
  return results
}

export const discoveryRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { labId?: string; status?: string } }>('/', async (req) => {
    let sql = 'SELECT * FROM discoveredDevices WHERE 1=1'
    const params: unknown[] = []

    if (req.query.labId) {
      sql += ' AND labId = ?'
      params.push(req.query.labId)
    }
    if (req.query.status) {
      const body = { status: req.query.status }
      const status = optionalEnum(body, 'status', DISCOVERY_STATUSES)
      if (status) {
        sql += ' AND status = ?'
        params.push(status)
      }
    }

    sql += ' ORDER BY lastScannedAt DESC, ipAddress ASC'
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map(parseDiscoveredDevice)
  })

  app.post('/scan', async (req, reply) => {
    const body = asObject(req.body)
    const labId = optionalString(body, 'labId', { maxLength: 80 })
    const cidr = optionalString(body, 'cidr', { maxLength: 80 })

    if (!labId) {
      throw new ValidationError('labId is required.')
    }
    if (!cidr) {
      throw new ValidationError('cidr is required.')
    }

    const lab = db.prepare('SELECT id FROM labs WHERE id = ?').get(labId)
    if (!lab) {
      return reply.status(404).send({ error: 'Lab not found.' })
    }

    const scannedAt = new Date().toISOString()
    const hosts = cidrHosts(cidr)
    const reachableHosts = await scanHosts(hosts)

    const upsert = db.prepare(`
      INSERT INTO discoveredDevices
        (id, labId, ipAddress, hostname, displayName, deviceType, placement, macAddress, vendor, source, status, notes, importedDeviceId, lastSeen, lastScannedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(labId, ipAddress) DO UPDATE SET
        hostname = COALESCE(excluded.hostname, discoveredDevices.hostname),
        displayName = COALESCE(discoveredDevices.displayName, excluded.displayName),
        deviceType = COALESCE(discoveredDevices.deviceType, excluded.deviceType),
        placement = COALESCE(discoveredDevices.placement, excluded.placement),
        macAddress = COALESCE(discoveredDevices.macAddress, excluded.macAddress),
        vendor = COALESCE(discoveredDevices.vendor, excluded.vendor),
        source = excluded.source,
        lastSeen = excluded.lastSeen,
        lastScannedAt = excluded.lastScannedAt
    `)

    const persistScan = db.transaction(() => {
      for (const record of reachableHosts) {
        if (!record) continue
        upsert.run(
          createId('disc'),
          labId,
          record.ipAddress,
          record.hostname,
          record.displayName,
          record.deviceType,
          record.placement,
          record.macAddress,
          record.vendor,
          record.source,
          'new',
          null,
          null,
          record.lastSeen,
          scannedAt,
        )
      }
    })

    persistScan()

    const rows = db.prepare(`
      SELECT * FROM discoveredDevices
      WHERE labId = ? AND lastScannedAt = ?
      ORDER BY ipAddress ASC
    `).all(labId, scannedAt) as Record<string, unknown>[]

    return {
      scannedHostCount: hosts.length,
      discoveredCount: rows.length,
      rows: rows.map(parseDiscoveredDevice),
    }
  })

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM discoveredDevices WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!existing) {
      return reply.status(404).send({ error: 'Discovered device not found.' })
    }

    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const hostname = optionalString(body, 'hostname', { maxLength: 200 })
    const displayName = optionalString(body, 'displayName', { maxLength: 200 })
    const notes = optionalString(body, 'notes', { maxLength: 2000 })
    const deviceType = optionalEnum(body, 'deviceType', DEVICE_TYPES)
    const placement = optionalEnum(body, 'placement', DEVICE_PLACEMENTS)
    const status = optionalEnum(body, 'status', DISCOVERY_STATUSES)
    const importedDeviceId = optionalString(body, 'importedDeviceId', { maxLength: 80 })
    const lastSeen = optionalString(body, 'lastSeen', { maxLength: 80 })

    if (lastSeen) ensureIsoDate(lastSeen, 'lastSeen')

    const stringFields = [
      ['hostname', hostname],
      ['displayName', displayName],
      ['notes', notes],
      ['lastSeen', lastSeen],
    ] as const

    for (const [key, value] of stringFields) {
      if (value !== undefined) {
        updates.push(`${key} = ?`)
        values.push(value)
      }
    }

    if (deviceType !== undefined) {
      updates.push('deviceType = ?')
      values.push(deviceType)
    }
    if (placement !== undefined) {
      updates.push('placement = ?')
      values.push(placement)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }
    if (importedDeviceId !== undefined) {
      if (importedDeviceId) {
        const importedDevice = db.prepare('SELECT id, labId FROM devices WHERE id = ?').get(importedDeviceId) as
          | { id: string; labId: string }
          | undefined
        if (!importedDevice) {
          throw new ValidationError('Imported device does not exist.')
        }
        if (importedDevice.labId !== String(existing.labId)) {
          throw new ValidationError('Imported device must belong to the same lab.')
        }
      }
      updates.push('importedDeviceId = ?')
      values.push(importedDeviceId)
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No valid fields to update.' })
    }

    values.push(req.params.id)
    db.prepare(`UPDATE discoveredDevices SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const row = db.prepare('SELECT * FROM discoveredDevices WHERE id = ?').get(req.params.id) as Record<string, unknown>
    return parseDiscoveredDevice(row)
  })

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM discoveredDevices WHERE id = ?').get(req.params.id)
    if (!existing) {
      return reply.status(404).send({ error: 'Discovered device not found.' })
    }

    db.prepare('DELETE FROM discoveredDevices WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })
}
