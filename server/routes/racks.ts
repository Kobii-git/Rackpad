import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'

export const racksRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/racks
  app.get('/', async () => {
    return db.prepare('SELECT * FROM racks ORDER BY name').all()
  })

  // GET /api/racks/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM racks WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Rack not found' })
    return row
  })

  // POST /api/racks
  app.post<{ Body: Record<string, unknown> }>('/', async (req, reply) => {
    const { id, labId, name, totalU, description, location, notes } = req.body as {
      id?: string; labId: string; name: string; totalU?: number
      description?: string; location?: string; notes?: string
    }
    const rackId = id ?? `rack_${Date.now()}`
    db.prepare(
      'INSERT INTO racks (id, labId, name, totalU, description, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(rackId, labId, name, totalU ?? 42, description ?? null, location ?? null, notes ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM racks WHERE id = ?').get(rackId))
  })

  // PATCH /api/racks/:id
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM racks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!existing) return reply.status(404).send({ error: 'Rack not found' })

    const allowed = ['name', 'totalU', 'description', 'location', 'notes'] as const
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
    db.prepare(`UPDATE racks SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM racks WHERE id = ?').get(req.params.id)
  })

  // DELETE /api/racks/:id
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT id FROM racks WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Rack not found' })
    db.prepare('DELETE FROM racks WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })
}
