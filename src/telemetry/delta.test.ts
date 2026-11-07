import { describe, expect, it } from 'vitest'
import { checksumWorld } from '../simulation/checksum'
import { createInitializedWorld } from '../simulation/initialize'
import type { WorldState } from '../simulation/types'
import type { CellUpdateV1, SensorUpdateV1 } from './protocol'
import {
  collectCellUpdatesV1,
  collectSensorUpdatesV1,
  collectWindUpdateV1,
  createDeltaMessageV1,
} from './delta'
import { createSnapshotMessageV1 } from './snapshot'

function snapshotWorld(world: WorldState) {
  return createSnapshotMessageV1(world, {
    sequenceNumber: 0,
    scheduledDeliveryTimeMilliseconds: 0,
  }).snapshot
}

function expectedCellUpdate(
  world: WorldState,
  cellId: number,
): CellUpdateV1 {
  return {
    entityType: 'cell',
    cellId,
    surfaceFuelLoadGramsPerSquareMeter:
      world.current.surfaceFuelLoadGramsPerSquareMeter[cellId],
    fuelMoisturePermille: world.current.fuelMoisturePermille[cellId],
    temperatureDeciCelsius: world.current.temperatureDeciCelsius[cellId],
    smokeDensityIndex: world.current.smokeDensityIndex[cellId],
    fireIntensityIndex: world.current.fireIntensityIndex[cellId],
  }
}

function expectedSensorUpdate(
  world: WorldState,
  sensorIndex: number,
): SensorUpdateV1 {
  const sensor = world.sensors[sensorIndex]

  return {
    entityType: 'sensor',
    sensorId: sensor.id,
    cellId: sensor.cellId,
    kind: sensor.kind,
    status: sensor.status,
  }
}

describe('cell delta generation', () => {
  it('omits every cell when no dynamic state changed', () => {
    const world = createInitializedWorld({
      width: 3,
      height: 2,
      seed: 42,
      sensorCount: 0,
    })
    const previousSnapshot = snapshotWorld(world)

    expect(collectCellUpdatesV1(previousSnapshot, world)).toEqual([])
  })

  it('detects changes to every dynamic cell field', () => {
    const world = createInitializedWorld({
      width: 5,
      height: 1,
      seed: 42,
      sensorCount: 0,
    })
    const previousSnapshot = snapshotWorld(world)

    world.current.surfaceFuelLoadGramsPerSquareMeter[0] += 1
    world.current.fuelMoisturePermille[1] += 1
    world.current.temperatureDeciCelsius[2] += 1
    world.current.smokeDensityIndex[3] += 1
    world.current.fireIntensityIndex[4] += 1

    expect(collectCellUpdatesV1(previousSnapshot, world)).toEqual(
      Array.from({ length: 5 }, (_, cellId) =>
        expectedCellUpdate(world, cellId),
      ),
    )
  })

  it('emits complete records in ascending cell-ID order', () => {
    const world = createInitializedWorld({
      width: 4,
      height: 1,
      seed: 123,
      sensorCount: 0,
    })
    const previousSnapshot = snapshotWorld(world)

    world.current.fireIntensityIndex[3] = 100
    world.current.fireIntensityIndex[1] = 200

    expect(collectCellUpdatesV1(previousSnapshot, world)).toEqual([
      expectedCellUpdate(world, 1),
      expectedCellUpdate(world, 3),
    ])
  })

  it('rejects comparisons between different grids', () => {
    const previousWorld = createInitializedWorld({
      width: 2,
      height: 2,
      seed: 1,
      sensorCount: 0,
    })
    const currentWorld = createInitializedWorld({
      width: 4,
      height: 1,
      seed: 1,
      sensorCount: 0,
    })

    expect(() =>
      collectCellUpdatesV1(snapshotWorld(previousWorld), currentWorld),
    ).toThrow(RangeError)
  })
})

describe('sensor delta generation', () => {
  it('omits every sensor when no state changed', () => {
    const world = createInitializedWorld({
      width: 3,
      height: 2,
      seed: 42,
      sensorCount: 3,
    })
    const previousSnapshot = snapshotWorld(world)

    expect(collectSensorUpdatesV1(previousSnapshot, world)).toEqual([])
  })

  it('detects changes to every mutable sensor field', () => {
    const world = createInitializedWorld({
      width: 4,
      height: 2,
      seed: 42,
      sensorCount: 3,
    })
    const previousSnapshot = snapshotWorld(world)

    world.sensors[0].cellId = (world.sensors[0].cellId + 1) % world.cellCount
    world.sensors[1].kind =
      world.sensors[1].kind === 'temperature' ? 'smoke' : 'temperature'
    world.sensors[2].status = 'failed'

    expect(collectSensorUpdatesV1(previousSnapshot, world)).toEqual([
      expectedSensorUpdate(world, 0),
      expectedSensorUpdate(world, 1),
      expectedSensorUpdate(world, 2),
    ])
  })

  it('emits complete records in ascending sensor-ID order', () => {
    const world = createInitializedWorld({
      width: 4,
      height: 2,
      seed: 123,
      sensorCount: 3,
    })
    const previousSnapshot = snapshotWorld(world)

    world.sensors[2].status = 'failed'
    world.sensors[0].status = 'failed'

    expect(collectSensorUpdatesV1(previousSnapshot, world)).toEqual([
      expectedSensorUpdate(world, 0),
      expectedSensorUpdate(world, 2),
    ])
  })

  it('rejects sensor additions, removals, and identity changes', () => {
    const world = createInitializedWorld({
      width: 3,
      height: 2,
      seed: 1,
      sensorCount: 2,
    })
    const previousSnapshot = snapshotWorld(world)

    world.sensors[0].id = 99
    expect(() =>
      collectSensorUpdatesV1(previousSnapshot, world),
    ).toThrow(RangeError)

    world.sensors.shift()
    expect(() =>
      collectSensorUpdatesV1(previousSnapshot, world),
    ).toThrow(RangeError)
  })
})

