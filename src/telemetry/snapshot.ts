import { checksumWorld } from '../simulation/checksum'
import type { WorldState } from '../simulation/types'
import {
  TELEMETRY_PROTOCOL_VERSION,
  type SnapshotMessageV1,
} from './protocol'

export interface SnapshotMessageMetadataV1 {
  sequenceNumber: number
  scheduledDeliveryTimeMilliseconds: number
}

function assertNonNegativeSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`)
  }
}

/**
 * Copies authoritative simulation state into a JSON-safe protocol snapshot.
 * No typed arrays or mutable simulation objects are retained by the message.
 */
export function createSnapshotMessageV1(
  world: WorldState,
  metadata: SnapshotMessageMetadataV1,
): SnapshotMessageV1 {
  assertNonNegativeSafeInteger('sequenceNumber', metadata.sequenceNumber)
  assertNonNegativeSafeInteger(
    'scheduledDeliveryTimeMilliseconds',
    metadata.scheduledDeliveryTimeMilliseconds,
  )

  const cells = Array.from({ length: world.cellCount }, (_, cellId) => ({
    cellId,
    surfaceFuelLoadGramsPerSquareMeter:
      world.current.surfaceFuelLoadGramsPerSquareMeter[cellId],
    fuelMoisturePermille: world.current.fuelMoisturePermille[cellId],
    temperatureDeciCelsius: world.current.temperatureDeciCelsius[cellId],
    smokeDensityIndex: world.current.smokeDensityIndex[cellId],
    fireIntensityIndex: world.current.fireIntensityIndex[cellId],
  }))

  return {
    protocolVersion: TELEMETRY_PROTOCOL_VERSION,
    sequenceNumber: metadata.sequenceNumber,
    simulationTick: world.tick,
    scheduledDeliveryTimeMilliseconds:
      metadata.scheduledDeliveryTimeMilliseconds,
    authoritativeWorldChecksum: checksumWorld(world),
    kind: 'snapshot',
    snapshot: {
      dimensions: {
        width: world.dimensions.width,
        height: world.dimensions.height,
      },
      fuelBedCodeByCellId: Array.from(world.terrain.fuelBedCode),
      cells,
      sensors: world.sensors.map((sensor) => ({
        sensorId: sensor.id,
        cellId: sensor.cellId,
        kind: sensor.kind,
        status: sensor.status,
      })),
      wind: { ...world.wind },
    },
  }
}

/**
 * Serializes every field in a prescribed order instead of relying on the
 * insertion history of objects supplied by a caller.
 */
export function serializeSnapshotMessageV1(
  message: SnapshotMessageV1,
): string {
  return JSON.stringify({
    protocolVersion: message.protocolVersion,
    kind: message.kind,
    sequenceNumber: message.sequenceNumber,
    simulationTick: message.simulationTick,
    scheduledDeliveryTimeMilliseconds:
      message.scheduledDeliveryTimeMilliseconds,
    authoritativeWorldChecksum: message.authoritativeWorldChecksum,
    snapshot: {
      dimensions: {
        width: message.snapshot.dimensions.width,
        height: message.snapshot.dimensions.height,
      },
      fuelBedCodeByCellId: [...message.snapshot.fuelBedCodeByCellId],
      cells: message.snapshot.cells.map((cell) => ({
        cellId: cell.cellId,
        surfaceFuelLoadGramsPerSquareMeter:
          cell.surfaceFuelLoadGramsPerSquareMeter,
        fuelMoisturePermille: cell.fuelMoisturePermille,
        temperatureDeciCelsius: cell.temperatureDeciCelsius,
        smokeDensityIndex: cell.smokeDensityIndex,
        fireIntensityIndex: cell.fireIntensityIndex,
      })),
      sensors: message.snapshot.sensors.map((sensor) => ({
        sensorId: sensor.sensorId,
        cellId: sensor.cellId,
        kind: sensor.kind,
        status: sensor.status,
      })),
      wind: {
        direction: message.snapshot.wind.direction,
        speedCentimetersPerSecond:
          message.snapshot.wind.speedCentimetersPerSecond,
      },
    },
  })
}

