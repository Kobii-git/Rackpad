import type { FastifyPluginAsync } from 'fastify'
import { db, parseRow } from '../db.js'
import {
  asObject,
  ensureCidr,
  ensureIpv4,
  optionalString,
  optionalStringArray,
  requiredEnum,
  requiredString,
} from '../lib/validation.js'

const IP_ZONE_KINDS = ['static', 'dhcp', 'reserved', 'infrastructure'] as const
const ASSIGNMENT_TYPES = ['device', 'interface', 'vm', 'container', 'reserved', 'infrastructure'] as const

function parseScope(row: Record<string, unknown>) {
  return parseRow(row, ['dnsServers'])
}

export const ipamRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { labId?: string } }>('/subnets', async (req) => {
    if (req.query.labId) {
      return db.prepare('SELECT * FROM subnets WHERE labId = ? ORDER BY cidr').all(req.query.labId)
    }
    return db.prepare('SELECT * FROM subnets ORDER BY cidr').all()
  })

  app.get<{ Params: { id: string } }>('/subnets/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Subnet not found' })
    return row
  })

  app.post('/subnets', async (req, reply) => {
    const body = asObject(req.body)
    const id = optionalString(body, 'id', { maxLength: 80 }) ?? `s_${Date.now()}`
    const labId = requiredString(body, 'labId', { maxLength: 80 })
    const cidr = ensureCidr(requiredString(body, 'cidr', { maxLength: 40 }))
    const name = requiredString(body, 'name', { maxLength: 120 })
    const description = optionalString(body, 'description', { maxLength: 500 })
    const vlanId = optionalString(body, 'vlanId', { maxLength: 80 })
    db.prepare(
      'INSERT INTO subnets (id, labId, cidr, name, description, vlanId) VALUES (?,?,?,?,?,?)'
    ).run(id, labId, cidr, name, description ?? null, vlanId ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM subnets WHERE id = ?').get(id))
  })

  app.patch<{ Params: { id: string } }>('/subnets/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM subnets WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'Subnet not found' })
    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const cidr = optionalString(body, 'cidr', { maxLength: 40 })
    const name = optionalString(body, 'name', { maxLength: 120 })
    const description = optionalString(body, 'description', { maxLength: 500 })
    const vlanId = optionalString(body, 'vlanId', { maxLength: 80 })

    if (cidr !== undefined) {
      // cidr is a NOT NULL column — reject explicit null/empty rather than letting the DB fail
      if (!cidr) return reply.status(400).send({ error: 'cidr cannot be empty.' })
      updates.push('cidr = ?')
      values.push(ensureCidr(cidr))
    }
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (vlanId !== undefined) { updates.push('vlanId = ?'); values.push(vlanId) }

    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields' })
    values.push(req.params.id)
    db.prepare(`UPDATE subnets SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM subnets WHERE id = ?').get(req.params.id)
  })

  app.delete<{ Params: { id: string } }>('/subnets/:id', async (req, reply) => {
    if (!db.prepare('SELECT id FROM subnets WHERE id = ?').get(req.params.id)) {
      return reply.status(404).send({ error: 'Subnet not found' })
    }
    db.prepare('DELETE FROM subnets WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  // ORDER BY added for consistency with all other list endpoints
  app.get<{ Querystring: { subnetId?: string } }>('/dhcp-scopes', async (req) => {
    const rows = req.query.subnetId
      ? db.prepare('SELECT * FROM dhcpScopes WHERE subnetId = ? ORDER BY name').all(req.query.subnetId)
      : db.prepare('SELECT * FROM dhcpScopes ORDER BY subnetId, name').all()
    return (rows as Record<string, unknown>[]).map(parseScope)
  })

  app.post('/dhcp-scopes', async (req, reply) => {
    const body = asObject(req.body)
    const id = optionalString(body, 'id', { maxLength: 80 }) ?? `sc_${Date.now()}`
    const subnetId = requiredString(body, 'subnetId', { maxLength: 80 })
    const name = requiredString(body, 'name', { maxLength: 120 })
    const startIp = ensureIpv4(requiredString(body, 'startIp', { maxLength: 40 }), 'startIp')
    const endIp = ensureIpv4(requiredString(body, 'endIp', { maxLength: 40 }), 'endIp')
    const gateway = optionalString(body, 'gateway', { maxLength: 40 })
    const dnsServers = optionalStringArray(body, 'dnsServers', { maxItems: 5 })
    const description = optionalString(body, 'description', { maxLength: 500 })
    db.prepare(
      'INSERT INTO dhcpScopes (id, subnetId, name, startIp, endIp, gateway, dnsServers, description) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, subnetId, name, startIp, endIp,
      gateway ? ensureIpv4(gateway, 'gateway') : null,
      dnsServers ? JSON.stringify(dnsServers.map((entry) => ensureIpv4(entry, 'dnsServers'))) : null,
      description ?? null)
    const row = db.prepare('SELECT * FROM dhcpScopes WHERE id = ?').get(id) as Record<string, unknown>
    return reply.status(201).send(parseScope(row))
  })

  app.patch<{ Params: { id: string } }>('/dhcp-scopes/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM dhcpScopes WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'DHCP scope not found' })
    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const name = optionalString(body, 'name', { maxLength: 120 })
    const startIp = optionalString(body, 'startIp', { maxLength: 40 })
    const endIp = optionalString(body, 'endIp', { maxLength: 40 })
    const gateway = optionalString(body, 'gateway', { maxLength: 40 })
    const dnsServers = optionalStringArray(body, 'dnsServers', { maxItems: 5 })
    const description = optionalString(body, 'description', { maxLength: 500 })

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (startIp !== undefined) {
      // startIp is NOT NULL — reject explicit null/empty before the DB sees it
      if (!startIp) return reply.status(400).send({ error: 'startIp cannot be empty.' })
      updates.push('startIp = ?')
      values.push(ensureIpv4(startIp, 'startIp'))
    }
    if (endIp !== undefined) {
      // endIp is NOT NULL — same guard
      if (!endIp) return reply.status(400).send({ error: 'endIp cannot be empty.' })
      updates.push('endIp = ?')
      values.push(ensureIpv4(endIp, 'endIp'))
    }
    if (gateway !== undefined) { updates.push('gateway = ?'); values.push(gateway ? ensureIpv4(gateway, 'gateway') : null) }
    if (dnsServers !== undefined) { updates.push('dnsServers = ?'); values.push(dnsServers ? JSON.stringify(dnsServers.map((entry) => ensureIpv4(entry, 'dnsServers'))) : null) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }

    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields' })
    values.push(req.params.id)
    db.prepare(`UPDATE dhcpScopes SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const row = db.prepare('SELECT * FROM dhcpScopes WHERE id = ?').get(req.params.id) as Record<string, unknown>
    return parseScope(row)
  })

  app.delete<{ Params: { id: string } }>('/dhcp-scopes/:id', async (req, reply) => {
    if (!db.prepare('SELECT id FROM dhcpScopes WHERE id = ?').get(req.params.id)) {
      return reply.status(404).send({ error: 'DHCP scope not found' })
    }
    db.prepare('DELETE FROM dhcpScopes WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  app.get<{ Querystring: { subnetId?: string } }>('/ip-zones', async (req) => {
    if (req.query.subnetId) {
      return db.prepare('SELECT * FROM ipZones WHERE subnetId = ? ORDER BY startIp').all(req.query.subnetId)
    }
    return db.prepare('SELECT * FROM ipZones ORDER BY subnetId, startIp').all()
  })

  app.post('/ip-zones', async (req, reply) => {
    const body = asObject(req.body)
    const id = optionalString(body, 'id', { maxLength: 80 }) ?? `iz_${Date.now()}`
    const subnetId = requiredString(body, 'subnetId', { maxLength: 80 })
    const kind = requiredEnum(body, 'kind', IP_ZONE_KINDS)
    const startIp = ensureIpv4(requiredString(body, 'startIp', { maxLength: 40 }), 'startIp')
    const endIp = ensureIpv4(requiredString(body, 'endIp', { maxLength: 40 }), 'endIp')
    const description = optionalString(body, 'description', { maxLength: 500 })
    db.prepare(
      'INSERT INTO ipZones (id, subnetId, kind, startIp, endIp, description) VALUES (?,?,?,?,?,?)'
    ).run(id, subnetId, kind, startIp, endIp, description ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM ipZones WHERE id = ?').get(id))
  })

  app.patch<{ Params: { id: string } }>('/ip-zones/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM ipZones WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'IP zone not found' })
    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const startIp = optionalString(body, 'startIp', { maxLength: 40 })
    const endIp = optionalString(body, 'endIp', { maxLength: 40 })
    const description = optionalString(body, 'description', { maxLength: 500 })

    if ('kind' in body) { updates.push('kind = ?'); values.push(requiredEnum(body, 'kind', IP_ZONE_KINDS)) }
    if (startIp !== undefined) { updates.push('startIp = ?'); values.push(startIp ? ensureIpv4(startIp, 'startIp') : null) }
    if (endIp !== undefined) { updates.push('endIp = ?'); values.push(endIp ? ensureIpv4(endIp, 'endIp') : null) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }

    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields' })
    values.push(req.params.id)
    db.prepare(`UPDATE ipZones SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM ipZones WHERE id = ?').get(req.params.id)
  })

  app.delete<{ Params: { id: string } }>('/ip-zones/:id', async (req, reply) => {
    if (!db.prepare('SELECT id FROM ipZones WHERE id = ?').get(req.params.id)) {
      return reply.status(404).send({ error: 'IP zone not found' })
    }
    db.prepare('DELETE FROM ipZones WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  app.get<{ Querystring: { subnetId?: string; deviceId?: string } }>('/ip-assignments', async (req) => {
    let sql = 'SELECT * FROM ipAssignments WHERE 1=1'
    const params: unknown[] = []
    if (req.query.subnetId) { sql += ' AND subnetId = ?'; params.push(req.query.subnetId) }
    if (req.query.deviceId) { sql += ' AND deviceId = ?'; params.push(req.query.deviceId) }
    sql += ' ORDER BY ipAddress'
    return db.prepare(sql).all(...params)
  })

  app.get<{ Params: { id: string } }>('/ip-assignments/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM ipAssignments WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'IP assignment not found' })
    return row
  })

  app.post('/ip-assignments', async (req, reply) => {
    const body = asObject(req.body)
    const id = optionalString(body, 'id', { maxLength: 80 }) ?? `ip_${Date.now()}`
    const subnetId = requiredString(body, 'subnetId', { maxLength: 80 })
    const ipAddress = ensureIpv4(requiredString(body, 'ipAddress', { maxLength: 40 }))
    const assignmentType = requiredEnum(body, 'assignmentType', ASSIGNMENT_TYPES)
    const deviceId = optionalString(body, 'deviceId', { maxLength: 80 })
    const portId = optionalString(body, 'portId', { maxLength: 80 })
    const vmId = optionalString(body, 'vmId', { maxLength: 80 })
    const containerId = optionalString(body, 'containerId', { maxLength: 80 })
    const hostname = optionalString(body, 'hostname', { maxLength: 120 })
    const description = optionalString(body, 'description', { maxLength: 500 })
    db.prepare(
      'INSERT INTO ipAssignments (id, subnetId, ipAddress, assignmentType, deviceId, portId, vmId, containerId, hostname, description) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(id, subnetId, ipAddress, assignmentType,
      deviceId ?? null, portId ?? null, vmId ?? null, containerId ?? null,
      hostname ?? null, description ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM ipAssignments WHERE id = ?').get(id))
  })

  app.patch<{ Params: { id: string } }>('/ip-assignments/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM ipAssignments WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'IP assignment not found' })
    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const subnetId = optionalString(body, 'subnetId', { maxLength: 80 })
    const ipAddress = optionalString(body, 'ipAddress', { maxLength: 40 })
    const deviceId = optionalString(body, 'deviceId', { maxLength: 80 })
    const portId = optionalString(body, 'portId', { maxLength: 80 })
    const vmId = optionalString(body, 'vmId', { maxLength: 80 })
    const containerId = optionalString(body, 'containerId', { maxLength: 80 })
    const hostname = optionalString(body, 'hostname', { maxLength: 120 })
    const description = optionalString(body, 'description', { maxLength: 500 })

    if (subnetId !== undefined) { updates.push('subnetId = ?'); values.push(subnetId) }
    if (ipAddress !== undefined) { updates.push('ipAddress = ?'); values.push(ipAddress ? ensureIpv4(ipAddress) : null) }
    if ('assignmentType' in body) { updates.push('assignmentType = ?'); values.push(requiredEnum(body, 'assignmentType', ASSIGNMENT_TYPES)) }
    if (deviceId !== undefined) { updates.push('deviceId = ?'); values.push(deviceId) }
    if (portId !== undefined) { updates.push('portId = ?'); values.push(portId) }
    if (vmId !== undefined) { updates.push('vmId = ?'); values.push(vmId) }
    if (containerId !== undefined) { updates.push('containerId = ?'); values.push(containerId) }
    if (hostname !== undefined) { updates.push('hostname = ?'); values.push(hostname) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }

    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields' })
    values.push(req.params.id)
    db.prepare(`UPDATE ipAssignments SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM ipAssignments WHERE id = ?').get(req.params.id)
  })

  app.delete<{ Params: { id: string } }>('/ip-assignments/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM ipAssignments WHERE id = ?').get(req.params.id) as
      | { deviceId?: string | null; ipAddress: string }
      | undefined
    if (!row) {
      return reply.status(404).send({ error: 'IP assignment not found' })
    }

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
