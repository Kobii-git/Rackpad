import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { db } from '../db.js'

export const USER_ROLES = ['admin', 'editor', 'viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface AuthUser {
  id: string
  username: string
  displayName: string
  role: UserRole
  disabled: boolean
  createdAt: string
  lastLoginAt?: string | null
}

interface SessionRow extends AuthUser {
  tokenHash: string
  expiresAt: string
  sessionId: string
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derived}`
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, expectedHex] = storedHash.split(':')
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false
  const actual = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'utf8')
  const expected = Buffer.from(expectedHex, 'utf8')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createSessionToken() {
  return randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createSession(userId: string) {
  const token = createSessionToken()
  const sessionId = `sess_${Date.now()}_${randomBytes(6).toString('hex')}`
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  db.prepare(
    'INSERT INTO userSessions (id, userId, tokenHash, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)'
  ).run(sessionId, userId, hashSessionToken(token), createdAt, expiresAt)

  return { token, expiresAt }
}

export function deleteSession(sessionId: string) {
  db.prepare('DELETE FROM userSessions WHERE id = ?').run(sessionId)
}

export function getPublicUserById(userId: string) {
  const row = db.prepare(`
    SELECT id, username, displayName, role, disabled, createdAt, lastLoginAt
    FROM users
    WHERE id = ?
  `).get(userId) as Record<string, unknown> | undefined

  if (!row) return null
  return parsePublicUser(row)
}

export function parsePublicUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.displayName),
    role: String(row.role) as UserRole,
    disabled: Number(row.disabled ?? 0) === 1,
    createdAt: String(row.createdAt),
    lastLoginAt: row.lastLoginAt ? String(row.lastLoginAt) : null,
  }
}

export function lookupSession(token: string) {
  const row = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.displayName,
      u.role,
      u.disabled,
      u.createdAt,
      u.lastLoginAt,
      s.id AS sessionId,
      s.tokenHash,
      s.expiresAt
    FROM userSessions s
    JOIN users u ON u.id = s.userId
    WHERE s.tokenHash = ?
  `).get(hashSessionToken(token)) as Record<string, unknown> | undefined

  if (!row) return null
  const session = {
    ...parsePublicUser(row),
    tokenHash: String(row.tokenHash),
    expiresAt: String(row.expiresAt),
    sessionId: String(row.sessionId),
  } satisfies SessionRow

  if (session.disabled) {
    deleteSession(session.sessionId)
    return null
  }

  if (Date.parse(session.expiresAt) <= Date.now()) {
    deleteSession(session.sessionId)
    return null
  }

  return session
}

export function getAuthToken(req: FastifyRequest) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token || null
}

export function needsBootstrap() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
  return row.count === 0
}

export function requireAuth(req: FastifyRequest, reply: FastifyReply): req is FastifyRequest & { authUser: AuthUser } {
  if (!req.authUser) {
    void reply.status(401).send({ error: 'Authentication required.' })
    return false
  }
  return true
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply): req is FastifyRequest & { authUser: AuthUser } {
  if (!requireAuth(req, reply)) return false
  if (req.authUser.role !== 'admin') {
    void reply.status(403).send({ error: 'Administrator access required.' })
    return false
  }
  return true
}

export function requireEditor(req: FastifyRequest, reply: FastifyReply): req is FastifyRequest & { authUser: AuthUser } {
  if (!requireAuth(req, reply)) return false
  if (req.authUser.role === 'viewer') {
    void reply.status(403).send({ error: 'Editor or administrator access required.' })
    return false
  }
  return true
}
