import type { FastifyPluginAsync } from 'fastify'
import { db, parseRow } from '../db.js'
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

    const id = `d_${Date.now()}`
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
        placement.r