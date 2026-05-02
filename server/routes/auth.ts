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
  setBootstrapState,
  verifyPassword,
} from '../lib/auth.js'
import { createId } from '../lib/ids.js'
import { asObject, optionalBoolean, optionalString, requiredString, ValidationError } from '../lib/validation.js'

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_LOGIN_ATTEMPTS = 8
const loginAttempts = new Map<string, { count: number; windowStartedAt: number; blockedUntil: number | null }>()

function writeAuthAudit(action: string, actor: string, entityId: string, summary: string) {
  db.prepare(`
    INSERT INTO auditLog (id, ts, user, action, entityType, entityId, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('a'),
    new Date().toISOString(),
    actor,
    action,
    'Session',
    entityId,
    summary,
  )
}

function getAuthRateLimitKey(ipAddress: string) {
  return ipAddress || 'unknown'
}

function getBlockedUntil(key: string) {
  const entry = loginAttempts.get(key)
  if (!entry) return null
  if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
    return entry.blockedUntil
  }
  if (entry.blockedUntil && entry.blockedUntil <= Date.now()) {
    loginAttempts.delete(key)
  }
  return null
}

function recordFailedAttempt(key: string) {
  const now = Date.now()
  const current = loginAttempts.get(key)
  if (!current || now - current.windowStartedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStartedAt: now, blockedUntil: null })
    return
  }

  const nextCount = current.count + 1
  const blockedUntil = nextCount >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_WINDOW_MS : null
  loginAttempts.set(key, {
    count: nextCount,
    windowStartedAt: current.windowStartedAt,
    blockedUntil,
  })
}

function clearFailedAttempts(key: string) {
  loginAttempts.delete(key)
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    return {
      needsBootstrap: needsBootstrap(),
    }
  })

  app.post('/bootstrap', async (req, reply) => {
    const rateLimitKey = getAuthRateLimitKey(req.ip)
    const blockedUntil = getBlockedUntil(rateLimitKey)
    if (blockedUntil) {
      return reply.status(429).send({ error: `Too many setup attempts. Try again after ${new Date(blockedUntil).toLocaleTimeString()}.` })
    }

    if (!needsBootstrap()) {
      return reply.status(409).send({ error: 'Initial account has already been created.' })
    }

    const body = asObject(req.body)
    const username = requiredString(body, 'username', { maxLength: 40 }).toLowerCase()
    const displayName = optionalString(body, 'displayName', { maxLength: 80 }) ?? username
    const password = requiredString(body, 'password', { maxLength: 200 })
    const loadDemoData = optionalBoolean(body, 'loadDemoData') ?? false

    if (password.length < 10) {
      recordFailedAttempt(rateLimitKey)
      throw new ValidationError('Password must be at least 10 characters long.')
    }

    const userId = createId('u')
    const createdAt = new Date().toISOString()
    db.prepare(`
      INSERT INTO users (id, username, displayName, passwordHash, role, disabled, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, 'admin', 0, ?, ?)
    `).run(userId, username, displayName, hashPassword(password), createdAt, createdAt)
    setBootstrapState(false)

    if (loadDemoData) {
      seedIfEmpty()
    } else {
      ensureDefaultLab()
    }

    const session = createSession(userId)
    const user = getPublicUserById(userId)
    clearFailedAttempts(rateLimitKey)
    writeAuthAudit(
      'auth.bootstrap',
      username,
      userId,
      `Created the initial admin account and ${loadDemoData ? 'loaded demo data' : 'started with an empty workspace'}.`,
    )

    return reply.status(201).send({
      token: session.token,
      expiresAt: session.expiresAt,
      user,
    })
  })

  app.post('/login', async (req, reply) => {
    const rateLimitKey = getAuthRateLimitKey(req.ip)
    const blockedUntil = getBlockedUntil(rateLimitKey)
    if (blockedUntil) {
      return reply.status(429).send({ error: `Too many login attempts. Try again after ${new Date(blockedUntil).toLocaleTimeString()}.` })
    }

    const body = asObject(req.body)
    const username = requiredString(body, 'username', { maxLength: 40 }).toLowerCase()
    const password = requiredString(body, 'password', { maxLength: 200 })

    const row = db.prepare(`
      SELECT id, username, displayName, role, disabled, createdAt, lastLoginAt, passwordHash
      FROM users
      WHERE username = ?
    `).get(username) as (Record<string, unknown> & { passwordHash: string }) | undefined

    if (!row || Number(row.disabled ?? 0) === 1 || !verifyPassword(password, row.passwordHash)) {
      recordFailedAttempt(rateLimitKey)
      return reply.status(401).send({ error: 'Invalid username or password.' })
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE users SET lastLoginAt = ? WHERE id = ?').run(now, row.id)

    const session = createSession(String(row.id))
    const user = parsePublicUser({ ...row, lastLoginAt: now })
    clearFailedAttempts(rateLimitKey)
    writeAuthAudit('auth.login', user.username, user.id, 'Signed in to Rackpad.')

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
      writeAuthAudit('auth.logout', session.username, session.id, 'Signed out of Rackpad.')
    }
    return reply.status(204).send()
  })
}