describe('wind delta generation', () => {
  it('returns no update when wind did not change', () => {
    const world = createInitializedWorld({
      width: 2,
      height: 2,
      seed: 42,
      sensorCount: 0,
    })
    const previousSnapshot = snapshotWorld(world)

    expect(collectWindUpdateV1(previousSnapshot, world)).toBeUndefined()
  })

  it('returns a complete update when direction changes', () => {
    const world = createInitializedWorld({
      width: 2,
      height: 2,
      seed: 42,
      sensorCount: 0,
    })
    const previousSnapshot = snapshotWorld(world)
    world.wind.direction =
      world.wind.direction === 'north' ? 'south' : 'north'

    expect(collectWindUpdateV1(previousSnapshot, world)).toEqual({
      entityType: 'wind',
      direction: world.wind.direction,
      speedCentimetersPerSecond: world.wind.speedCentimetersPerSecond,
    })
  })

  it('returns a complete update when speed changes', () => {
    const world = createInitializedWorld({
      width: 2,
      height: 2,
      seed: 123,
      sensorCount: 0,
    })
    const previousSnapshot = snapshotWorld(world)
    world.wind.speedCentimetersPerSecond += 1

    expect(collectWindUpdateV1(previousSnapshot, world)).toEqual({
      entityType: 'wind',
      direction: world.wind.direction,
      speedCentimetersPerSecond: world.wind.speedCentimetersPerSecond,
    })
  })
})

describe('delta message assembly', () => {
  it('builds a header from message metadata and current authoritative state', () => {
    const world = createInitializedWorld({
      width: 2,
      height: 2,
      seed: 42,
      sensorCount: 1,
    })
    const previousSnapshot = snapshotWorld(world)
    world.tick = 7

    expect(
      createDeltaMessageV1(previousSnapshot, world, {
        sequenceNumber: 4,
        scheduledDeliveryTimeMilliseconds: 700,
      }),
    ).toEqual({
      protocolVersion: 1,
      sequenceNumber: 4,
      simulationTick: 7,
      scheduledDeliveryTimeMilliseconds: 700,
      authoritativeWorldChecksum: checksumWorld(world),
      kind: 'delta',
      updates: [],
    })
  })

  it('assembles cells, sensors, and wind in canonical entity order', () => {
    const world = createInitializedWorld({
      width: 4,
      height: 2,
      seed: 123,
      sensorCount: 2,
    })
    const previousSnapshot = snapshotWorld(world)

    world.current.fireIntensityIndex[3] = 100
    world.current.fireIntensityIndex[1] = 200
    world.sensors[1].status = 'failed'
    world.wind.direction =
      world.wind.direction === 'north' ? 'south' : 'north'

    const message = createDeltaMessageV1(previousSnapshot, world, {
      sequenceNumber: 1,
      scheduledDeliveryTimeMilliseconds: 100,
    })

    expect(message.updates).toEqual([
      expectedCellUpdate(world, 1),
      expectedCellUpdate(world, 3),
      expectedSensorUpdate(world, 1),
      {
        entityType: 'wind',
        direction: world.wind.direction,
        speedCentimetersPerSecond: world.wind.speedCentimetersPerSecond,
      },
    ])
  })

  it('rejects invalid sequence and delivery metadata', () => {
    const world = createInitializedWorld({
      width: 1,
      height: 1,
      seed: 1,
      sensorCount: 0,
    })
    const previousSnapshot = snapshotWorld(world)

    expect(() =>
      createDeltaMessageV1(previousSnapshot, world, {
        sequenceNumber: -1,
        scheduledDeliveryTimeMilliseconds: 0,
      }),
    ).toThrow(RangeError)
    expect(() =>
      createDeltaMessageV1(previousSnapshot, world, {
        sequenceNumber: 1,
        scheduledDeliveryTimeMilliseconds: 0.5,
      }),
    ).toThrow(RangeError)
  })
})

