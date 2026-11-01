import { describe, expect, it } from 'vitest'
import { getFuelBedProfile } from './fuelBeds'
import { createInitializedWorld } from './initialize'

const initialization = {
  width: 4,
  height: 3,
  seed: 42,
  sensorCount: 3,
}

describe('createInitializedWorld', () => {
  it('creates identical worlds for the same seed', () => {
    const first = createInitializedWorld(initialization)
    const second = createInitializedWorld(initialization)

    expect(first.wind).toEqual(second.wind)
    expect(first.sensors).toEqual(second.sensors)
    expect(first.terrain.fuelBedCode).toEqual(second.terrain.fuelBedCode)
    expect(first.current.surfaceFuelLoadGramsPerSquareMeter).toEqual(
      second.current.surfaceFuelLoadGramsPerSquareMeter,
    )
    expect(first.current.fuelMoisturePermille).toEqual(
      second.current.fuelMoisturePermille,
    )
    expect(first.current.temperatureDeciCelsius).toEqual(
      second.current.temperatureDeciCelsius,
    )
  })

  it('creates different terrain for different seeds', () => {
    const first = createInitializedWorld(initialization)
    const second = createInitializedWorld({ ...initialization, seed: 43 })

    expect(first.current.surfaceFuelLoadGramsPerSquareMeter).not.toEqual(
      second.current.surfaceFuelLoadGramsPerSquareMeter,
    )
  })

  it('initializes values in range and copies them to the next buffer', () => {
    const world = createInitializedWorld(initialization)

    expect(
      [...world.current.surfaceFuelLoadGramsPerSquareMeter].every(
        (value, cellId) => {
          const profile = getFuelBedProfile(world.terrain.fuelBedCode[cellId])
          return (
            value >= profile.minimumSurfaceFuelLoadGramsPerSquareMeter &&
            value <= profile.maximumSurfaceFuelLoadGramsPerSquareMeter
          )
        },
      ),
    ).toBe(true)
    expect(
      [...world.current.fuelMoisturePermille].every(
        (value) => value >= 150 && value <= 750,
      ),
    ).toBe(true)
    expect(
      [...world.current.temperatureDeciCelsius].every(
        (value) => value >= 150 && value <= 350,
      ),
    ).toBe(true)

    expect(world.next.surfaceFuelLoadGramsPerSquareMeter).toEqual(
      world.current.surfaceFuelLoadGramsPerSquareMeter,
    )
    expect(world.next.fuelMoisturePermille).toEqual(
      world.current.fuelMoisturePermille,
    )
    expect(world.next.temperatureDeciCelsius).toEqual(
      world.current.temperatureDeciCelsius,
    )
  })

  it('assigns stable, unique sensor IDs and locations', () => {
    const world = createInitializedWorld(initialization)

    expect(world.sensors.map((sensor) => sensor.id)).toEqual([0, 1, 2])
    expect(new Set(world.sensors.map((sensor) => sensor.cellId)).size).toBe(3)
  })
})
