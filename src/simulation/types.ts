export const NORMALIZED_INDEX_MAX = 1_000

export interface GridDimensions {
  width: number
  height: number
}

/**
 * Integer storage makes state straightforward to clamp, compare, and hash.
 * Property names include their unit or identify explicitly normalized indexes.
 */
export interface CellBuffer {
  /** Remaining burnable material in grams per square meter. */
  fuelLoadGramsPerSquareMeter: Uint16Array
  /** Water mass relative to dry fuel mass; 1000 means 100%. */
  fuelMoisturePermille: Uint16Array
  /** Temperature in tenths of a degree Celsius. */
  temperatureDeciCelsius: Int16Array
  /** Stylized smoke density index from 0–1000. */
  smokeDensityIndex: Uint16Array
  /** Stylized active-fire intensity index from 0–1000. */
  fireIntensityIndex: Uint16Array
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
  /** Wind speed in centimeters per second. */
  speedCentimetersPerSecond: number
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
