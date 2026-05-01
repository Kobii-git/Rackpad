import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { asObject, optionalInteger, optionalString, requiredString } from '../lib/validation.js'

export const racksRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    return db.prepare('SELECT * FROM racks ORDER BY name').all()
  })

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM racks WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Rack not found' })
    return row
  })

  app.post('/', async (req, reply) => {
    const body = asObject(req.body)
    const rackId = optionalString(body, 'id', { maxLength: 80 }) ?? `rack_${Date.now()}`
    const labId = requiredString(body, 'labId', { maxLength: 80 })
    const name = requiredString(body, 'name', { maxLength: 120 })
    const totalU = optionalInteger(body, 'totalU', { min: 1, max: 100 }) ?? 42
    const description = optionalString(body, 'description', { maxLength: 500 })
    const location = optionalString(body, 'location', { maxLength: 200 })
    const notes = optionalString(body, 'notes', { maxLength: 2000 })

    db.prepare(
      'INSERT INTO racks (id, labId, name, totalU, description, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(rackId, labId, name, totalU, description ?? null, location ?? null, notes ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM racks WHERE id = ?').get(rackId))
  })

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM racks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!existing) return reply.status(404).send({ error: 'Rack not found' })

    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const name = optionalString(body, 'name', { maxLength: 120 })
    const totalU = optionalInteger(body, 'totalU', { min: 1, max: 100 })
    const description = optionalString(body, 'description', { maxLength: 500 })
    const location = optionalString(body, 'location', { maxLength: 200 })
    const notes = optionalString(body, 'notes', { maxLength: 2000 })

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (totalU !== undefined) { updates.push('totalU = ?'); values.push(totalU) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (location !== undefined) { upd