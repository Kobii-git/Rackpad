import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { asObject, optionalString, requiredString } from '../lib/validation.js'

export const cablesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    return db.prepare('SELECT * FROM portLinks').all()
  })

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM portLinks WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Port link not found' })
    return row
  })

  app.post('/', async (req, reply) => {
    const body = asObject(req.body)
    const fromPortId = requiredString(body, 'fromPortId', { maxLength: 80 })
    const toPortId = requiredString(body, 'toPortId', { maxLength: 80 })
    const cableType = optionalString(body, 'cableType', { maxLength: 80 })
    const cableLength = optionalString(body, 'cableLength', { maxLength: 40 })
    const color = optionalString(body, 'color', { maxLength: 40 })
    const notes = optionalString(body, 'notes', { maxLength: 500 })

    if (fromPortId === toPortId) {
      return reply.status(400).send({ error: 'A port cannot be linked to itself' })
    }

    const fromPort = db.prepare('SELECT id FROM ports WHERE id = ?').get(fromPortId)
    const toPort = db.prepare('SELECT id FROM ports WHERE id = ?').get(toPortId)
    if (!fromPort || !toPort) {
      return reply.status(400).send({ error: 'Both cable endpoints must exist' })
    }

    const existing = db.prepare(`
      SELECT id
      FROM portLinks
      WHERE fromPortId IN (?, ?) OR toPortId IN (?, ?)
      LIMIT 1
    `).get(fromPortId, toPortId, fromPortId, toPortId)
    if (existing) {
      return reply.status(409).send({ error: 'One of the selected ports is already linked' })
    }

    const id = `l_${Date.now()}`
    db.prepare(
      'INSERT INTO portLinks (id, fromPortId, toPortId, cableType, cableLength, color, notes) VALUES (?,?,?,?,?,?,?)'
    ).run(id, fromPortId, toPortId, cableType ?? null, cableLength ?? null, color ?? null, notes ?? null)

    db.prepare("UPDATE ports SET linkState = 'up' WHERE id = ? OR id = ?").run(fromPortId, toPortId)

    return reply.status(201).send(db.prepare('SELECT * FROM portLinks WHERE id = ?').get(id))
  })

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM portLinks WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'Port link not found' })

    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const cableType = optionalString(body, 'cableType', { maxLength: 80 })
    const cableLength = optionalString(body, 'cableLength', { maxLength: 40 })
    const color = optionalString(body, 'color', { maxLength: 40 })
    const notes = optionalString(body, 'notes', { maxLength: 500 })

    if (cableType !== undefined) { updates.push('cableType = ?'); values.push(cableType) }
    if (cableLength !== undefined) { updates.push('cableLength = ?'); values.push(cableLength) }
    