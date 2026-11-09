import { describe, expect, it } from 'vitest'
import { checksumWorld } from '../simulation/checksum'
import { createInitializedWorld } from '../simulation/initialize'
import { TELEMETRY_PROTOCOL_VERSION, type SnapshotMessageV1 } from './protocol'
import {
  createSnapshotMessageV1,
  serializeSnapshotMessageV1,
} from './snapshot'

describe('protocol v1 snapshots', () => {
  it('copies authoritative world state into a JSON-safe snapshot', () => {
    const world = createInitializedWorld({
      width: 2,
      height: 2,
      seed: 42,
      sensorCount: 2,
    })
    const originalFuel = world.current.surfaceFuelLoadGramsPerSquareMeter[0]
    const originalFuelBed = world.terrain.fuelBedCode[0]
    const originalSensorStatus = world.sensors[0].status
    const originalWindDirection = world.wind.direction
    const originalChecksum = checksumWorld(world)

    const message = createSnapshotMessageV1(world, {
      sequenceNumber: 0,
      scheduledDeliveryTimeMicroseconds: 0,
    })

    world.current.surfaceFuelLoadGramsPerSquareMeter[0] = 0
    world.terrain.fuelBedCode[0] = 3
    world.sensors[0].status = 'failed'
    world.wind.direction = 'south'

    expect(message.simulationTick).toBe(0)
    expect(message.authoritativeWorldChecksum).toBe(originalChecksum)
    expect(message.snapshot.fuelBedCodeByCellId[0]).toBe(originalFuelBed)
    expect(message.snapshot.cells[0].surfaceFuelLoadGramsPerSquareMeter).toBe(
      originalFuel,
    )
    expect(message.snapshot.sensors[0].status).toBe(originalSensorStatus)
    expect(message.snapshot.wind.direction).toBe(originalWindDirection)
    expect(JSON.parse(serializeSnapshotMessageV1(message))).toEqual(message)
  })

  it('serializes a prescribed field order regardless of input insertion order', () => {
    const message: SnapshotMessageV1 = {
      kind: 'snapshot',
      snapshot: {
        wind: {
          speedCentimetersPerSecond: 430,
          direction: 'north-west',
        },
        sensors: [],
        cells: [
          {
            fireIntensityIndex: 0,
            smokeDensityIndex: 0,
            temperatureDeciCelsius: 200,
            fuelMoisturePermille: 120,
            surfaceFuelLoadGramsPerSquareMeter: 780,
            cellId: 0,
          },
        ],
        fuelBedCodeByCellId: [0],
        dimensions: { height: 1, width: 1 },
      },
      authoritativeWorldChecksum: '0123456789abcdef',
      scheduledDeliveryTimeMicroseconds: 0,
      simulationTick: 0,
      sequenceNumber: 0,
      protocolVersion: TELEMETRY_PROTOCOL_VERSION,
    }

    expect(serializeSnapshotMessageV1(message)).toBe(
      '{"protocolVersion":1,"kind":"snapshot","sequenceNumber":0,"simulationTick":0,"scheduledDeliveryTimeMicroseconds":0,"authoritativeWorldChecksum":"0123456789abcdef","snapshot":{"dimensions":{"width":1,"height":1},"fuelBedCodeByCellId":[0],"cells":[{"cellId":0,"surfaceFuelLoadGramsPerSquareMeter":780,"fuelMoisturePermille":120,"temperatureDeciCelsius":200,"smokeDensityIndex":0,"fireIntensityIndex":0}],"sensors":[],"wind":{"direction":"north-west","speedCentimetersPerSecond":430}}}',
    )
  })

  it('produces identical bytes for identical authoritative worlds', () => {
    const initialization = {
      width: 4,
      height: 3,
      seed: 123,
      sensorCount: 3,
    }
    const first = createSnapshotMessageV1(
      createInitializedWorld(initialization),
      { sequenceNumber: 0, scheduledDeliveryTimeMicroseconds: 0 },
    )
    const second = createSnapshotMessageV1(
      createInitializedWorld(initialization),
      { sequenceNumber: 0, scheduledDeliveryTimeMicroseconds: 0 },
    )

    expect(serializeSnapshotMessageV1(first)).toBe(
      serializeSnapshotMessageV1(second),
    )
  })

  it('rejects invalid sequence and delivery metadata', () => {
    const world = createInitializedWorld({
      width: 1,
      height: 1,
      seed: 1,
      sensorCount: 0,
    })

    expect(() =>
      createSnapshotMessageV1(world, {
        sequenceNumber: -1,
        scheduledDeliveryTimeMicroseconds: 0,
      }),
    ).toThrow(RangeError)
    expect(() =>
      createSnapshotMessageV1(world, {
        sequenceNumber: 0,
        scheduledDeliveryTimeMicroseconds: 0.5,
      }),
    ).toThrow(RangeError)
  })
})

