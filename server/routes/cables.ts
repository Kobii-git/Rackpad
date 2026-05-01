import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'

export const cablesRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/port-links
  app.get('/', async () => {
    return db.prepare('SELECT * FROM portLinks').all()
  })

  // GET /api/port-links/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM portLinks WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Port link not found' })
    return row
  })

  // POST /api/port-links
  app.post<{ Body: Record<string, unknown> }>('/', async (req, reply) => {
    const b = req.body as {
      id?: string; fromPortId: string; toPortId: string
      cableType?: string; cableLength?: string; color?: string; notes?: string
    }
    if (b.fromPortId === b.toPortId) {
      return reply.status(400).send({ error: 'A port cannot be linked to itself' })
    }

    const fromPort = db.prepare('SELECT id FROM ports WHERE id = ?').get(b.fromPortId)
    const toPort = db.prepare('SELECT id FROM ports WHERE id = ?').get(b.toPortId)
    if (!fromPort || !toPort) {
      return reply.status(400).send({ error: 'Both cable endpoints must exist' })
    }

    const existing = db.prepare(`
      SELECT id
      FROM portLinks
      WHERE fromPortId IN (?, ?) OR toPortId IN (?, ?)
      LIMIT 1
    `).get(b.fromPortId, b.toPortId, b.fromPortId, b.toPortId)
    if (existing) {
      return reply.status(409).send({ error: 'One of the selected ports is already linked' })
    }

    const id = b.id ?? `l_${Date.now()}`
    db.prepare(
      'INSERT INTO portLinks (id, fromPortId, toPortId, cableType, cableLength, color, notes) VALUES (?,?,?,?,?,?,?)'
    ).run(id, b.fromPortId, b.toPortId, b.cableType ?? null, b.cableLength ?? null, b.color ?? null, b.notes ?? null)

    // Update link state on both ports
    db.prepare("UPDATE ports SET linkState = 'up' WHERE id = ? OR id = ?").run(b.fromPortId, b.toPortId)

    return reply.status(201).send(db.prepare('SELECT * FROM portLinks WHERE id = ?').get(id))
  })

  // PATCH /api/port-links/:id
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM portLinks WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'Port link not found' })

    const allowed = ['cableType', 'cableLength', 'color', 'notes'] as const
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
    db.prepare(`UPDATE portLinks SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM portLinks WHERE id = ?').get(req.params.id)
  })

  // DELETE /api/port-links/:id
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const link = db.prepare('SELECT * FROM portLinks WHERE id = ?').get(req.params.id) as
      { fromPortId: string; toPortId: string } | undefined
    if (!link) return reply.status(404).send({ error: 'Port link not found' })

    db.prepare('DELETE FROM portLinks WHERE id = ?').run(req.params.id)

    // Set ports to 'down' if they no longer appear in any link
    for (const portId of [link.fromPortId, link.toPortId]) {
      const stillLinked = db.prepare(
        'SELECT id FROM portLinks WHERE fromPortId = ? OR toPortId = ?'
      ).get(portId, portId)
      if (!stillLinked) {
        db.prepare("UPDATE ports SET linkState = 'down' WHERE id = ?").run(portId)
      }
    }

    return reply.status(204).send()
  })
}
