import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'

export const auditRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/audit-log  (optional ?entityId=, ?entityType=, ?limit=50)
  app.get<{ Querystring: { entityId?: string; entityType?: string; limit?: string } }>('/', async (req) => {
    let sql = 'SELECT * FROM auditLog WHERE 1=1'
    const params: unknown[] = []
    if (req.query.entityId)   { sql += ' AND entityId = ?';   params.push(req.query.entityId) }
    if (req.query.entityType) { sql += ' AND entityType = ?'; params.push(req.query.entityType) }
    sql += ' ORDER BY ts DESC'
    const limit = Math.min(parseInt(req.query.limit ?? '100', 10), 500)
    sql += ` LIMIT ${limit}`
    return db.prepare(sql).all(...params)
  })

  // POST /api/audit-log  (write a new entry)
  app.post<{ Body: Record<string, unknown> }>('/', async (req, reply) => {
    const b = req.body as {
      id?: string; ts?: string; user: string; action: string
      entityType: string; entityId: string; summary: string
    }
    const id = b.id ?? `a_${Date.now()}`
    const ts = b.ts ?? new Date().toISOString()
    db.prepare(
      'INSERT INTO auditLog (id, ts, user, action, entityType, entityId, summary) VALUES (?,?,?,?,?,?,?)'
    ).run(id, ts, b.user, b.action, b.entityType, b.entityId, b.summary)
    return reply.status(201).send(db.prepare('SELECT * FROM auditLog WHERE id = ?').get(id))
  })
}
