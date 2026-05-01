import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyPluginAsync } from 'fastify'
import { db, parseRow } from '../db.js'
import { requireAdmin } from '../lib/auth.js'
import { createId } from '../lib/ids.js'

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

const readBackupSnapshot = db.transaction((exportedAt: string, exportedBy: string) => ({
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
}))

function createBackupFilename(exportedAt: string) {
  return `rackpad-backup-${exportedAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}.json`
}

function recordExportAudit(exportedAt: string, username: string, filename: string) {
  const auditId = createId('a')
  db.prepare(`
    INSERT INTO auditLog (id, ts, user, action, entityType, entityId, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditId,
    exportedAt,
    username,
    'admin.export',
    'Backup',
    auditId,
    `Exported Rackpad backup ${filename}`,
  )
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/export', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const exportedAt = new Date().toISOString()
    const filename = createBackupFilename(exportedAt)
    const snapshot = readBackupSnapshot(exportedAt, req.authUser.username)

    recordExportAudit(exportedAt, req.authUser.username, filename)

    reply.header('Cache-Control', 'no-store')
    reply.header('Content-Type', 'application/json; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)

    return snapshot
  })
}
