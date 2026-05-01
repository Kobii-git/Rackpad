import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'rackpad-tests-'))
process.env.DATABASE_PATH = path.join(tempDir, 'rackpad-test.db')
process.env.NODE_ENV = 'test'

const { createApp } = await import('../app.js')
const { db } = await import('../db.js')

type AppInstance = Awaited<ReturnType<typeof createApp>>

let app: AppInstance

beforeEach(async () => {
  resetDatabase()
  app = await createApp()
})

afterEach(async () => {
  await app.close()
})

after(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

test('bootstrap creates the first admin account and session', async () => {
  const statusRes = await app.inject({
    method: 'GET',
    url: '/api/auth/status',
  })
  assert.equal(statusRes.statusCode, 200)
  assert.deepEqual(readJson(statusRes), { needsBootstrap: true })

  const bootstrapRes = await app.inject({
    method: 'POST',
    url: '/api/auth/bootstrap',
    payload: {
      username: 'admin',
      displayName: 'Rack Admin',
      password: 'super-secret-1',
    },
  })

  assert.equal(bootstrapRes.statusCode, 201)
  const session = readJson(bootstrapRes) as { token: string; user: { role: string; username: string } }
  assert.equal(session.user.username, 'admin')
  assert.equal(session.user.role, 'admin')
  assert.ok(session.token)

  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: {
      authorization: `Bearer ${session.token}`,
    },
  })

  assert.equal(meRes.statusCode, 200)
  const me = readJson(meRes) as { user: { username: string } }
  assert.equal(me.user.username, 'admin')
})

test('bootstrap can start with an empty lab or load demo data on demand', async () => {
  const emptyBootstrapRes = await app.inject({
    method: 'POST',
    url: '/api/auth/bootstrap',
    payload: {
      username: 'admin',
      displayName: 'Rack Admin',
      password: 'super-secret-1',
      loadDemoData: false,
    },
  })

  assert.equal(emptyBootstrapRes.statusCode, 201)

  const emptyState = {
    labs: db.prepare('SELECT COUNT(*) AS count FROM labs').get() as { count: number },
    racks: db.prepare('SELECT COUNT(*) AS count FROM racks').get() as { count: number },
    devices: db.prepare('SELECT COUNT(*) AS count FROM devices').get() as { count: number },
    vlanRanges: db.prepare('SELECT COUNT(*) AS count FROM vlanRanges').get() as { count: number },
  }

  assert.equal(emptyState.labs.count, 1)
  assert.equal(emptyState.racks.count, 0)
  assert.equal(emptyState.devices.count, 0)
  assert.equal(emptyState.vlanRanges.count, 0)

  resetDatabase()

  const demoBootstrapRes = await app.inject({
    method: 'POST',
    url: '/api/auth/bootstrap',
    payload: {
      username: 'admin',
      displayName: 'Rack Admin',
      password: 'super-secret-1',
      loadDemoData: true,
    },
  })

  assert.equal(demoBootstrapRes.statusCode, 201)

  const demoState = {
    labs: db.prepare('SELECT COUNT(*) AS count FROM labs').get() as { count: number },
    racks: db.prepare('SELECT COUNT(*) AS count FROM racks').get() as { count: number },
    devices: db.prepare('SELECT COUNT(*) AS count FROM devices').get() as { count: number },
    vlanRanges: db.prepare('SELECT COUNT(*) AS count FROM vlanRanges').get() as { count: number },
  }

  assert.equal(demoState.labs.count, 1)
  assert.ok(demoState.racks.count > 0)
  assert.ok(demoState.devices.count > 0)
  assert.ok(demoState.vlanRanges.count > 0)
})

test('viewer accounts are read-only', async () => {
  const adminToken = await bootstrapAdmin()

  const viewerRes = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      username: 'viewer1',
      displayName: 'Viewer User',
      password: 'viewer-password-1',
      role: 'viewer',
    },
  })

  assert.equal(viewerRes.statusCode, 201)

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'viewer1',
      password: 'viewer-password-1',
    },
  })

  assert.equal(loginRes.statusCode, 200)
  const viewerToken = (readJson(loginRes) as { token: string }).token

  const readRes = await app.inject({
    method: 'GET',
    url: '/api/racks',
    headers: {
      authorization: `Bearer ${viewerToken}`,
    },
  })
  assert.equal(readRes.statusCode, 200)

  const writeRes = await app.inject({
    method: 'POST',
    url: '/api/racks',
    headers: {
      authorization: `Bearer ${viewerToken}`,
    },
    payload: {
      labId: 'lab_home',
      name: 'Should Fail',
      totalU: 42,
    },
  })
  assert.equal(writeRes.statusCode, 403)
  assert.match(writeRes.body, /read-only/i)
})

