import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { createId } from '../lib/ids.js'
import { requireAuth } from '../lib/auth.js'
import { asObject, parseLimit, requiredString } from '../lib/validation.js'

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { entityId?: string; entityType?: string; limit?: string } }>('/', async (req) => {
    let sql = 'SELECT * FROM auditLog WHERE 1=1'
    const params: unknown[] = []
    if (req.query.entityId) { sql += ' AND entityId = ?'; params.push(req.query.entityId) }
    if (req.query.entityType) { sql += ' AND entityType = ?'; params.push(req.query.entityType) }
    sql += ' ORDER BY ts DESC'
    sql += ` LIMIT ${parseLimit(req.query.limit, 100, 500)}`
    return db.prepare(sql).all(...params)
  })

  app.post('/', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const body = asObject(req.body)
    const id = createId('a')
    const ts = new Date().toISOString()
    const action = requiredString(body, 'action', { maxLength: 120 })
    const entityType = requiredString(body, 'entityType', { maxLength: 120 })
    const entityId = requiredString(body, 'entityId', { maxLength: 120 })
    const summary = requiredString(body, 'summary', { maxLength: 500 })
    const user = req.authUser.username

    db.prepare(
      'INSERT INTO auditLog (id, ts, user, action, entityType, entityId, summary) VALUES (?,?,?,?,?,?,?)'
    ).run(id, ts, user, action, entityType, entityId, summary)
    return reply.status(201).send(db.prepare('SELECT * FROM auditLog WHERE id = ?').get(id))
  })
}
