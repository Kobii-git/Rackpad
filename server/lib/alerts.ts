import { getJsonSetting, putJsonSetting } from './app-settings.js'

export interface AlertSettings {
  enabled: boolean
  notifyOnRecovery: boolean
  discordWebhookUrl: string | null
  telegramBotToken: string | null
  telegramChatId: string | null
}

export interface MonitorAlertPayload {
  hostname: string
  displayName?: string | null
  deviceType?: string | null
  managementIp?: string | null
  monitorName?: string | null
  monitorType: string
  target?: string | null
  result: 'online' | 'offline' | 'unknown'
  message: string
  checkedAt: string
}

const ALERT_SETTINGS_KEY = 'alertSettings'

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: false,
  notifyOnRecovery: true,
  discordWebhookUrl: null,
  telegramBotToken: null,
  telegramChatId: null,
}

export function loadAlertSettings() {
  const settings = getJsonSetting(ALERT_SETTINGS_KEY, DEFAULT_ALERT_SETTINGS)
  return normalizeAlertSettings(settings)
}

export function saveAlertSettings(value: Partial<AlertSettings>) {
  const next = normalizeAlertSettings({
    ...loadAlertSettings(),
    ...value,
  })
  putJsonSetting(ALERT_SETTINGS_KEY, next)
  return next
}

export async function sendTestAlert() {
  const settings = loadAlertSettings()
  if (!settings.enabled) {
    throw new Error('Enable notifications before sending a test alert.')
  }

  return dispatchAlert(
    settings,
    [
      'Rackpad test alert',
      '',
      'This confirms notification delivery is working for your v0.9 alert channels.',
      `Sent at: ${new Date().toISOString()}`,
    ].join('\n'),
  )
}

export async function sendMonitorTransitionAlert(
  previousResult: string | null | undefined,
  payload: MonitorAlertPayload,
) {
  const settings = loadAlertSettings()
  if (!settings.enabled) return

  const isRecovery = previousResult === 'offline' && payload.result === 'online'
  const isFailure = previousResult && previousResult !== 'offline' && payload.result === 'offline'

  if (!isFailure && !(isRecovery && settings.notifyOnRecovery)) {
    return
  }

  const heading = isRecovery ? 'Rackpad recovery alert' : 'Rackpad outage alert'
  const monitorLabel = payload.monitorName
    ? `${payload.monitorName} (${payload.monitorType}${payload.target ? ` -> ${payload.target}` : ''})`
    : `${payload.monitorType}${payload.target ? ` -> ${payload.target}` : ''}`
  const details = [
    heading,
    '',
    `${payload.hostname}${payload.displayName ? ` (${payload.displayName})` : ''}`,
    `Type: ${payload.deviceType ?? 'device'}`,
    `Monitor: ${monitorLabel}`,
    `Management IP: ${payload.managementIp ?? 'n/a'}`,
    `Result: ${payload.result}`,
    `Message: ${payload.message}`,
    `Checked at: ${payload.checkedAt}`,
  ]

  try {
    await dispatchAlert(settings, details.join('\n'))
  } catch (error) {
    console.error('[rackpad] failed to send alert notification', error)
  }
}

function normalizeAlertSettings(value: Partial<AlertSettings> | AlertSettings): AlertSettings {
  return {
    enabled: Boolean(value.enabled),
    notifyOnRecovery: value.notifyOnRecovery ?? true,
    discordWebhookUrl: normalizeText(value.discordWebhookUrl),
    telegramBotToken: normalizeText(value.telegramBotToken),
    telegramChatId: normalizeText(value.telegramChatId),
  }
}

function normalizeText(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim()
  return normalized || null
}

async function dispatchAlert(settings: AlertSettings, message: string) {
  const tasks: Promise<{ channel: string; delivered: boolean }>[] = []

  if (settings.discordWebhookUrl) {
    tasks.push(sendDiscordAlert(settings.discordWebhookUrl, message))
  }

  if (settings.telegramBotToken && settings.telegramChatId) {
    tasks.push(sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, message))
  }

  if (tasks.length === 0) {
    throw new Error('Configure at least one notification target first.')
  }

  const results = await Promise.all(tasks)
  return {
    delivered: results.some((result) => result.delivered),
    channels: results,
  }
}

async function sendDiscordAlert(webhookUrl: string, content: string) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`Discord webhook failed with status ${response.status}.`)
  }

  return { channel: 'discord', delivered: true }
}

async function sendTelegramAlert(botToken: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with status ${response.status}.`)
  }

  return { channel: 'telegram', delivered: true }
}
