import { describe, expect, it } from 'vitest'
import {
  createEmptyWorld,
  getCellCoordinates,
  getCellId,
} from './world'

describe('world model', () => {
  it('allocates one entry per cell in both state buffers', () => {
    const world = createEmptyWorld({ width: 3, height: 2 })

    expect(world.cellCount).toBe(6)
    expect(world.tick).toBe(0)
    expect(world.sensors).toEqual([])

    for (const buffer of [world.current, world.next]) {
      expect(buffer.surfaceFuelLoadGramsPerSquareMeter).toHaveLength(6)
      expect(buffer.fuelMoisturePermille).toHaveLength(6)
      expect(buffer.temperatureDeciCelsius).toHaveLength(6)
      expect(buffer.smokeDensityIndex).toHaveLength(6)
      expect(buffer.fireIntensityIndex).toHaveLength(6)
    }

    expect(world.terrain.fuelBedCode).toHaveLength(6)
    expect(world.current.surfaceFuelLoadGramsPerSquareMeter).not.toBe(
      world.next.surfaceFuelLoadGramsPerSquareMeter,
    )
  })

  it('maps coordinates to stable row-major IDs', () => {
    const dimensions = { width: 3, height: 2 }

    expect(getCellId(dimensions, 0, 0)).toBe(0)
    expect(getCellId(dimensions, 2, 0)).toBe(2)
    expect(getCellId(dimensions, 0, 1)).toBe(3)
    expect(getCellId(dimensions, 2, 1)).toBe(5)
    expect(getCellCoordinates(dimensions, 4)).toEqual({ x: 1, y: 1 })
  })

  it('rejects invalid dimensions, coordinates, and IDs', () => {
    expect(() => createEmptyWorld({ width: 0, height: 2 })).toThrow(RangeError)
    expect(() => getCellId({ width: 3, height: 2 }, 3, 0)).toThrow(
      RangeError,
    )
    expect(() => getCellCoordinates({ width: 3, height: 2 }, 6)).toThrow(
      RangeError,
    )
  })
})
