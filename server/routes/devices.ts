import type { FastifyPluginAsync } from 'fastify'
import { db, parseRow } from '../db.js'

const JSON_COLS = ['tags'] as const

function parseDevice(row: Record<string, unknown>) {
  return parseRow(row, [...JSON_COLS])
}

export const devicesRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/devices  (optional ?rackId=, ?labId=)
  app.get<{ Querystring: { rackId?: string; labId?: string } }>('/', async (req) => {
    let sql = 'SELECT * FROM devices WHERE 1=1'
    const params: unknown[] = []
    if (req.query.rackId) { sql += ' AND rackId = ?'; params.push(req.query.rackId) }
    if (req.query.labId)  { sql += ' AND labId = ?';  params.push(req.query.labId) }
    sql += ' ORDER BY hostname'
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map(parseDevice)
  })

  // GET /api/devices/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!row) return reply.status(404).send({ error: 'Device not found' })
    return parseDevice(row)
  })

  // POST /api/devices
  app.post<{ Body: Record<string, unknown> }>('/', async (req, reply) => {
    const b = req.body as {
      id?: string; labId: string; rackId?: string; hostname: string; displayName?: string
      deviceType: string; manufacturer?: string; model?: string; serial?: string
      managementIp?: string; status?: string; startU?: number; heightU?: number; face?: string
      tags?: string[]; notes?: string; lastSeen?: string
    }
    const id = b.id ?? `d_${Date.now()}`
    db.prepare(`
      INSERT INTO devices
        (id, labId, rackId, hostname, displayName, deviceType, manufacturer, model,
         serial, managementIp, status, startU, heightU, face, tags, notes, lastSeen)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, b.labId, b.rackId ?? null, b.hostname, b.displayName ?? null,
      b.deviceType, b.manufacturer ?? null, b.model ?? null,
      b.serial ?? null, b.managementIp ?? null, b.status ?? 'unknown',
      b.startU ?? null, b.heightU ?? null, b.face ?? null,
      b.tags ? JSON.stringify(b.tags) : null,
      b.notes ?? null, b.lastSeen ?? null
    )
    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as Record<string, unknown>
    return reply.status(201).send(parseDevice(row))
  })

  // PATCH /api/devices/:id
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/:id', async (req, reply) => {
    const existing = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'Device not found' })

    const allowed = ['rackId', 'hostname', 'displayName', 'deviceType', 'manufacturer', 'model',
      'serial', 'managementIp', 'status', 'startU', 'heightU', 'face', 'notes', 'lastSeen'] as const
    const updates: string[] = []
    const values: unknown[] = []
    for (const key of allowed) {
      if (key in req.body) {
        updates.push(`${key} = ?`)
        values.push((req.body as Record<string, unknown>)[key])
      }
    }
    // tags is a JSON array — serialize before storing
    if ('tags' in req.body) {
      updates.push('tags = ?')
      const t = (req.body as Record<string, unknown>).tags
      values.push(Array.isArray(t) ? JSON.stringify(t) : null)
    }
    if (updates.length === 0) return reply.status(400).send({ error: 'No valid fields to update' })
    values.push(req.params.id)
    db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Record<string, unknown>
    return parseDevice(row)
  })

  // DELETE /api/devices/:id
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const row = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id)
    if (!row) return reply.status(404).send({ error: 'Device not found' })

    const portIds = (
      db.prepare('SELECT id FROM ports WHERE deviceId = ?').all(req.params.id) as Array<{ id: string }>
    ).map((port) => port.id)

    const deleteDevice = db.transaction((deviceId: string, devicePortIds: string[]) => {
      if (devicePortIds.length > 0) {
        const placeholders = devicePortIds.map(() => '?').join(', ')
        db.prepare(
          `DELETE FROM ipAssignments WHERE deviceId = ? OR portId IN (${placeholders})`
        ).run(deviceId, ...devicePortIds)
      } else {
        db.prepare('DELETE FROM ipAssignments WHERE deviceId = ?').run(deviceId)
      }

      db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId)
    })

    deleteDevice(req.params.id, portIds)
    return reply.status(204).send()
  })
}
