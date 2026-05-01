import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { PORT_TEMPLATES } from '../lib/port-templates.js'
import {
  asObject,
  optionalEnum,
  optionalInteger,
  optionalString,
  requiredEnum,
  requiredString,
} from '../lib/validation.js'

const PORT_KINDS = ['rj45', 'sfp', 'sfp_plus', 'qsfp', 'fiber', 'power', 'console', 'usb'] as const
const LINK_STATES = ['up', 'down', 'disabled', 'unknown'] as const
const PORT_FACES = ['front', 'rear'] as const

export const portsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/templates', async () => {
    return PORT_TEMPLATES
  })

  app.get<{ Querystring: { deviceId?: string } }>('/', async (req) => {
    if (req.query.deviceId) {
      return db.prepare('SELECT * FROM ports WHERE deviceId = ? ORDER BY position').all(req.query.deviceId)
    }
    return db.prepare('SELECT * FROM ports ORDER BY deviceId, position').all()
  })

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM ports WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Port not found' })
    return row
  })

  app.post('/', async (req, reply) => {
    const body = asObject(req.body)
    const deviceId = requiredString(body, 'deviceId', { maxLength: 80 })
    const name = requiredString(body, 'name', { maxLength: 120 })
    const kind = requiredEnum(body, 'kind', PORT_KINDS)
    const speed = optionalString(body, 'speed', { maxLength: 20 })
    const linkState = optionalEnum(body, 'linkState', LINK_STATES) ?? 'down'
    const vlanId = optionalString(body, 'vlanId', { maxLength: 80 })
    const description = optionalString(body, 'description', { maxLength: 500 })
    const