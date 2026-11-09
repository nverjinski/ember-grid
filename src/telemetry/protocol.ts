import type {
  GridDimensions,
  SensorKind,
  SensorStatus,
  WindDirection,
} from '../simulation/types'

export const TELEMETRY_PROTOCOL_VERSION = 1 as const

export interface TelemetryMessageHeaderV1 {
  protocolVersion: typeof TELEMETRY_PROTOCOL_VERSION
  /** Monotonic message identity within one trace, starting at zero. */
  sequenceNumber: number
  /** Authoritative simulation tick represented by this message. */
  simulationTick: number
  /** Intended delivery offset from replay start, never a wall-clock timestamp. */
  scheduledDeliveryOffsetMicroseconds: number
  /** Checksum of authoritative state after this message's data is applied. */
  authoritativeWorldChecksum: string
}

export interface CellStateV1 {
  cellId: number
  surfaceFuelLoadGramsPerSquareMeter: number
  fuelMoisturePermille: number
  temperatureDeciCelsius: number
  smokeDensityIndex: number
  fireIntensityIndex: number
}

export interface SensorStateV1 {
  sensorId: number
  cellId: number
  kind: SensorKind
  status: SensorStatus
}

export interface WindStateV1 {
  direction: WindDirection
  speedCentimetersPerSecond: number
}

export interface WorldSnapshotV1 {
  dimensions: GridDimensions
  /** Index is the stable cell ID; value indexes the fuel-bed profile table. */
  fuelBedCodeByCellId: readonly number[]
  cells: readonly CellStateV1[]
  sensors: readonly SensorStateV1[]
  wind: WindStateV1
}

export interface SnapshotMessageV1 extends TelemetryMessageHeaderV1 {
  kind: 'snapshot'
  snapshot: WorldSnapshotV1
}

export interface CellUpdateV1 extends CellStateV1 {
  entityType: 'cell'
}

export interface SensorUpdateV1 extends SensorStateV1 {
  entityType: 'sensor'
}

export interface WindUpdateV1 extends WindStateV1 {
  entityType: 'wind'
}

export type EntityUpdateV1 = CellUpdateV1 | SensorUpdateV1 | WindUpdateV1

export interface DeltaMessageV1 extends TelemetryMessageHeaderV1 {
  kind: 'delta'
  /** Zero-based position among all delta messages for this simulation tick. */
  tickBatchIndex: number
  /** Total delta-message count for this simulation tick. */
  tickBatchCount: number
  updates: readonly EntityUpdateV1[]
}

export type TelemetryMessageV1 = SnapshotMessageV1 | DeltaMessageV1

