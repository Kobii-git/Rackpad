import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyPluginAsync } from 'fastify'
import { db, parseRow } from '../db.js'
import { requireAdmin, setBootstrapState } from '../lib/auth.js'
import { createId } from '../lib/ids.js'
import { asObject, ValidationError } from '../lib/validation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')
const PACKAGE_JSON_PATH = path.resolve(ROOT_DIR, 'package.json')
const APP_VERSION = readAppVersion()

function readAppVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { version?: string }
    return packageJson.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function createBackupFilename(exportedAt: string) {
  return `rackpad-backup-${exportedAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}.json`
}

const exportBackupSnapshot = db.transaction((exportedAt: string, exportedBy: string, filename: string) => {
  const auditId = createId('a')

  const snapshot = {
    format: 'rackpad-backup-v1',
    appVersion: APP_VERSION,
    exportedAt,
    exportedBy,
    data: {
      labs: db.prepare('SELECT * FROM labs ORDER BY name, id').all(),
      racks: db.prepare('SELECT * FROM racks ORDER BY name, id').all(),
      devices: (db.prepare('SELECT * FROM devices ORDER BY hostname, id').all() as Record<string, unknown>[])
        .map((row) => parseRow(row, ['tags'])),
      ports: db.prepare('SELECT * FROM ports ORDER BY deviceId, position, id').all(),
      portLinks: db.prepare('SELECT * FROM portLinks ORDER BY fromPortId, toPortId, id').all(),
      portTemplates: (db.prepare('SELECT * FROM portTemplates ORDER BY name, id').all() as Record<string, unknown>[])
        .map((row) => parseRow(row, ['deviceTypes', 'ports'])),
      vlans: db.prepare('SELECT * FROM vlans ORDER BY vlanId, id').all(),
      vlanRanges: db.prepare('SELECT * FROM vlanRanges ORDER BY startVlan, id').all(),
      subnets: db.prepare('SELECT * FROM subnets ORDER BY cidr, id').all(),
      dhcpScopes: (db.prepare('SELECT * FROM dhcpScopes ORDER BY subnetId, name, id').all() as Record<string, unknown>[])
        .map((row) => parseRow(row, ['dnsServers'])),
      ipZones: db.prepare('SELECT * FROM ipZones ORDER BY subnetId, startIp, id').all(),
      ipAssignments: db.prepare('SELECT * FROM ipAssignments ORDER BY subnetId, ipAddress, id').all(),
      auditLog: db.prepare('SELECT * FROM auditLog ORDER BY ts DESC, id DESC').all(),
      users: db.prepare(`
        SELECT id, username, displayName, passwordHash, role, disabled, createdAt, lastLoginAt
        FROM users
        ORDER BY username, id
      `).all(),
      deviceMonitors: db.prepare('SELECT * FROM deviceMonitors ORDER BY deviceId, id').all(),
    },
  }

  db.prepare(`
    INSERT INTO auditLog (id, ts, user, action, entityType, entityId, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditId,
    exportedAt,
    exportedBy,
    'admin.export',
    'Backup',
    auditId,
    `Exported Rackpad backup ${filename}`,
  )

  return snapshot
})

function normalizeArrayRecordArray(value: unknown, key: string) {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${key} must be an array.`)
  }
  return value.map((entry) => asObject(entry))
}

