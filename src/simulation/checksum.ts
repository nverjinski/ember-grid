import {
  SENSOR_KINDS,
  SENSOR_STATUSES,
  WIND_DIRECTIONS,
  type WorldState,
} from './types'

const CHECKSUM_SCHEMA_VERSION = 1
const FNV_1A_64_OFFSET = 0xcbf2_9ce4_8422_2325n
const FNV_1A_64_PRIME = 0x0000_0100_0000_01b3n
const UINT64_MASK = 0xffff_ffff_ffff_ffffn

class Fnv1a64 {
  private value = FNV_1A_64_OFFSET

  byte(value: number): void {
    this.value ^= BigInt(value & 0xff)
    this.value = (this.value * FNV_1A_64_PRIME) & UINT64_MASK
  }

  uint16(value: number): void {
    this.byte(value)
    this.byte(value >>> 8)
  }

  uint32(value: number): void {
    this.byte(value)
    this.byte(value >>> 8)
    this.byte(value >>> 16)
    this.byte(value >>> 24)
  }

  safeInteger(value: number): void {
    let remaining = BigInt(value)
    for (let byteIndex = 0; byteIndex < 8; byteIndex += 1) {
      this.byte(Number(remaining & 0xffn))
      remaining >>= 8n
    }
  }

  digest(): string {
    return this.value.toString(16).padStart(16, '0')
  }
}

function hashUint8Array(hash: Fnv1a64, values: Uint8Array): void {
  hash.uint32(values.length)
  for (const value of values) {
    hash.byte(value)
  }
}

function hashUint16Array(hash: Fnv1a64, values: Uint16Array): void {
  hash.uint32(values.length)
  for (const value of values) {
    hash.uint16(value)
  }
}

function hashInt16Array(hash: Fnv1a64, values: Int16Array): void {
  hash.uint32(values.length)
  for (const value of values) {
    hash.uint16(value & 0xffff)
  }
}

/**
 * Hashes semantic authoritative state in a fixed field order. The inactive
 * next buffer is intentionally excluded because it is only working memory.
 */
export function checksumWorld(world: WorldState): string {
  const hash = new Fnv1a64()

  hash.uint32(CHECKSUM_SCHEMA_VERSION)
  hash.uint32(world.dimensions.width)
  hash.uint32(world.dimensions.height)
  hash.safeInteger(world.tick)
  hash.byte(WIND_DIRECTIONS.indexOf(world.wind.direction))
  hash.safeInteger(world.wind.speedCentimetersPerSecond)

  hashUint8Array(hash, world.terrain.fuelBedCode)
  hashUint16Array(hash, world.current.surfaceFuelLoadGramsPerSquareMeter)
  hashUint16Array(hash, world.current.fuelMoisturePermille)
  hashInt16Array(hash, world.current.temperatureDeciCelsius)
  hashUint16Array(hash, world.current.smokeDensityIndex)
  hashUint16Array(hash, world.current.fireIntensityIndex)

  hash.uint32(world.sensors.length)
  for (const sensor of world.sensors) {
    hash.uint32(sensor.id)
    hash.uint32(sensor.cellId)
    hash.byte(SENSOR_KINDS.indexOf(sensor.kind))
    hash.byte(SENSOR_STATUSES.indexOf(sensor.status))
  }

  return hash.digest()
}
