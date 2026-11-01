import { describe, expect, it } from 'vitest'
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
    expect(first.current.fuel).toEqual(second.current.fuel)
    expect(first.current.moisture).toEqual(second.current.moisture)
    expect(first.current.temperature).toEqual(second.current.temperature)
  })

  it('creates different terrain for different seeds', () => {
    const first = createInitializedWorld(initialization)
    const second = createInitializedWorld({ ...initialization, seed: 43 })

    expect(first.current.fuel).not.toEqual(second.current.fuel)
  })

  it('initializes values in range and copies them to the next buffer', () => {
    const world = createInitializedWorld(initialization)

    expect(
      [...world.current.fuel].every((value) => value >= 600 && value <= 1_000),
    ).toBe(true)
    expect(
      [...world.current.moisture].every(
        (value) => value >= 150 && value <= 750,
      ),
    ).toBe(true)
    expect(
      [...world.current.temperature].every(
        (value) => value >= 150 && value <= 350,
      ),
    ).toBe(true)

    expect(world.next.fuel).toEqual(world.current.fuel)
    expect(world.next.moisture).toEqual(world.current.moisture)
    expect(world.next.temperature).toEqual(world.current.temperature)
  })

  it('assigns stable, unique sensor IDs and locations', () => {
    const world = createInitializedWorld(initialization)

    expect(world.sensors.map((sensor) => sensor.id)).toEqual([0, 1, 2])
    expect(new Set(world.sensors.map((sensor) => sensor.cellId)).size).toBe(3)
  })
})
