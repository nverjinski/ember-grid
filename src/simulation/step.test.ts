import { describe, expect, it } from 'vitest'
import { stepWorld } from './step'
import { createEmptyWorld, getCellId } from './world'

function createTestWorld() {
  const world = createEmptyWorld({ width: 3, height: 3 })
  world.current.surfaceFuelLoadGramsPerSquareMeter.fill(800)
  world.current.fuelMoisturePermille.fill(200)
  world.current.temperatureDeciCelsius.fill(200)
  world.next.surfaceFuelLoadGramsPerSquareMeter.set(
    world.current.surfaceFuelLoadGramsPerSquareMeter,
  )
  world.next.fuelMoisturePermille.set(world.current.fuelMoisturePermille)
  world.next.temperatureDeciCelsius.set(world.current.temperatureDeciCelsius)
  return world
}

describe('stepWorld', () => {
  it('advances one tick and swaps the buffers', () => {
    const world = createTestWorld()
    const originalCurrent = world.current
    const originalNext = world.next

    stepWorld(world)

    expect(world.tick).toBe(1)
    expect(world.current).toBe(originalNext)
    expect(world.next).toBe(originalCurrent)
  })

  it('consumes fuel and moisture while producing heat and smoke', () => {
    const world = createTestWorld()
    const centerId = getCellId(world.dimensions, 1, 1)
    world.current.fireIntensityIndex[centerId] = 1_000

    stepWorld(world)

    expect(
      world.current.surfaceFuelLoadGramsPerSquareMeter[centerId],
    ).toBeLessThan(800)
    expect(world.current.fuelMoisturePermille[centerId]).toBeLessThan(200)
    expect(world.current.temperatureDeciCelsius[centerId]).toBeGreaterThan(200)
    expect(world.current.smokeDensityIndex[centerId]).toBeGreaterThan(0)
  })

  it('preserves the calibrated one-tick baseline', () => {
    const world = createTestWorld()
    const centerId = getCellId(world.dimensions, 1, 1)
    const eastId = getCellId(world.dimensions, 2, 1)
    const southEastId = getCellId(world.dimensions, 2, 2)
    world.current.fireIntensityIndex[centerId] = 1_000

    stepWorld(world)

    expect(world.current.surfaceFuelLoadGramsPerSquareMeter[centerId]).toBe(780)
    expect(world.current.fuelMoisturePermille[centerId]).toBe(190)
    expect(world.current.temperatureDeciCelsius[centerId]).toBe(250)
    expect(world.current.smokeDensityIndex[centerId]).toBe(40)
    expect(world.current.fireIntensityIndex[centerId]).toBe(1_000)
    expect(world.current.fireIntensityIndex[eastId]).toBe(200)
    expect(world.current.fireIntensityIndex[southEastId]).toBe(0)
  })

  it('spreads more strongly downwind than upwind', () => {
    const world = createTestWorld()
    const centerId = getCellId(world.dimensions, 1, 1)
    const westId = getCellId(world.dimensions, 0, 1)
    const eastId = getCellId(world.dimensions, 2, 1)
    world.current.fireIntensityIndex[centerId] = 1_000
    world.wind = {
      direction: 'east',
      speedCentimetersPerSecond: 500,
    }

    stepWorld(world)

    expect(world.current.fireIntensityIndex[eastId]).toBeGreaterThan(
      world.current.fireIntensityIndex[westId],
    )
    expect(world.current.temperatureDeciCelsius[eastId]).toBeGreaterThan(
      world.current.temperatureDeciCelsius[westId],
    )
  })

  it('produces the same state from identical inputs', () => {
    const first = createTestWorld()
    const second = createTestWorld()
    first.current.fireIntensityIndex[4] = 700
    second.current.fireIntensityIndex[4] = 700

    stepWorld(first)
    stepWorld(second)

    expect(first).toEqual(second)
  })
})
