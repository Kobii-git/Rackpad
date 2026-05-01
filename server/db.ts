import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.DATABASE_PATH ?? path.resolve(__dirname, '../rackpad.db')

export const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ──────────────────────────────────────────────────────────────
// Schema
// All column names use camelCase to match TypeScript types
// for zero-friction row → object conversion.
// ──────────────────────────────────────────────────────────────

db.exec(`
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
    tags         TEXT,   -- JSON array stored as text
    notes        TEXT,
    lastSeen     TEXT    -- ISO date string
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
    dnsServers  TEXT,  -- JSON array stored as text
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
`)

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_vlans_lab_vlanId
    ON vlans (labId, vlanId);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_assignments_subnet_ip
    ON ipAssignments (subnetId, ipAddress);
`)

// ──────────────────────────────────────────────────────────────
// Helper: parse JSON text columns back to arrays/objects
// ──────────────────────────────────────────────────────────────

export function parseRow<T extends Record<string, unknown>>(
  row: T,
  jsonColumns: (keyof T)[]
): T {
  for (const col of jsonColumns) {
    if (typeof row[col] === 'string') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(row as any)[col] = JSON.parse(row[col] as string)
      } catch {
        // leave as-is
      }
    }
  }
  return row
}
