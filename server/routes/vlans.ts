import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { asObject, optionalInteger, optionalString, requiredInteger, requiredString } from '../lib/validation.js'

export const vlansRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { labId?: string } }>('/', async (req) => {
    if (req.query.labId) {
      return db.prepare('SELECT * FROM vlans WHERE labId = ? ORDER BY vlanId').all(req.query.labId)
    }
    return db.prepare('SELECT * FROM vlans ORDER BY vlanId').all()
  })

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM vlans WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'VLAN not found' })
    return row
  })

  app.post('/', async (req, reply) => {
    const body = asObject(req.body)
    const id = optionalString(body, 'id', { maxLength: 80 }) ?? `v_${Date.now()}`
    const labId = requiredString(body, 'labId', { maxLength: 80 })
    const vlanId = requiredInteger(body, 'vlanId', { min: 1, max: 4094 })
    const name = requiredString(body, 'name', { maxLength: 120 })
    const description = optionalString(body, 'description', { maxLength: 500 })
    const color = optionalString(body, 'color', { maxLength: 30 })
    db.prepare(
      'INSERT INTO vlans (id, labId, vlanId, name, description, color) VALUES (?,?,?,?,?,?)'
    ).run(id, labId, vlanId, name, description ?? null, color ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM vlans WHERE id = ?').get(id))
  })

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM vlans WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'VLAN not found' })

    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const vlanId = optionalInteger(body, 'vlanId', { min: 1, max: 4094 })
    const name = optionalString(body, 'name', { maxLength: 120 })
    const description = optionalString(body, 'description', { maxLength: 500 })
    const color = optionalString(body, 'color', { maxLength: 30 })

    if (vlanId !== undefined) { updates.push('vlanId = ?'); values.push(vlanId) }
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (color !== undefined) { updates.push('color = ?'); values.push(color) }

    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields to update' })

    values.push(req.params.id)
    db.prepare(`UPDATE vlans SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM vlans WHERE id = ?').get(req.params.id)
  })

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT id FROM vlans WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'VLAN not found' })
    db.prepare('DELETE FROM vlans WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  app.get('/ranges', async (req) => {
    const labId = (req.query as { labId?: string }).labId
    if (labId) {
      return db.prepare('SELECT * FROM vlanRanges WHERE labId = ? ORDER BY startVlan').all(labId)
    }
    return db.prepare('SELECT * FROM vlanRanges ORDER BY startVlan').all()
  })

  app.post('/ranges', async (req, reply) => {
    const body = asObject(req.body)
    const id = optionalString(body, 'id', { maxLength: 80 }) ?? `vr_${Date.now()}`
    const labId = requiredString(body, 'labId', { maxLength: 80 })
    const name = requiredString(body, 'name', { maxLength: 120 })
    const startVlan = requiredInteger(body, 'startVlan', { min: 1, max: 4094 })
    const endVlan = requiredInteger(body, 'endVlan', { min: startVlan, max: 4094 })
    const purpose = optionalString(body, 'purpose', { maxLength: 500 })
    const color = optionalString(body, 'color', { maxLength: 30 })
    d