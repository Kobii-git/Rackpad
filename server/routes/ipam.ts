import type { FastifyPluginAsync } from 'fastify'
import { db, parseRow } from '../db.js'

function parseScope(row: Record<string, unknown>) {
  return parseRow(row, ['dnsServers'])
}

export const ipamRoutes: FastifyPluginAsync = async (app) => {
  // ── Subnets ──────────────────────────────────────────────────

  // GET /api/subnets  (optional ?labId=)
  app.get<{ Querystring: { labId?: string } }>('/subnets', async (req) => {
    if (req.query.labId) {
      return db.prepare('SELECT * FROM subnets WHERE labId = ? ORDER BY cidr').all(req.query.labId)
    }
    return db.prepare('SELECT * FROM subnets ORDER BY cidr').all()
  })

  // GET /api/subnets/:id
  app.get<{ Params: { id: string } }>('/subnets/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Subnet not found' })
    return row
  })

  // POST /api/subnets
  app.post<{ Body: Record<string, unknown> }>('/subnets', async (req, reply) => {
    const b = req.body as {
      id?: string; labId: string; cidr: string; name: string; description?: string; vlanId?: string
    }
    const id = b.id ?? `s_${Date.now()}`
    db.prepare(
      'INSERT INTO subnets (id, labId, cidr, name, description, vlanId) VALUES (?,?,?,?,?,?)'
    ).run(id, b.labId, b.cidr, b.name, b.description ?? null, b.vlanId ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM subnets WHERE id = ?').get(id))
  })

  // PATCH /api/subnets/:id
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/subnets/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM subnets WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'Subnet not found' })
    const allowed = ['cidr', 'name', 'description', 'vlanId'] as const
    const updates: string[] = []; const values: unknown[] = []
    for (const key of allowed) {
      if (key in req.body) { updates.push(`${key} = ?`); values.push((req.body as Record<string, unknown>)[key]) }
    }
    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields' })
    values.push(req.params.id)
    db.prepare(`UPDATE subnets SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id)
  })

  // DELETE /api/subnets/:id
  app.delete<{ Params: { id: string } }>('/subnets/:id', async (req, reply) => {
    if (!db.prepare('SELECT id FROM subnets WHERE id = ?').get(req.params.id))
      return reply.status(404).send({ error: 'Subnet not found' })
    db.prepare('DELETE FROM subnets WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  // ── DHCP Scopes ──────────────────────────────────────────────

  // GET /api/dhcp-scopes  (optional ?subnetId=)
  app.get<{ Querystring: { subnetId?: string } }>('/dhcp-scopes', async (req) => {
    const rows = req.query.subnetId
      ? db.prepare('SELECT * FROM dhcpScopes WHERE subnetId = ?').all(req.query.subnetId)
      : db.prepare('SELECT * FROM dhcpScopes').all()
    return (rows as Record<string, unknown>[]).map(parseScope)
  })

  // POST /api/dhcp-scopes
  app.post<{ Body: Record<string, unknown> }>('/dhcp-scopes', async (req, reply) => {
    const b = req.body as {
      id?: string; subnetId: string; name: string; startIp: string; endIp: string
      gateway?: string; dnsServers?: string[]; description?: string
    }
    const id = b.id ?? `sc_${Date.now()}`
    db.prepare(
      'INSERT INTO dhcpScopes (id, subnetId, name, startIp, endIp, gateway, dnsServers, description) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, b.subnetId, b.name, b.startIp, b.endIp,
      b.gateway ?? null,
      b.dnsServers ? JSON.stringify(b.dnsServers) : null,
      b.description ?? null)
    const row = db.prepare('SELECT * FROM dhcpScopes WHERE id = ?').get(id) as Record<string, unknown>
    return reply.status(201).send(parseScope(row))
  })

  // DELETE /api/dhcp-scopes/:id
  app.delete<{ Params: { id: string } }>('/dhcp-scopes/:id', async (req, reply) => {
    if (!db.prepare('SELECT id FROM dhcpScopes WHERE id = ?').get(req.params.id))
      return reply.status(404).send({ error: 'DHCP scope not found' })
    db.prepare('DELETE FROM dhcpScopes WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  // ── IP Zones ─────────────────────────────────────────────────

  // GET /api/ip-zones  (optional ?subnetId=)
  app.get<{ Querystring: { subnetId?: string } }>('/ip-zones', async (req) => {
    if (req.query.subnetId) {
      return db.prepare('SELECT * FROM ipZones WHERE subnetId = ? ORDER BY startIp').all(req.query.subnetId)
    }
    return db.prepare('SELECT * FROM ipZones ORDER BY subnetId, startIp').all()
  })

  // POST /api/ip-zones
  app.post<{ Body: Record<string, unknown> }>('/ip-zones', async (req, reply) => {
    const b = req.body as {
      id?: string; subnetId: string; kind: string; startIp: string; endIp: string; description?: string
    }
    const id = b.id ?? `iz_${Date.now()}`
    db.prepare(
      'INSERT INTO ipZones (id, subnetId, kind, startIp, endIp, description) VALUES (?,?,?,?,?,?)'
    ).run(id, b.subnetId, b.kind, b.startIp, b.endIp, b.description ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM ipZones WHERE id = ?').get(id))
  })

  // DELETE /api/ip-zones/:id
  app.delete<{ Params: { id: string } }>('/ip-zones/:id', async (req, reply) => {
    if (!db.prepare('SELECT id FROM ipZones WHERE id = ?').get(req.params.id))
      return reply.status(404).send({ error: 'IP zone not found' })
    db.prepare('DELETE FROM ipZones WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  // ── IP Assignments ────────────────────────────────────────────

  // GET /api/ip-assignments  (optional ?subnetId=, ?deviceId=)
  app.get<{ Querystring: { subnetId?: string; deviceId?: string } }>('/ip-assignments', async (req) => {
    let sql = 'SELECT * FROM ipAssignments WHERE 1=1'
    const params: unknown[] = []
    if (req.query.subnetId) { sql += ' AND subnetId = ?'; params.push(req.query.subnetId) }
    if (req.query.deviceId) { sql += ' AND deviceId = ?'; params.push(req.query.deviceId) }
    sql += ' ORDER BY ipAddress'
    return db.prepare(sql).all(...params)
  })

  // GET /api/ip-assignments/:id
  app.get<{ Params: { id: string } }>('/ip-assignments/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM ipAssignments WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'IP assignment not found' })
    return row
  })

  // POST /api/ip-assignments
  app.post<{ Body: Record<string, unknown> }>('/ip-assignments', async (req, reply) => {
    const b = req.body as {
      id?: string; subnetId: string; ipAddress: string; assignmentType: string
      deviceId?: string; portId?: string; vmId?: string; containerId?: string
      hostname?: string; description?: string
    }
    const id = b.id ?? `ip_${Date.now()}`
    db.prepare(
      'INSERT INTO ipAssignments (id, subnetId, ipAddress, assignmentType, deviceId, portId, vmId, containerId, hostname, description) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(id, b.subnetId, b.ipAddress, b.assignmentType,
      b.deviceId ?? null, b.portId ?? null, b.vmId ?? null, b.containerId ?? null,
      b.hostname ?? null, b.description ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM ipAssignments WHERE id = ?').get(id))
  })

  // PATCH /api/ip-assignments/:id
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/ip-assignments/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM ipAssignments WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'IP assignment not found' })
    const allowed = ['subnetId', 'ipAddress', 'assignmentType', 'deviceId', 'portId', 'vmId', 'containerId', 'hostname', 'description'] as const
    const updates: string[] = []; const values: unknown[] = []
    for (const key of allowed) {
      if (key in req.body) { updates.push(`${key} = ?`); values.push((req.body as Record<string, unknown>)[key]) }
    }
    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields' })
    values.push(req.params.id)
    db.prepare(`UPDATE ipAssignments SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM ipAssignments WHERE id = ?').get(req.params.id)
  })

  // DELETE /api/ip-assignments/:id
  app.delete<{ Params: { id: string } }>('/ip-assignments/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM ipAssignments WHERE id = ?').get(req.params.id) as
      | { deviceId?: string | null; ipAddress: string }
      | undefined
    if (!row)
      return reply.status(404).send({ error: 'IP assignment not found' })

    const deleteAssignment = db.transaction((assignmentId: string, deviceId: string | null | undefined, ipAddress: string) => {
      if (deviceId) {
        db.prepare(
          'UPDATE devices SET managementIp = NULL WHERE id = ? AND managementIp = ?'
        ).run(deviceId, ipAddress)
      }
      db.prepare('DELETE FROM ipAssignments WHERE id = ?').run(assignmentId)
    })

    deleteAssignment(req.params.id, row.deviceId, row.ipAddress)
    return reply.status(204).send()
  })
}
