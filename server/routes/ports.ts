import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'

export const portsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/ports  (optional ?deviceId=)
  app.get<{ Querystring: { deviceId?: string } }>('/', async (req) => {
    if (req.query.deviceId) {
      return db.prepare('SELECT * FROM ports WHERE deviceId = ? ORDER BY position').all(req.query.deviceId)
    }
    return db.prepare('SELECT * FROM ports ORDER BY deviceId, position').all()
  })

  // GET /api/ports/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM ports WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Port not found' })
    return row
  })

  // PATCH /api/ports/:id  (update linkState, vlanId, description, speed)
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM ports WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'Port not found' })

    const allowed = ['name', 'kind', 'speed', 'linkState', 'vlanId', 'description', 'face'] as const
    const updates: string[] = []
    const values: unknown[] = []
    for (const key of allowed) {
      if (key in req.body) {
        updates.push(`${key} = ?`)
        values.push((req.body as Record<string, unknown>)[key])
      }
    }
    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields to update' })
    values.push(req.params.id)
    db.prepare(`UPDATE ports SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM ports WHERE id = ?').get(req.params.id)
  })
}
