import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { hashPassword, parsePublicUser, requireAdmin, USER_ROLES } from '../lib/auth.js'
import { createId } from '../lib/ids.js'
import {
  asObject,
  optionalBoolean,
  optionalString,
  requiredEnum,
  requiredString,
  ValidationError,
} from '../lib/validation.js'

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const rows = db.prepare(`
      SELECT id, username, displayName, role, disabled, createdAt, lastLoginAt
      FROM users
      ORDER BY username
    `).all() as Record<string, unknown>[]
    return rows.map(parsePublicUser)
  })

  app.post('/', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = asObject(req.body)
    const username = requiredString(body, 'username', { maxLength: 40 }).toLowerCase()
    const displayName = optionalString(body, 'displayName', { maxLength: 80 }) ?? username
    const password = requiredString(body, 'password', { maxLength: 200 })
    const role = requiredEnum(body, 'role', USER_ROLES)
    const disabled = optionalBoolean(body, 'disabled') ?? false

    if (password.length < 10) {
      throw new ValidationError('Password must be at least 10 characters long.')
    }

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (exists) {
      return reply.status(409).send({ error: 'Username already exists.' })
    }

    const id = createId('u')
    const createdAt = new Date().toISOString()
    db.prepare(`
      INSERT INTO users (id, username, displayName, passwordHash, role, disabled, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(id, username, displayName, hashPassword(password), role, disabled ? 1 : 0, createdAt)

    const row = db.prepare(`
      SELECT id, username, displayName, role, disabled, createdAt, lastLoginAt
      FROM users
      WHERE id = ?
    `).get(id) as Record<string, unknown>

    return reply.status(201).send(parsePublicUser(row))
  })

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
    if (!existing) {
      return reply.status(404).send({ error: 'User not found.' })
    }

    const body = asObject(req.body)
    const updates: string[] = []
    const values: unknown[] = []

    const username = optionalString(body, 'username', { maxLength: 40 })
    if (username !== undefined) {
      const normalized = username?.toLowerCase()
      if (normalized) {
        const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(normalized, req.params.id)
        if (conflict) {
          return reply.status(409).send({ error: 'Username already exists.' })
        }
      }
      updates.push('username = ?')
      values.push(normalized)
    }

    const displayName = optionalString(body, 'displayName', { maxLength: 80 })
    if (displayName !== undefined) {
      updates.push('displayName = ?')
      values.push(displayName)
    }

    if ('role' in body) {
      updates.push('role = ?')
      values.push(requiredEnum(body, 'role', USER_ROLES))
    }

    const disabled = optionalBoolean(body, 'disabled')
    if (disabled !== undefined) {
      updates.push('disabled = ?')
      values.push(disabled ? 1 : 0)
    }

    if ('password' in body) {
      const password = requiredString(body, 'password', { maxLength: 200 })
      if (password.length < 10) {
        throw new ValidationError('Password must be at least 10 characters long.')
      }
      updates.push('passwordHash = ?')
      values.push(hashPassword(password))
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No valid fields to update.' })
    }

    values.push(req.params.id)
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const row = db.prepare(`
      SELECT id, username, displayName, role, disabled, createdAt, lastLoginAt
      FROM users
      WHERE id = ?
    `).get(req.params.id) as Record<string, unknown>

    return parsePublicUser(row)
  })

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
    if (!existing) {
      return reply.status(404).send({ error: 'User not found.' })
    }

    if (req.authUser.id === req.params.id) {
      return reply.status(400).send({ error: 'You cannot delete your own account.' })
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })
}
