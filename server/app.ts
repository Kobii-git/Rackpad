import Fastify from 'fastify'
import cors from '@fastify/cors'
import staticPlugin from '@fastify/static'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { authRoutes } from './routes/auth.js'
import { usersRoutes } from './routes/users.js'
import { labsRoutes } from './routes/labs.js'
import { racksRoutes } from './routes/racks.js'
import { devicesRoutes } from './routes/devices.js'
import { portsRoutes } from './routes/ports.js'
import { cablesRoutes } from './routes/cables.js'
import { vlansRoutes } from './routes/vlans.js'
import { ipamRoutes } from './routes/ipam.js'
import { auditRoutes } from './routes/audit.js'
import { monitoringRoutes } from './routes/monitoring.js'
import { adminRoutes } from './routes/admin.js'
import { discoveryRoutes } from './routes/discovery.js'
import { wifiRoutes } from './routes/wifi.js'
import { getAuthToken, lookupSession, needsBootstrap } from './lib/auth.js'
import { ValidationError } from './lib/validation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '../dist')

export async function createApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'production'
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
  })

  app.decorateRequest('authUser', null)
  app.decorateRequest('sessionId', null)

  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  })

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Frame-Options', 'DENY')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('Cross-Origin-Opener-Policy', 'same-origin')
    reply.header('Cross-Origin-Resource-Policy', 'same-origin')
    reply.header('X-DNS-Prefetch-Control', 'off')
    reply.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
    if ((req.headers['x-forwarded-proto'] ?? '').toString().includes('https')) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    return payload
  })

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ValidationError) {
      reply.status(error.statusCode).send({ error: error.message })
      return
    }

    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      reply.status(409).send({ error: 'That record conflicts with an existing value.' })
      return
    }

    // A referenced FK record (labId, subnetId, etc.) does not exist.
    if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) {
      reply.status(422).send({ error: 'A referenced record does not exist.' })
      return
    }

    // Catches any NOT NULL violation that slips past route-level guards.
    if (error instanceof Error && /NOT NULL constraint failed/i.test(error.message)) {
      reply.status(400).send({ error: 'A required field is missing.' })
      return
    }

    reply.status(500).send({ error: 'Internal server error.' })
  })

  app.get('/api/health', async () => ({ ok: true }))

  const publicPaths = new Set([
    '/api/health',
    '/api/auth/status',
    '/api/auth/bootstrap',
    '/api/auth/login',
  ])
  const readOnlyMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
  const writeWhitelist = new Set(['/api/auth/logout'])

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return
    const urlPath = req.url.split('?')[0]
    if (publicPaths.has(urlPath)) return

    if (needsBootstrap()) {
      return reply.status(503).send({ error: 'Authentication is not configured yet. Create the initial admin account first.' })
    }

    const token = getAuthToken(req)
    if (!token) {
      return reply.status(401).send({ error: 'Authentication required.' })
    }

    const session = lookupSession(token)
    if (!session) {
      return reply.status(401).send({ error: 'Session expired or invalid.' })
    }

    req.authUser = session
    req.sessionId = session.sessionId

    const method = req.method.toUpperCase()

    if (!readOnlyMethods.has(method) && !writeWhitelist.has(urlPath) && req.authUser.role === 'viewer') {
      return reply.status(403).send({ error: 'Viewer accounts are read-only.' })
    }
  })

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(usersRoutes, { prefix: '/api/users' })
  await app.register(labsRoutes, { prefix: '/api/labs' })
  await app.register(racksRoutes, { prefix: '/api/racks' })
  await app.register(devicesRoutes, { prefix: '/api/devices' })
  await app.register(portsRoutes, { prefix: '/api/ports' })
  await app.register(cablesRoutes, { prefix: '/api/port-links' })
  await app.register(vlansRoutes, { prefix: '/api/vlans' })
  await app.register(ipamRoutes, { prefix: '/api' })
  await app.register(auditRoutes, { prefix: '/api/audit-log' })
  await app.register(monitoringRoutes, { prefix: '/api/device-monitors' })
  await app.register(discoveryRoutes, { prefix: '/api/discovery' })
  await app.register(wifiRoutes, { prefix: '/api/wifi' })
  await app.register(adminRoutes, { prefix: '/api/admin' })

  if (existsSync(DIST_DIR)) {
    await app.register(staticPlugin, {
      root: DIST_DIR,
      prefix: '/',
      decorateReply: false,
    })

    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        return reply.sendFile('index.html', DIST_DIR)
      }
      reply.status(404).send({ error: 'Not found' })
    })
  } else {
    app.get('/', async () => ({ message: 'Rackpad API running. Frontend served by Vite on :5173' }))
  }

  return app
}
