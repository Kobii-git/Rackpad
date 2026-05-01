import { db } from './db.js'
import { createApp } from './app.js'
import { startMonitoringLoop } from './lib/monitoring.js'

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'
const MONITOR_INTERVAL_MS = Number.parseInt(process.env.MONITOR_INTERVAL_MS ?? '0', 10)

const app = await createApp()
const stopMonitoring = startMonitoringLoop(Number.isFinite(MONITOR_INTERVAL_MS) ? MONITOR_INTERVAL_MS : 0)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    stopMonitoring()
    await app.close()
    db.close()
    process.exit(0)
  })
}

try {
  await app.listen({ port: PORT, host: HOST })
  console.log(`[rackpad] Server listening on http://${HOST}:${PORT}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
