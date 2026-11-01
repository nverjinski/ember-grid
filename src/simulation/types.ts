export const CELL_VALUE_MAX = 1_000

export interface GridDimensions {
  width: number
  height: number
}

/**
 * Integer storage makes state straightforward to clamp, compare, and hash.
 * Normalized values use 0–1000; temperature uses tenths of a degree Celsius.
 */
export interface CellBuffer {
  /** Remaining burnable material, normalized to 0–1000. */
  fuel: Uint16Array
  /** Water content, normalized to 0–1000. */
  moisture: Uint16Array
  /** Temperature in tenths of a degree Celsius. */
  temperature: Int16Array
  /** Smoke density, normalized to 0–1000. */
  smoke: Uint16Array
  /** Active fire intensity, normalized to 0–1000. */
  fireIntensity: Uint16Array
}

export const SENSOR_KINDS = ['temperature', 'smoke', 'moisture'] as const
export type SensorKind = (typeof SENSOR_KINDS)[number]

export const SENSOR_STATUSES = ['active', 'failed'] as const
export type SensorStatus = (typeof SENSOR_STATUSES)[number]

export interface SensorState {
  id: number
  cellId: number
  kind: SensorKind
  status: SensorStatus
}

export const WIND_DIRECTIONS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const

export type WindDirection = (typeof WIND_DIRECTIONS)[number]

export interface WindState {
  direction: WindDirection
  /** Wind strength normalized to 0–1000. */
  strength: number
}

export interface WorldState {
  dimensions: GridDimensions
  cellCount: number
  tick: number
  wind: WindState
  sensors: SensorState[]
  current: CellBuffer
  next: CellBuffer
}
