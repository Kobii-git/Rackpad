import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db.js'
import { ensureDefaultLab, seedIfEmpty } from '../seed.js'
import {
  createSession,
  getAuthToken,
  getPublicUserById,
  hashPassword,
  lookupSession,
  needsBootstrap,
  parsePublicUser,
  verifyPassword,
} from '../lib/auth.js'
import { createId } from '../lib/ids.js'
import { asObject, optionalBoolean, optionalString, requiredString, ValidationError } from '../lib/validation.js'

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    return {
      needsBootstrap: needsBootstrap(),
    }
  })

  app.post('/bootstrap', async (req, reply) => {
    if (!needsBootstrap()) {
      return reply.status(409).send({ error: 'Initial account has already been created.' })
    }

    const body = asObject(req.body)
    const username = requiredString(body, 'username', { maxLength: 40 }).toLowerCase()
    const displayName = optionalString(body, 'displayName', { maxLength: 80 }) ?? username
    const password = requiredString(body, 'password', { maxLength: 200 })
    const loadDemoData = optionalBoolean(body, 'loadDemoData') ?? false

    if (password.length < 10) {
      throw new ValidationError('Password must be at least 10 characters long.')
    }

    const userId = createId('u')
    const createdAt = new Date().toISOString()
    db.prepare(`
      INSERT INTO users (id, username, displayName, passwordHash, role, disabled, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, 'admin', 0, ?, ?)
    `).run(userId, username, displayName, hashPassword(password), createdAt, createdAt)

    if (loadDemoData) {
      seedIfEmpty()
    } else {
      ensureDefaultLab()
    }

    const session = createSession(userId)
    const user = getPublicUserById(userId)

    return reply.status(201).send({
      token: session.token,
      expiresAt: session.expiresAt,
      user,
    })
  })

  app.post('/login', async (req, reply) => {
    const body = asObject(req.body)
    const username = requiredString(body, 'username', { maxLength: 40 }).toLowerCase()
    const password = requiredString(body, 'password', { maxLength: 200 })

    const row = db.prepare(`
      SELECT id, username, displayName, role, disabled, createdAt, lastLoginAt, passwordHash
      FROM users
      WHERE username = ?
    `).get(username) as (Record<string, unknown> & { passwordHash: string }) | undefined

    if (!row || Number(row.disabled ?? 0) === 1 || !verifyPassword(password, row.passwordHash)) {
      return reply.status(401).send({ error: 'Invalid username or password.' })
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE users SET lastLoginAt = ? WHERE id = ?').run(now, row.id)

    const session = createSession(String(row.id))
    const user = parsePublicUser({ ...row, lastLoginAt: now })

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user,
    }
  })

  app.get('/me', async (req, reply) => {
    const token = getAuthToken(req)
    if (!token) {
      return reply.status(401).send({ error: 'Authentication required.' })
    }

    const session = lookupSession(token)
    if (!session) {
      return reply.status(401).send({ error: 'Session expired or invalid.' })
    }

    return {
      user: getPublicUserById(session.id),
      expiresAt: session.expiresAt,
    }
  })

  app.post('/logout', async (req, reply) => {
    const token = getAuthToken(req)
    if (!token) {
      return reply.status(204).send()
    }
    const session = lookupSession(token)
    if (session) {
      db.prepare('DELETE FROM userSessions WHERE id = ?').run(session.sessionId)
    }
    return reply.status(204).send()
  })
}
