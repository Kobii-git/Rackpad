import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { requireAuth } from '../lib/auth.js'
import { createId } from '../lib/ids.js'
import { listMonitors, MONITOR_TYPES, runDeviceCheck } from '../lib/monitoring.js'
import {
  asObject,
  optionalBoolean,
  optionalEnum,
  optionalInteger,
  optionalString,
  ValidationError,
} from '../lib/validation.js'

export const monitoringRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const query = req.query as { deviceId?: string }
    return listMonitors(query.deviceId)
  })

  app.put<{ Params: { deviceId: string } }>('/:deviceId', async (req, reply) => {
    if (!requireAuth(req, reply)) return

    const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.deviceId)
    if (!device) {
      return reply.status(404).send({ error: 'Device not found.' })
    }

    const body = asObject(req.body)
    const type = optionalEnum(body, 'type', MONITOR_TYPES) ?? 'none'
    const target = optionalString(body, 'target', { maxLength: 200 })
    const path = optionalString(body, 'path', { maxLength: 200 })
    const port = optionalInteger(body, 'port', { min: 1, max: 65535 })
    const intervalMs = optionalInteger(body, 'intervalMs', { min: 1000, max: 1000 * 60 * 60 * 24 })
    const requestedEnabled = optionalBoolean(body, 'enabled')
    const enabled = type === 'none' ? false : (requestedEnabled ?? true)

    if (type !== 'none' && !target) {
      throw new ValidationError('Target is required when health checks are enabled.')
    }

    const existing = db.prepare('SELECT id FROM deviceMonitors WHERE deviceId = ?').get(req.params.deviceId) as { id: string } | undefined
    if (existing) {
      db.prepare(`
        UPDATE deviceMonitors
        SET type = ?, target = ?, port = ?, path = ?, intervalMs = ?, enabled = ?
        WHERE deviceId = ?
      `).run(type, target ?? null, port ?? null, path ?? null, intervalMs ?? null, enabled ? 1 : 0, req.params.deviceId)
    } else {
      db.prepare(`
        INSERT INTO deviceMonitors (id, deviceId, type, target, port, path, intervalMs, enabled, lastCheckAt, lastResult, lastMessage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
      `).run(createId('mon'), req.params.deviceId, type, target ?? null, port ?? null, path ?? null, intervalMs ?? null, enabled ? 1 : 0)
    }

    return listMonitors(req.params.deviceId)[0] ?? null
  })

  app.post('/run', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const monitors = listMonitors().filter((monitor) => monitor.enabled)
    const results = []
    for (const monitor of monitors) {
      const result = await runDeviceCheck(monitor.deviceId)
      if (result) results.push(result)
    }
    return { results }
  })

  app.post<{ Params: { deviceId: string } }>('/run/:deviceId', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const result = await runDeviceCheck(req.params.deviceId)
    if (!result) {
      return reply.status(404).send({ error: 'Device monitor not found.' })
    }
    return result
  })
}
