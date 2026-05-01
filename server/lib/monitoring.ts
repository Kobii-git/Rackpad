import net from 'node:net'
import { db } from '../db.js'

export const MONITOR_TYPES = ['none', 'tcp', 'http', 'https'] as const
export type MonitorType = (typeof MONITOR_TYPES)[number]

export interface DeviceMonitor {
  id: string
  deviceId: string
  type: MonitorType
  target?: string | null
  port?: number | null
  path?: string | null
  intervalMs?: number | null
  enabled: boolean
  lastCheckAt?: string | null
  lastResult?: string | null
  lastMessage?: string | null
}

let intervalHandle: NodeJS.Timeout | null = null

export function parseMonitor(row: Record<string, unknown>): DeviceMonitor {
  return {
    id: String(row.id),
    deviceId: String(row.deviceId),
    type: String(row.type) as MonitorType,
    target: row.target ? String(row.target) : null,
    port: row.port == null ? null : Number(row.port),
    path: row.path ? String(row.path) : null,
    intervalMs: row.intervalMs == null ? null : Number(row.intervalMs),
    enabled: Number(row.enabled ?? 0) === 1,
    lastCheckAt: row.lastCheckAt ? String(row.lastCheckAt) : null,
    lastResult: row.lastResult ? String(row.lastResult) : null,
    lastMessage: row.lastMessage ? String(row.lastMessage) : null,
  }
}

export function listMonitors(deviceId?: string) {
  const rows = deviceId
    ? db.prepare('SELECT * FROM deviceMonitors WHERE deviceId = ? ORDER BY deviceId').all(deviceId)
    : db.prepare('SELECT * FROM deviceMonitors ORDER BY deviceId').all()
  return (rows as Record<string, unknown>[]).map(parseMonitor)
}

export function startMonitoringLoop(defaultIntervalMs: number) {
  if (defaultIntervalMs <= 0) return () => {}
  if (intervalHandle) clearInterval(intervalHandle)

  intervalHandle = setInterval(() => {
    void runDueChecks(defaultIntervalMs)
  }, defaultIntervalMs)
  intervalHandle.unref?.()

  return () => {
    if (intervalHandle) clearInterval(intervalHandle)
    intervalHandle = null
  }
}

export async function runDueChecks(defaultIntervalMs: number) {
  const monitors = listMonitors().filter((monitor) => monitor.enabled && monitor.type !== 'none')
  for (const monitor of monitors) {
    const dueEvery = monitor.intervalMs ?? defaultIntervalMs
    if (!monitor.lastCheckAt || Date.now() - Date.parse(monitor.lastCheckAt) >= dueEvery) {
      await runDeviceCheck(monitor.deviceId)
    }
  }
}

export async function runDeviceCheck(deviceId: string) {
  const row = db.prepare('SELECT * FROM deviceMonitors WHERE deviceId = ?').get(deviceId) as Record<string, unknown> | undefined
  if (!row) {
    return null
  }

  const monitor = parseMonitor(row)
  const checkedAt = new Date().toISOString()

  if (!monitor.enabled || monitor.type === 'none') {
    persistMonitorResult(monitor, {
      checkedAt,
      result: 'unknown',
      message: 'Health checks disabled.',
    })
    return parseMonitor(db.prepare('SELECT * FROM deviceMonitors WHERE deviceId = ?').get(deviceId) as Record<string, unknown>)
  }

  const result = await executeCheck(monitor)
  persistMonitorResult(monitor, { checkedAt, ...result })
  return parseMonitor(db.prepare('SELECT * FROM deviceMonitors WHERE deviceId = ?').get(deviceId) as Record<string, unknown>)
}

function persistMonitorResult(
  monitor: DeviceMonitor,
  payload: { checkedAt: string; result: 'online' | 'offline' | 'unknown'; message: string },
) {
  db.prepare(`
    UPDATE deviceMonitors
    SET lastCheckAt = ?, lastResult = ?, lastMessage = ?
    WHERE deviceId = ?
  `).run(payload.checkedAt, payload.result, payload.message, monitor.deviceId)

  const currentDevice = db.prepare('SELECT status FROM devices WHERE id = ?').get(monitor.deviceId) as { status?: string } | undefined
  if (!currentDevice) return

  if (currentDevice.status === 'maintenance') {
    if (payload.result === 'online') {
      db.prepare('UPDATE devices SET lastSeen = ? WHERE id = ?').run(payload.checkedAt, monitor.deviceId)
    }
    return
  }

  if (payload.result === 'online') {
    db.prepare('UPDATE devices SET status = ?, lastSeen = ? WHERE id = ?').run('online', payload.checkedAt, monitor.deviceId)
    return
  }

  if (payload.result === 'offline') {
    db.prepare('UPDATE devices SET status = ? WHERE id = ?').run('offline', monitor.deviceId)
  }
}

async function executeCheck(monitor: DeviceMonitor) {
  try {
    if (!monitor.target) {
      return { result: 'unknown' as const, message: 'No target configured.' }
    }

    if (monitor.type === 'tcp') {
      const port = monitor.port ?? 22
      return tcpCheck(monitor.target, port)
    }

    if (monitor.type === 'http' || monitor.type === 'https') {
      const port = monitor.port ?? (monitor.type === 'https' ? 443 : 80)
      const path = monitor.path?.trim() || '/'
      const url = new URL(`${monitor.type}://${monitor.target}:${port}${path.startsWith('/') ? path : `/${path}`}`)
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) {
        return { result: 'offline' as const, message: `${url} returned ${res.status}.` }
      }
      return { result: 'online' as const, message: `${url} returned ${res.status}.` }
    }

    return { result: 'unknown' as const, message: 'Unknown check type.' }
  } catch (error) {
    return {
      result: 'offline' as const,
      message: error instanceof Error ? error.message : 'Health check failed.',
    }
  }
}

function tcpCheck(host: string, port: number) {
  return new Promise<{ result: 'online' | 'offline'; message: string }>((resolve, reject) => {
    const socket = net.connect({ host, port })
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve({
        result: 'offline',
        message: `TCP ${host}:${port} timed out from the Rackpad server.`,
      })
    }, 5000)

    socket.once('connect', () => {
      clearTimeout(timeout)
      socket.end()
      resolve({
        result: 'online',
        message: `TCP ${host}:${port} reachable.`,
      })
    })

    socket.once('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout)
      socket.destroy()
      if (error.code === 'ECONNREFUSED') {
        resolve({
          result: 'online',
          message: `Host ${host} is reachable, but TCP ${port} refused the connection.`,
        })
        return
      }
      if (error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH') {
        resolve({
          result: 'offline',
          message: `TCP ${host}:${port} is unreachable from the Rackpad server.`,
        })
        return
      }
      reject(error)
    })
  })
}