const restoreBackupSnapshot = db.transaction((snapshot: Record<string, unknown>, restoredBy: string) => {
  if (snapshot.format !== 'rackpad-backup-v1') {
    throw new ValidationError('Unsupported backup format.')
  }

  const data = asObject(snapshot.data)
  const labs = normalizeArrayRecordArray(data.labs, 'data.labs')
  const racks = normalizeArrayRecordArray(data.racks, 'data.racks')
  const devices = normalizeArrayRecordArray(data.devices, 'data.devices')
  const ports = normalizeArrayRecordArray(data.ports, 'data.ports')
  const portLinks = normalizeArrayRecordArray(data.portLinks, 'data.portLinks')
  const portTemplates = normalizeArrayRecordArray(data.portTemplates ?? [], 'data.portTemplates')
  const vlans = normalizeArrayRecordArray(data.vlans, 'data.vlans')
  const vlanRanges = normalizeArrayRecordArray(data.vlanRanges, 'data.vlanRanges')
  const subnets = normalizeArrayRecordArray(data.subnets, 'data.subnets')
  const dhcpScopes = normalizeArrayRecordArray(data.dhcpScopes, 'data.dhcpScopes')
  const ipZones = normalizeArrayRecordArray(data.ipZones, 'data.ipZones')
  const ipAssignments = normalizeArrayRecordArray(data.ipAssignments, 'data.ipAssignments')
  const auditLog = normalizeArrayRecordArray(data.auditLog, 'data.auditLog')
  const users = normalizeArrayRecordArray(data.users, 'data.users')
  const deviceMonitors = normalizeArrayRecordArray(data.deviceMonitors, 'data.deviceMonitors')

  if (users.length === 0) {
    throw new ValidationError('Backup must contain at least one user account.')
  }

  db.exec(`
    DELETE FROM userSessions;
    DELETE FROM deviceMonitors;
    DELETE FROM auditLog;
    DELETE FROM ipAssignments;
    DELETE FROM portLinks;
    DELETE FROM ports;
    DELETE FROM ipZones;
    DELETE FROM dhcpScopes;
    DELETE FROM subnets;
    DELETE FROM vlans;
    DELETE FROM vlanRanges;
    DELETE FROM portTemplates;
    DELETE FROM devices;
    DELETE FROM racks;
    DELETE FROM users;
    DELETE FROM labs;
  `)

  const insertLab = db.prepare('INSERT INTO labs (id, name, description, location) VALUES (?, ?, ?, ?)')
  const insertRack = db.prepare('INSERT INTO racks (id, labId, name, totalU, description, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertDevice = db.prepare(`
    INSERT INTO devices
      (id, labId, rackId, hostname, displayName, deviceType, manufacturer, model, serial, managementIp, status, startU, heightU, face, tags, notes, lastSeen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertPort = db.prepare('INSERT INTO ports (id, deviceId, name, position, kind, speed, linkState, vlanId, description, face) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertPortLink = db.prepare('INSERT INTO portLinks (id, fromPortId, toPortId, cableType, cableLength, color, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertPortTemplate = db.prepare(`
    INSERT INTO portTemplates (id, name, description, deviceTypes, ports, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertVlan = db.prepare('INSERT INTO vlans (id, labId, vlanId, name, description, color) VALUES (?, ?, ?, ?, ?, ?)')
  const insertVlanRange = db.prepare('INSERT INTO vlanRanges (id, labId, name, startVlan, endVlan, purpose, color) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertSubnet = db.prepare('INSERT INTO subnets (id, labId, cidr, name, description, vlanId) VALUES (?, ?, ?, ?, ?, ?)')
  const insertDhcpScope = db.prepare('INSERT INTO dhcpScopes (id, subnetId, name, startIp, endIp, gateway, dnsServers, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const insertIpZone = db.prepare('INSERT INTO ipZones (id, subnetId, kind, startIp, endIp, description) VALUES (?, ?, ?, ?, ?, ?)')
  const insertIpAssignment = db.prepare(`
    INSERT INTO ipAssignments (id, subnetId, ipAddress, assignmentType, deviceId, portId, vmId, containerId, hostname, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertAudit = db.prepare('INSERT INTO auditLog (id, ts, user, action, entityType, entityId, summary) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, displayName, passwordHash, role, disabled, createdAt, lastLoginAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertDeviceMonitor = db.prepare(`
    INSERT INTO deviceMonitors (id, deviceId, type, target, port, path, intervalMs, enabled, lastCheckAt, lastResult, lastMessage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const row of labs) {
    insertLab.run(row.id, row.name, row.description ?? null, row.location ?? null)
  }
  for (const row of users) {
    insertUser.run(
      row.id,
      row.username,
      row.displayName,
      row.passwordHash,
      row.role,
      Number(row.disabled ?? 0),
      row.createdAt,
      row.lastLoginAt ?? null,
    )
  }
  for (const row of racks) {
    insertRack.run(row.id, row.labId, row.name, row.totalU, row.description ?? null, row.location ?? null, row.notes ?? null)
  }
  for (const row of devices) {
    insertDevice.run(
      row.id,
      row.labId,
      row.rackId ?? null,
      row.hostname,
      row.displayName ?? null,
      row.deviceType,
      row.manufacturer ?? null,
      row.model ?? null,
      row.serial ?? null,
      row.managementIp ?? null,
      row.status,
      row.startU ?? null,
      row.heightU ?? null,
      row.face ?? null,
      row.tags ? JSON.stringify(row.tags) : null,
      row.notes ?? null,
      row.lastSeen ?? null,
    )
  }
  for (const row of vlans) {
    insertVlan.run(row.id, row.labId, row.vlanId, row.name, row.description ?? null, row.color ?? null)
  }
  for (const row of vlanRanges) {
    insertVlanRange.run(row.id, row.labId, row.name, row.startVlan, row.endVlan, row.purpose ?? null, row.color ?? null)
  }
  for (const row of subnets) {
    insertSubnet.run(row.id, row.labId, row.cidr, row.name, row.description ?? null, row.vlanId ?? null)
  }
  for (const row of ports) {
    insertPort.run(
      row.id,
      row.deviceId,
      row.name,
      row.position,
      row.kind,
      row.speed ?? null,
      row.linkState,
      row.vlanId ?? null,
      row.description ?? null,
      row.face ?? null,
    )
  }
  for (const row of portLinks) {
    insertPortLink.run(row.id, row.fromPortId, row.toPortId, row.cableType ?? null, row.cableLength ?? null, row.color ?? null, row.notes ?? null)
  }
  for (const row of portTemplates) {
    insertPortTemplate.run(
      row.id,
      row.name,
      row.description,
      JSON.stringify(row.deviceTypes ?? []),
      JSON.stringify(row.ports ?? []),
      row.createdAt ?? new Date().toISOString(),
      row.updatedAt ?? new Date().toISOString(),
    )
  }
  for (const row of dhcpScopes) {
    insertDhcpScope.run(
      row.id,
      row.subnetId,
      row.name,
      row.startIp,
      row.endIp,
      row.gateway ?? null,
      row.dnsServers ? JSON.stringify(row.dnsServers) : null,
      row.description ?? null,
    )
  }
  for (const row of ipZones) {
    insertIpZone.run(row.id, row.subnetId, row.kind, row.startIp, row.endIp, row.description ?? null)
  }
  for (const row of ipAssignments) {
    insertIpAssignment.run(
      row.id,
      row.subnetId,
      row.ipAddress,
      row.assignmentType,
      row.deviceId ?? null,
      row.portId ?? null,
      row.vmId ?? null,
      row.containerId ?? null,
      row.hostname ?? null,
      row.description ?? null,
    )
  }
  for (const row of auditLog) {
    insertAudit.run(row.id, row.ts, row.user, row.action, row.entityType, row.entityId, row.summary)
  }
  for (const row of deviceMonitors) {
    insertDeviceMonitor.run(
      row.id,
      row.deviceId,
      row.type,
      row.target ?? null,
      row.port ?? null,
      row.path ?? null,
      row.intervalMs ?? null,
      Number(row.enabled ?? 0),
      row.lastCheckAt ?? null,
      row.lastResult ?? null,
      row.lastMessage ?? null,
    )
  }

  const restoredAt = new Date().toISOString()
  const restoreAuditId = createId('a')
  insertAudit.run(
    restoreAuditId,
    restoredAt,
    restoredBy,
    'admin.restore',
    'Backup',
    restoreAuditId,
    `Restored Rackpad backup exported at ${String(snapshot.exportedAt ?? 'unknown time')}`,
  )

  setBootstrapState(users.length === 0)

  return {
    restored: true,
    requiresLogin: true,
    counts: {
      labs: labs.length,
      racks: racks.length,
      devices: devices.length,
      portTemplates: portTemplates.length,
      vlans: vlans.length,
      subnets: subnets.length,
      users: users.length,
    },
  }
})

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/export', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const exportedAt = new Date().toISOString()
    const filename = createBackupFilename(exportedAt)
    const snapshot = exportBackupSnapshot(exportedAt, req.authUser.username, filename)

    reply.header('Cache-Control', 'no-store')
    reply.header('Content-Type', 'application/json; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)

    return snapshot
  })

  app.post('/restore', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const snapshot = asObject(req.body)
    return reply.send(restoreBackupSnapshot(snapshot, req.authUser.username))
  })
}
