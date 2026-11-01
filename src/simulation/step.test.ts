import { describe, expect, it } from 'vitest'
import { stepWorld } from './step'
import { createEmptyWorld, getCellId } from './world'

function createTestWorld() {
  const world = createEmptyWorld({ width: 3, height: 3 })
  world.current.fuelLoadGramsPerSquareMeter.fill(800)
  world.current.fuelMoisturePermille.fill(200)
  world.current.temperatureDeciCelsius.fill(200)
  world.next.fuelLoadGramsPerSquareMeter.set(
    world.current.fuelLoadGramsPerSquareMeter,
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

    expect(world.current.fuelLoadGramsPerSquareMeter[centerId]).toBeLessThan(
      800,
    )
    expect(world.current.fuelMoisturePermille[centerId]).toBeLessThan(200)
    expect(world.current.temperatureDeciCelsius[centerId]).toBeGreaterThan(200)
    expect(world.current.smokeDensityIndex[centerId]).toBeGreaterThan(0)
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
