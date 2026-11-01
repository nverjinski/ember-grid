import { describe, expect, it } from 'vitest'
import type { ScenarioEvent } from './events'
import { Simulation } from './simulation'

const initialization = {
  width: 4,
  height: 4,
  seed: 42,
  sensorCount: 2,
}

describe('Simulation', () => {
  it('applies tick-zero events to the initial state', () => {
    const simulation = new Simulation(initialization, [
      { type: 'ignition', tick: 0, cellId: 5, intensityIndex: 700 },
    ])

    expect(simulation.world.tick).toBe(0)
    expect(simulation.world.current.fireIntensityIndex[5]).toBe(700)
  })

  it('applies events when their target tick is reached', () => {
    const simulation = new Simulation(initialization, [
      {
        type: 'wind-shift',
        tick: 2,
        direction: 'south',
        speedCentimetersPerSecond: 350,
      },
      { type: 'sensor-status', tick: 2, sensorId: 0, status: 'failed' },
    ])

    simulation.advanceToTick(1)
    expect(simulation.world.wind.direction).not.toBe('south')
    expect(simulation.world.sensors[0].status).toBe('active')

    simulation.advanceToTick(2)
    expect(simulation.world.wind).toEqual({
      direction: 'south',
      speedCentimetersPerSecond: 350,
    })
    expect(simulation.world.sensors[0].status).toBe('failed')
  })

  it('preserves declaration order for events on the same tick', () => {
    const events: ScenarioEvent[] = [
      { type: 'ignition', tick: 0, cellId: 5, intensityIndex: 800 },
      {
        type: 'containment',
        tick: 0,
        cellIds: [5],
        fuelRemovalPermille: 1_000,
      },
    ]
    const simulation = new Simulation(initialization, events)

    expect(simulation.world.current.fireIntensityIndex[5]).toBe(0)
    expect(
      simulation.world.current.surfaceFuelLoadGramsPerSquareMeter[5],
    ).toBe(0)
  })

  it('reaches the same state by repeated steps or direct advancement', () => {
    const events: ScenarioEvent[] = [
      { type: 'ignition', tick: 0, cellId: 5, intensityIndex: 700 },
      {
        type: 'wind-shift',
        tick: 3,
        direction: 'east',
        speedCentimetersPerSecond: 400,
      },
    ]
    const stepped = new Simulation(initialization, events)
    const advanced = new Simulation(initialization, events)

    for (let tick = 0; tick < 5; tick += 1) {
      stepped.step()
    }
    advanced.advanceToTick(5)

    expect(advanced.world).toEqual(stepped.world)
  })

  it('reset reconstructs the exact initial state and tick-zero events', () => {
    const simulation = new Simulation(initialization, [
      { type: 'ignition', tick: 0, cellId: 5, intensityIndex: 700 },
    ])
    const initialFuel = [
      ...simulation.world.current.surfaceFuelLoadGramsPerSquareMeter,
    ]

    simulation.advanceToTick(5)
    simulation.reset()

    expect(simulation.world.tick).toBe(0)
    expect(simulation.world.current.fireIntensityIndex[5]).toBe(700)
    expect([
      ...simulation.world.current.surfaceFuelLoadGramsPerSquareMeter,
    ]).toEqual(initialFuel)
  })

  it('rejects invalid events and backward advancement', () => {
    expect(
      () =>
        new Simulation(initialization, [
          { type: 'ignition', tick: 0, cellId: 16, intensityIndex: 700 },
        ]),
    ).toThrow(RangeError)

    const simulation = new Simulation(initialization)
    simulation.advanceToTick(2)
    expect(() => simulation.advanceToTick(1)).toThrow(RangeError)
  })
})
