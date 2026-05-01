import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.DATABASE_PATH ?? path.resolve(__dirname, '../rackpad.db')

export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

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
    tags         TEXT,
    notes        TEXT,
    lastSeen     TEXT
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
`)

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_vlans_lab_vlanId
    ON vlans (labId, vlanId);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_assignments_subnet_ip
    ON ipAssignments (subnetId, ipAddress);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
    ON users (username);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash
    ON userSessions (tokenHash);
`)

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
