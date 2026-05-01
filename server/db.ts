import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.DATABASE_PATH ?? path.resolve(__dirname, '../rackpad.db')
const CURRENT_SCHEMA_VERSION = 3

export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const BOOTSTRAP_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS schemaVersion (
    id        INTEGER PRIMARY KEY CHECK (id = 1),
    version   INTEGER NOT NULL,
    updatedAt TEXT NOT NULL
  );
`

const SCHEMA_MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS labs (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        location    TEXT
      );

      CREATE TABLE IF NOT EXISTS racks (
        id          TEXT PRIMARY KEY,
        labId       TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        totalU      INTEGER NOT NULL DEFAULT 42,
        description TEXT,
        location    TEXT,
        notes       TEXT
      );

      CREATE TABLE IF NOT EXISTS devices (
        id           TEXT PRIMARY KEY,
        labId        TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
        rackId       TEXT REFERENCES racks(id) ON DELETE SET NULL,
        hostname     TEXT NOT NULL,
        displayName  TEXT,
        deviceType   TEXT NOT NULL,
        manufacturer TEXT,
        model        TEXT,
        serial       TEXT,
        managementIp TEXT,
        status       TEXT NOT NULL DEFAULT 'unknown',
        startU       INTEGER,
        heightU      INTEGER,
        face         TEXT,
        tags         TEXT,
        notes        TEXT,
        lastSeen     TEXT
      );

      CREATE TABLE IF NOT EXISTS vlans (
        id          TEXT PRIMARY KEY,
        labId       TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
        vlanId      INTEGER NOT NULL,
        name        TEXT NOT NULL,
        description TEXT,
        color       TEXT
      );

      CREATE TABLE IF NOT EXISTS vlanRanges (
        id        TEXT PRIMARY KEY,
        labId     TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
        name      TEXT NOT NULL,
        startVlan INTEGER NOT NULL,
        endVlan   INTEGER NOT NULL,
        purpose   TEXT,
        color     TEXT
      );

      CREATE TABLE IF NOT EXISTS ports (
        id          TEXT PRIMARY KEY,
        deviceId    TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        position    INTEGER NOT NULL,
        kind        TEXT NOT NULL,
        speed       TEXT,
        linkState   TEXT NOT NULL DEFAULT 'unknown',
        vlanId      TEXT REFERENCES vlans(id) ON DELETE SET NULL,
        description TEXT,
        face        TEXT
      );

      CREATE TABLE IF NOT EXISTS portLinks (
        id          TEXT PRIMARY KEY,
        fromPortId  TEXT NOT NULL REFERENCES ports(id) ON DELETE CASCADE,
        toPortId    TEXT NOT NULL REFERENCES ports(id) ON DELETE CASCADE,
        cableType   TEXT,
        cableLength TEXT,
        color       TEXT,
        notes       TEXT
      );

      CREATE TABLE IF NOT EXISTS subnets (
        id          TEXT PRIMARY KEY,
        labId       TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
        cidr        TEXT NOT NULL,
        name        TEXT NOT NULL,
        description TEXT,
        vlanId      TEXT REFERENCES vlans(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS dhcpScopes (
        id          TEXT PRIMARY KEY,
        subnetId    TEXT NOT NULL REFERENCES subnets(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        startIp     TEXT NOT NULL,
        endIp       TEXT NOT NULL,
        gateway     TEXT,
        dnsServers  TEXT,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS ipZones (
        id          TEXT PRIMARY KEY,
        subnetId    TEXT NOT NULL REFERENCES subnets(id) ON DELETE CASCADE,
        kind        TEXT NOT NULL,
        startIp     TEXT NOT NULL,
        endIp       TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS ipAssignments (
        id             TEXT PRIMARY KEY,
        subnetId       TEXT NOT NULL REFERENCES subnets(id) ON DELETE CASCADE,
        ipAddress      TEXT NOT NULL,
        assignmentType TEXT NOT NULL,
        deviceId       TEXT REFERENCES devices(id) ON DELETE SET NULL,
        portId         TEXT REFERENCES ports(id) ON DELETE SET NULL,
        vmId           TEXT,
        containerId    TEXT,
        hostname       TEXT,
        description    TEXT
      );

      CREATE TABLE IF NOT EXISTS auditLog (
        id         TEXT PRIMARY KEY,
        ts         TEXT NOT NULL,
        user       TEXT NOT NULL,
        action     TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId   TEXT NOT NULL,
        summary    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id           TEXT PRIMARY KEY,
        username     TEXT NOT NULL,
        displayName  TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        role         TEXT NOT NULL,
        disabled     INTEGER NOT NULL DEFAULT 0,
        createdAt    TEXT NOT NULL,
        lastLoginAt  TEXT
      );

      CREATE TABLE IF NOT EXISTS userSessions (
        id         TEXT PRIMARY KEY,
        userId     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tokenHash  TEXT NOT NULL,
        createdAt  TEXT NOT NULL,
        expiresAt  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deviceMonitors (
        id          TEXT PRIMARY KEY,
        deviceId    TEXT NOT NULL UNIQUE REFERENCES devices(id) ON DELETE CASCADE,
        type        TEXT NOT NULL DEFAULT 'none',
        target      TEXT,
        port        INTEGER,
        path        TEXT,
        intervalMs  INTEGER,
        enabled     INTEGER NOT NULL DEFAULT 0,
        lastCheckAt TEXT,
        lastResult  TEXT,
        lastMessage TEXT
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vlans_lab_vlanId
        ON vlans (labId, vlanId);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_assignments_subnet_ip
        ON ipAssignments (subnetId, ipAddress);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
        ON users (username);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash
        ON userSessions (tokenHash);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_vlan_ranges_lab_name
        ON vlanRanges (labId, name);

      CREATE INDEX IF NOT EXISTS idx_devices_lab_id
        ON devices (labId);

      CREATE INDEX IF NOT EXISTS idx_devices_rack_id
        ON devices (rackId);

      CREATE INDEX IF NOT EXISTS idx_ports_device_id
        ON ports (deviceId);

      CREATE INDEX IF NOT EXISTS idx_port_links_from_port_id
        ON portLinks (fromPortId);

      CREATE INDEX IF NOT EXISTS idx_port_links_to_port_id
        ON portLinks (toPortId);

      CREATE INDEX IF NOT EXISTS idx_ip_assignments_device_id
        ON ipAssignments (deviceId);

      CREATE INDEX IF NOT EXISTS idx_ip_assignments_subnet_id
        ON ipAssignments (subnetId);

      CREATE INDEX IF NOT EXISTS idx_dhcp_scopes_subnet_id
        ON dhcpScopes (subnetId);

      CREATE INDEX IF NOT EXISTS idx_ip_zones_subnet_id
        ON ipZones (subnetId);

      CREATE INDEX IF NOT EXISTS idx_device_monitors_device_id
        ON deviceMonitors (deviceId);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS portTemplates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL,
        deviceTypes TEXT NOT NULL,
        ports       TEXT NOT NULL,
        createdAt   TEXT NOT NULL,
        updatedAt   TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_port_templates_name
        ON portTemplates (name);
    `,
  },
] as const

