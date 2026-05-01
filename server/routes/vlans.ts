import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'

export const vlansRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/vlans  (optional ?labId=)
  app.get<{ Querystring: { labId?: string } }>('/', async (req) => {
    if (req.query.labId) {
      return db.prepare('SELECT * FROM vlans WHERE labId = ? ORDER BY vlanId').all(req.query.labId)
    }
    return db.prepare('SELECT * FROM vlans ORDER BY vlanId').all()
  })

  // GET /api/vlans/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM vlans WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'VLAN not found' })
    return row
  })

  // POST /api/vlans
  app.post<{ Body: Record<string, unknown> }>('/', async (req, reply) => {
    const b = req.body as {
      id?: string; labId: string; vlanId: number; name: string
      description?: string; color?: string
    }
    const id = b.id ?? `v_${Date.now()}`
    db.prepare(
      'INSERT INTO vlans (id, labId, vlanId, name, description, color) VALUES (?,?,?,?,?,?)'
    ).run(id, b.labId, b.vlanId, b.name, b.description ?? null, b.color ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM vlans WHERE id = ?').get(id))
  })

  // PATCH /api/vlans/:id
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM vlans WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'VLAN not found' })

    const allowed = ['vlanId', 'name', 'description', 'color'] as const
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
    db.prepare(`UPDATE vlans SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return db.prepare('SELECT * FROM vlans WHERE id = ?').get(req.params.id)
  })

  // DELETE /api/vlans/:id
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT id FROM vlans WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'VLAN not found' })
    db.prepare('DELETE FROM vlans WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  // ── VLAN Ranges ───────────────────────────────────────────────

  // GET /api/vlan-ranges
  app.get('/ranges', async (req) => {
    const labId = (req.query as { labId?: string }).labId
    if (labId) {
      return db.prepare('SELECT * FROM vlanRanges WHERE labId = ? ORDER BY startVlan').all(labId)
    }
    return db.prepare('SELECT * FROM vlanRanges ORDER BY startVlan').all()
  })

  // POST /api/vlan-ranges
  app.post<{ Body: Record<string, unknown> }>('/ranges', async (req, reply) => {
    const b = req.body as {
      id?: string; labId: string; name: string; startVlan: number; endVlan: number
      purpose?: string; color?: string
    }
    const id = b.id ?? `vr_${Date.now()}`
    db.prepare(
      'INSERT INTO vlanRanges (id, labId, name, startVlan, endVlan, purpose, color) VALUES (?,?,?,?,?,?,?)'
    ).run(id, b.labId, b.name, b.startVlan, b.endVlan, b.purpose ?? null, b.color ?? null)
    return reply.status(201).send(db.prepare('SELECT * FROM vlanRanges WHERE id = ?').get(id))
  })

  // DELETE /api/vlan-ranges/:id
  app.delete<{ Params: { id: string } }>('/ranges/:id', async (req, reply) => {
    const row = db.prepare('SELECT id FROM vlanRanges WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'VLAN range not found' })
    db.prepare('DELETE FROM vlanRanges WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })
}
