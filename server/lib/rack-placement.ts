import { db } from '../db.js'
import { ValidationError } from './validation.js'

interface RackPlacementInput {
  rackId?: string | null
  startU?: number | null
  heightU?: number | null
  face?: string | null
  deviceId?: string
}

export function validateRackPlacement(input: RackPlacementInput) {
  if (!input.rackId) {
    return {
      rackId: null,
      startU: null,
      heightU: null,
      face: null,
    }
  }

  const rack = db.prepare('SELECT id, totalU FROM racks WHERE id = ?').get(input.rackId) as
    | { id: string; totalU: number }
    | undefined

  if (!rack) {
    throw new ValidationError('Selected rack does not exist.')
  }

  if (!Number.isInteger(input.startU)) {
    throw new ValidationError('Start U is required when a device is placed in a rack.')
  }

  const heightU = Number.isInteger(input.heightU) ? input.heightU! : 1
  if (heightU < 1) {
    throw new ValidationError('Height U must be at least 1.')
  }

  const startU = input.startU!
  if (startU < 1) {
    throw new ValidationError('Start U must be at least 1.')
  }

  const endU = startU + heightU - 1
  if (endU > rack.totalU) {
    throw new ValidationError(`Device would exceed rack height ${rack.totalU}U.`)
  }

  const face = input.face ?? 'front'
  if (!['front', 'rear'].includes(face)) {
    throw new ValidationError('Rack face must be front or rear.')
  }

  const overlaps = db.prepare(`
    SELECT id, hostname, startU, heightU
    FROM devices
    WHERE rackId = ?
      AND COALESCE(face, 'front') = ?
      AND startU IS NOT NULL
      AND heightU IS NOT NULL
      AND id != COALESCE(?, '')
  `).all(input.rackId, face, input.deviceId ?? null) as Array<{
    id: string
    hostname: string
    startU: number
    heightU: number
  }>

  for (const device of overlaps) {
    const deviceEnd = device.startU + device.heightU - 1
    const intersects = !(endU < device.startU || startU > deviceEnd)
    if (intersects) {
      throw new ValidationError(`Rack position overlaps with ${device.hostname}.`)
    }
  }

  return {
    rackId: input.rackId,
    startU,
    heightU,
    face,
  }
}
