import { db } from '../db.js'

export function getJsonSetting<T>(key: string, fallback: T): T {
  const row = db.prepare('SELECT value FROM appSettings WHERE key = ?').get(key) as { value?: string } | undefined
  if (!row?.value) return fallback

  try {
    return {
      ...fallback,
      ...(JSON.parse(row.value) as Record<string, unknown>),
    } as T
  } catch {
    return fallback
  }
}

export function putJsonSetting(key: string, value: unknown) {
  db.prepare(`
    INSERT INTO appSettings (key, value, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE
      SET value = excluded.value, updatedAt = excluded.updatedAt
  `).run(key, JSON.stringify(value), new Date().toISOString())
}
