import type { FastifyPluginAsync } from 'fastify'
import { db, parseRow } from '../db.js'
import { createId } from '../lib/ids.js'
import { createPortsFromTemplate, getPortTemplate } from '../lib/port-templates.js'
import { validateRackPlacement } from '../lib/rack-placement.js'
import {
  asObject,
  ensureIpv4,
  ensureIsoDate,
  optionalEnum,
  optionalInteger,
  optionalString,
  optionalStringArray,
  requiredEnum,
  requiredString,
  ValidationError,
} from '../lib/validation.js'

const DEVICE_TYPES = [
  'switch',
  'router',
  'firewall',
  'server',
  'patch_panel',
  'storage',
  'pdu',
  'ups',
  'kvm',
  'other',
] as const

const DEVICE_STATUSES = ['online', 'offline', 'warning', 'unknown', 'maintenance'] as const
const DEVICE_FACES = ['front', 'rear'] as const
const JSON_COLS = ['tags'] as const

function parseDevice(row: Record<string, unknown>) {
  return parseRow(row, [...JSON_COLS])
}

export const devicesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { rackId?: string; labId?: string } }>('/', async (req) => {
    let sql = 'SELECT * FROM devices WHERE 1=1'
    const params: unknown[] = []
    if (req.query.rackId) { sql += ' AND rackId = ?'; params.push(req.query.rackId) }
    if (req.query.labId) { sql += ' AND labId = ?'; params.push(req.query.labId) }
    sql += ' ORDER BY hostname'
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map(parseDevice)
  })

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!row) return reply.status(404).send({ error: 'Device not found' })
    return parseDevice(row)
  })

  app.post('/', async (req, reply) => {
    const body = asObject(req.body)
    const labId = requiredString(body, 'labId', { maxLength: 80 })
    const hostname = requiredString(body, 'hostname', { maxLength: 120 })
    const deviceType = requiredEnum(body, 'deviceType', DEVICE_TYPES)
    const displayName = optionalString(body, 'displayName', { maxLength: 120 })
    const manufacturer = optionalString(body, 'manufacturer', { maxLength: 120 })
    const model = optionalString(body, 'model', { maxLength: 120 })
    const serial = optionalString(body, 'serial', { maxLength: 120 })
    const managementIp = optionalString(body, 'managementIp', { maxLength: 60 })
    const status = optionalEnum(body, 'status', DEVICE_STATUSES) ?? 'unknown'
    const rackId = optionalString(body, 'rackId', { maxLength: 80 })
    const startU = optionalInteger(body, 'startU', { min: 1, max: 100 })
    const heightU = optionalInteger(body, 'heightU', { min: 1, max: 20 })
    const face = optionalEnum(body, 'face', DEVICE_FACES)
    const tags = optionalStringArray(body, 'tags', { maxItems: 30 })
    const notes = optionalString(body, 'notes', { maxLength: 2000 })
    const lastSeen = optionalString(body, 'lastSeen', { maxLength: 80 })
    const portTemplateId = optionalString(body, 'portTemplateId', { maxLength: 80 })

    if (managementIp) ensureIpv4(managementIp, 'managementIp')
    if (lastSeen) ensureIsoDate(lastSeen, 'lastSeen')

    const placement = validateRackPlacement({
      rackId,
      startU,
      heightU,
      face,
    })

    const template = portTemplateId ? getPortTemplate(portTemplateId) : null
    if (portTemplateId && !template) {
      throw new ValidationError('Selected port template does not exist.')
    }

    const id = createId('d')
    const insertDevice = db.prepare(`
      INSERT INTO devices
        (id, labId, rackId, hostname, displayName, deviceType, manufacturer, model,
         serial, managementIp, status, startU, heightU, face, tags, notes, lastSeen)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `)
    const insertPort = db.prepare(`
      INSERT INTO ports (id, deviceId, name, position, kind, speed, linkState, vlanId, description, face)
      VALUES (@id, @deviceId, @name, @position, @kind, @speed, @linkState, @vlanId, @description, @face)
    `)

    const createDevice = db.transaction(() => {
      insertDevice.run(
        id,
        labId,
        placement.rackId,
        hostname,
        displayName ?? null,
        deviceType,
        manufacturer ?? null,
        model ?? null,
        serial ?? null,
        managementIp ?? null,
        status,
        placement.startU,
        placement.heightU,
        placement.face,
        tags ? JSON.stringify(tags) : null,
        notes ?? null,
        lastSeen ?? null,
      )

      for (const port of template ? createPortsFromTemplate(id, template.id) : []) {
        insertPort.run(port)
      }
    })

    createDevice()

    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as Record<string, unknown>
    return reply.status(201).send(parseDevice(row))
  })

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!existing) return reply.status(404).send({ error: 'Device not found' })

    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const rackId = optionalString(body, 'rackId', { maxLength: 80 })
    const startU = optionalInteger(body, 'startU', { min: 1, max: 100 })
    const heightU = optionalInteger(body, 'heightU', { min: 1, max: 20 })
    const face = optionalEnum(body, 'face', DEVICE_FACES)

    if (rackId !== undefined || startU !== undefined || heightU !== undefined || face !== undefined) {
      const placement = validateRackPlacement({
        deviceId: req.params.id,
        rackId: rackId === undefined ? (existing.rackId ? String(existing.rackId) : null) : rackId,
        startU: startU === undefined ? (existing.startU == null ? null : Number(existing.startU)) : startU,
        heightU: heightU === undefined ? (existing.heightU == null ? null : Number(existing.heightU)) : heightU,
        face: face === undefined ? (existing.face ? String(existing.face) : null) : face,
      })

      updates.push('rackId = ?', 'startU = ?', 'heightU = ?', 'face = ?')
      values.push(placement.rackId, placement.startU, placement.heightU, placement.face)
    }

    const simpleStringKeys = [
      ['hostname', 120],
      ['displayName', 120],
      ['manufacturer', 120],
      ['model', 120],
      ['serial', 120],
      ['managementIp', 60],
      ['notes', 2000],
      ['lastSeen', 80],
    ] as const

    for (const [key, maxLength] of simpleStringKeys) {
      const value = optionalString(body, key, { maxLength })
      if (value !== undefined) {
        if (key === 'managementIp' && value) ensureIpv4(value, key)
        if (key === 'lastSeen' && value) ensureIsoDate(value, key)
        updates.push(`${key} = ?`)
        values.push(value)
      }
    }

    if ('deviceType' in body) {
      updates.push('deviceType = ?')
      values.push(requiredEnum(body, 'deviceType', DEVICE_TYPES))
    }

    if ('status' in body) {
      updates.push('status = ?')
      values.push(requiredEnum(body, 'status', DEVICE_STATUSES))
    }

    const tags = optionalStringArray(body, 'tags', { maxItems: 30 })
    if (tags !== undefined) {
      updates.push('tags = ?')
      values.push(tags ? JSON.stringify(tags) : null)
    }

    const portTemplateId = optionalString(body, 'portTemplateId', { maxLength: 80 })
    if (portTemplateId) {
      const hasPorts = db.prepare('SELECT COUNT(*) AS count FROM ports WHERE deviceId = ?').get(req.params.id) as { count: number }
      if (hasPorts.count > 0) {
        return reply.status(409).send({ error: 'This device already has ports. Port templates can only be applied to empty devices.' })
      }
      const template = getPortTemplate(portTemplateId)
      if (!template) {
        throw new ValidationError('Selected port template does not exist.')
      }
      const insertPort = db.prepare(`
        INSERT INTO ports (id, deviceId, name, position, kind, speed, linkState, vlanId, description, face)
        VALUES (@id, @deviceId, @name, @position, @kind, @speed, @linkState, @vlanId, @description, @face)
      `)
      const applyPorts = db.transaction(() => {
        for (const port of createPortsFromTemplate(req.params.id, template.id)) {
          insertPort.run(port)
        }
      })
      applyPorts()
    }

    if (updates.length > 0) {
      values.push(req.params.id)
      db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    } else if (!portTemplateId) {
      return reply.status(400).send({ error: 'No valid fields to update' })
    }

    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Record<string, unknown>
    return parseDevice(row)
  })

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Device not found' })

    const portIds = (
      db.prepare('SELECT id FROM ports WHERE deviceId = ?').all(req.params.id) as Array<{ id: string }>
    ).map((port) => port.id)

    const deleteDevice = db.transaction((deviceId: string, devicePortIds: string[]) => {
      if (devicePortIds.length > 0) {
        const placeholders = devicePortIds.map(() => '?').join(', ')
        db.prepare(
          `DELETE FROM ipAssignments WHERE deviceId = ? OR portId IN (${placeholders})`
        ).run(deviceId, ...devicePortIds)
      } else {
        db.prepare('DELETE FROM ipAssignments WHERE deviceId = ?').run(deviceId)
      }

      db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId)
    })

    deleteDevice(req.params.id, portIds)
    return reply.status(204).send()
  })
}