test('admin export returns a backup snapshot and blocks viewer access', async () => {
  const adminToken = await bootstrapAdmin()

  const exportRes = await app.inject({
    method: 'GET',
    url: '/api/admin/export',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  })

  assert.equal(exportRes.statusCode, 200)
  assert.match(exportRes.headers['content-disposition'] ?? '', /rackpad-backup-.*\.json/i)

  const snapshot = readJson(exportRes) as {
    format: string
    appVersion: string
    data: { labs: unknown[]; users: Array<{ username: string }>; userSessions?: unknown[] }
  }

  assert.equal(snapshot.format, 'rackpad-backup-v1')
  assert.ok(snapshot.appVersion)
  assert.equal(snapshot.data.labs.length, 1)
  assert.equal(snapshot.data.users[0]?.username, 'admin')
  assert.equal(snapshot.data.userSessions, undefined)

  const viewerRes = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      username: 'viewer-export',
      displayName: 'Viewer Export',
      password: 'viewer-export-1',
      role: 'viewer',
    },
  })

  assert.equal(viewerRes.statusCode, 201)

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'viewer-export',
      password: 'viewer-export-1',
    },
  })

  assert.equal(loginRes.statusCode, 200)
  const viewerToken = (readJson(loginRes) as { token: string }).token

  const forbiddenRes = await app.inject({
    method: 'GET',
    url: '/api/admin/export',
    headers: {
      authorization: `Bearer ${viewerToken}`,
    },
  })

  assert.equal(forbiddenRes.statusCode, 403)
  assert.match(forbiddenRes.body, /administrator/i)
})

test('creating a device with a port template creates its ports', async () => {
  const adminToken = await bootstrapAdmin()

  const deviceRes = await app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      labId: 'lab_home',
      hostname: 'sw-template-01',
      deviceType: 'switch',
      status: 'unknown',
      portTemplateId: 'switch-24g-4sfp+',
    },
  })

  assert.equal(deviceRes.statusCode, 201)
  const device = readJson(deviceRes) as { id: string }

  const portsRes = await app.inject({
    method: 'GET',
    url: `/api/ports?deviceId=${device.id}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  })

  assert.equal(portsRes.statusCode, 200)
  const ports = readJson(portsRes) as Array<{ name: string }>
  assert.equal(ports.length, 28)
  assert.equal(ports[0]?.name, '1')
  assert.equal(ports.at(-1)?.name, 'SFP+4')
})

test('rack placement validation rejects overlapping devices', async () => {
  const adminToken = await bootstrapAdmin()

  const rackRes = await app.inject({
    method: 'POST',
    url: '/api/racks',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      labId: 'lab_home',
      name: 'Validation Rack',
      totalU: 42,
    },
  })

  assert.equal(rackRes.statusCode, 201)
  const rack = readJson(rackRes) as { id: string }

  const firstDeviceRes = await app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      labId: 'lab_home',
      rackId: rack.id,
      hostname: 'rack-device-01',
      deviceType: 'server',
      status: 'unknown',
      startU: 10,
      heightU: 2,
      face: 'front',
    },
  })

  assert.equal(firstDeviceRes.statusCode, 201)

  const overlapRes = await app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      labId: 'lab_home',
      rackId: rack.id,
      hostname: 'rack-device-02',
      deviceType: 'server',
      status: 'unknown',
      startU: 11,
      heightU: 1,
      face: 'front',
    },
  })

  assert.equal(overlapRes.statusCode, 400)
  assert.match(overlapRes.body, /overlap/i)
})

test('monitoring endpoints validate config and persist results', async () => {
  const adminToken = await bootstrapAdmin()

  const deviceRes = await app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      labId: 'lab_home',
      hostname: 'monitor-01',
      deviceType: 'server',
      status: 'unknown',
    },
  })
  assert.equal(deviceRes.statusCode, 201)
  const device = readJson(deviceRes) as { id: string }

  const invalidMonitorRes = await app.inject({
    method: 'PUT',
    url: `/api/device-monitors/${device.id}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      type: 'tcp',
      enabled: true,
    },
  })
  assert.equal(invalidMonitorRes.statusCode, 400)
  assert.match(invalidMonitorRes.body, /target/i)

  const validMonitorRes = await app.inject({
    method: 'PUT',
    url: `/api/device-monitors/${device.id}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      type: 'tcp',
      target: '127.0.0.1',
      port: 1,
      intervalMs: 1000,
      enabled: true,
    },
  })
  assert.equal(validMonitorRes.statusCode, 200)

  const runRes = await app.inject({
    method: 'POST',
    url: `/api/device-monitors/run/${device.id}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  })
  assert.equal(runRes.statusCode, 200)

  const result = readJson(runRes) as { lastCheckAt?: string; lastResult?: string; type: string }
  assert.equal(result.type, 'tcp')
  assert.ok(result.lastCheckAt)
  assert.ok(result.lastResult === 'online' || result.lastResult === 'offline')
})

function resetDatabase() {
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
    DELETE FROM vlanRanges;
    DELETE FROM vlans;
    DELETE FROM devices;
    DELETE FROM racks;
    DELETE FROM users;
    DELETE FROM labs;
  `)
}

async function bootstrapAdmin() {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/bootstrap',
    payload: {
      username: 'admin',
      displayName: 'Admin User',
      password: 'super-secret-1',
    },
  })

  assert.equal(res.statusCode, 201)
  return (readJson(res) as { token: string }).token
}

function readJson(response: { body: string }) {
  return JSON.parse(response.body)
}
