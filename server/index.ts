import Fastify from 'fastify'
import cors from '@fastify/cors'
import staticPlugin from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { db } from './db.js'
import { seedIfEmpty } from './seed.js'
import { racksRoutes } from './routes/racks.js'
import { devicesRoutes } from './routes/devices.js'
import { portsRoutes } from './routes/ports.js'
import { cablesRoutes } from './routes/cables.js'
import { vlansRoutes } from './routes/vlans.js'
import { ipamRoutes } from './routes/ipam.js'
import { auditRoutes } from './routes/audit.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '../dist')

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

// ── Seed on startup ──────────────────────────────────────────
seedIfEmpty()

// ── Fastify app ──────────────────────────────────────────────
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

// CORS — allow Vite dev server on :5173
await app.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? false
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
})

// ── API routes ───────────────────────────────────────────────
await app.register(racksRoutes,   { prefix: '/api/racks' })
await app.register(devicesRoutes, { prefix: '/api/devices' })
await app.register(portsRoutes,   { prefix: '/api/ports' })
await app.register(cablesRoutes,  { prefix: '/api/port-links' })
await app.register(vlansRoutes,   { prefix: '/api/vlans' })
await app.register(ipamRoutes,    { prefix: '/api' })
await app.register(auditRoutes,   { prefix: '/api/audit-log' })

// ── Serve built frontend (production) ────────────────────────
// Only register the static plugin if the dist/ folder exists.
// In dev the Vite dev server serves the frontend instead.
import { existsSync } from 'node:fs'
if (existsSync(DIST_DIR)) {
  await app.register(staticPlugin, {
    root: DIST_DIR,
    prefix: '/',
    // Don't throw when file not found — we handle it in the fallback below
    decorateReply: false,
  })

  // SPA fallback: any non-API GET that didn't match a static file
  // serves index.html so client-side routing works.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api/')) {
      return reply.sendFile('index.html', DIST_DIR)
    }
    reply.status(404).send({ error: 'Not found' })
  })
} else {
  // Dev mode: no static files, just return a helpful message for the root
  app.get('/', async () => ({ message: 'Rackpad API running. Frontend served by Vite on :5173' }))
}

// ── Graceful shutdown ────────────────────────────────────────
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close()
    db.close()
    process.exit(0)
  })
}

// ── Start ─────────────────────────────────────────────────────
try {
  await app.listen({ port: PORT, host: HOST })
  console.log(`[rackpad] Server listening on http://${HOST}:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
