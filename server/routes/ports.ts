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
    const face = optionalEnum(body, 'face', PORT_FACES) ?? 'front'
    const requestedPosition = optionalInteger(body, 'position', { min: 1, max: 500 })

    const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(deviceId)
    if (!device) {
      return reply.status(404).send({ error: 'Device not found.' })
    }

    const row = db.prepare('SELECT MAX(position) AS maxPosition FROM ports WHERE deviceId = ?').get(deviceId) as { maxPosition?: number | null }
    const position = requestedPosition ?? ((row.maxPosition ?? 0) + 1)
    const id = `p_${deviceId}_${Date.now()}`

    db.prepare(`
      INSERT INTO ports (id, deviceId, name, position, kind, speed, linkState, vlanId, description, face)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, deviceId, name, position, kind, speed ?? null, linkState, vlanId ?? null, description ?? null, face)

    return reply.status(201).send(db.prepare('SELECT * FROM ports WHERE id = ?').get(id))
  })

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM ports WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'Port not found' })

    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const name = optionalString(body, 'name', { maxLength: 120 })
    const speed = optionalString(body, 'speed', { maxLength: 20 })
    const vlanId = optionalString(body, 'vlanId', { maxLength: 80 })
    const description = optionalString(body, 'description', { maxLength: 500 })

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (speed !== undefined) { updates.push('speed = ?'); values.push(speed) }
    if (vlanId !== undefined) { updates.push('vlanId = ?'); values.push(vlanId) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }

    if ('kind' in body) { updates.push('kind = ?'); values.push(requiredEnum(body, 'kind', PORT_KINDS)) }
    if ('linkState' in body) { updates.push('linkState = ?'); values.push(requiredEnum(body, 'linkState', LINK_STATES)) }
    if ('face' in body) { updates.push('face = ?'); values.push(requiredEnum(body, 'face', PORT_FACES)) }

    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields to update' })

    values.push(req.params.id)
    db.prepare(`UPDATE ports SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM ports WHERE id = ?').get(req.params.id)
  })

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const port = db.prepare('SELECT id FROM ports WHERE id = ?').get(req.params.id)
    if (!port) {
      return reply.status(404).send({ error: 'Port not found.' })
    }

    const peers = db.prepare(`
      SELECT CASE WHEN fromPortId = ? THEN toPortId ELSE fromPortId END AS peerPortId
      FROM portLinks
      WHERE fromPortId = ? OR toPortId = ?
    `).all(req.params.id, req.params.id, req.params.id) as Array<{ peerPortId: string }>

    const removePort = db.transaction(() => {
      db.prepare('DELETE FROM ports WHERE id = ?').run(req.params.id)
      for (const peer of peers) {
        const stillLinked = db.prepare('SELECT id FROM portLinks WHERE fromPortId = ? OR toPortId = ?').get(peer.peerPortId, peer.peerPortId)
        if (!stillLinked) {
          db.prepare("UPDATE ports SET linkState = 'down' WHERE id = ?").run(peer.peerPortId)
        }
      }
    })

    removePort()
    return reply.status(204).send()
  })
}