const applySchema = db.transaction(() => {
  db.exec(BOOTSTRAP_SCHEMA_SQL)

  const row = db.prepare('SELECT version FROM schemaVersion WHERE id = 1').get() as { version?: number } | undefined
  let currentVersion = Number(row?.version ?? 0)

  for (const migration of SCHEMA_MIGRATIONS) {
    if (currentVersion >= migration.version) continue
    db.exec(migration.sql)
    const updatedAt = new Date().toISOString()
    db.prepare(`
      INSERT INTO schemaVersion (id, version, updatedAt)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET version = excluded.version, updatedAt = excluded.updatedAt
    `).run(migration.version, updatedAt)
    currentVersion = migration.version
  }

  if (currentVersion === 0) {
    db.prepare(`
      INSERT INTO schemaVersion (id, version, updatedAt)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET version = excluded.version, updatedAt = excluded.updatedAt
    `).run(CURRENT_SCHEMA_VERSION, new Date().toISOString())
  }
})

applySchema()

export function parseRow<T extends Record<string, unknown>>(
  row: T,
  jsonColumns: (keyof T)[],
): T {
  for (const col of jsonColumns) {
    if (typeof row[col] === 'string') {
      try {
        ;(row as Record<string, unknown>)[String(col)] = JSON.parse(String(row[col]))
      } catch {
        // Leave the raw value as-is if JSON parsing fails.
      }
    }
  }
  return row
}
