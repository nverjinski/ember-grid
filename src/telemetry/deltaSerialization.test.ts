import { describe, expect, it } from 'vitest'
import {
  TELEMETRY_PROTOCOL_VERSION,
  type DeltaMessageV1,
} from './protocol'
import { serializeDeltaMessageV1 } from './deltaSerialization'

describe('canonical delta serialization', () => {
  it('serializes every message and entity field in prescribed order', () => {
    const message: DeltaMessageV1 = {
      updates: [
        {
          fireIntensityIndex: 25,
          smokeDensityIndex: 4,
          temperatureDeciCelsius: 210,
          fuelMoisturePermille: 119,
          surfaceFuelLoadGramsPerSquareMeter: 779,
          cellId: 3,
          entityType: 'cell',
        },
        {
          status: 'failed',
          kind: 'temperature',
          cellId: 3,
          sensorId: 1,
          entityType: 'sensor',
        },
        {
          speedCentimetersPerSecond: 500,
          direction: 'south-east',
          entityType: 'wind',
        },
      ],
      tickBatchCount: 1,
      tickBatchIndex: 0,
      authoritativeWorldChecksum: '0123456789abcdef',
      scheduledDeliveryOffsetMicroseconds: 200,
      simulationTick: 12,
      sequenceNumber: 7,
      kind: 'delta',
      protocolVersion: TELEMETRY_PROTOCOL_VERSION,
    }

    expect(serializeDeltaMessageV1(message)).toBe(
      '{"protocolVersion":1,"kind":"delta","sequenceNumber":7,"simulationTick":12,"scheduledDeliveryOffsetMicroseconds":200,"authoritativeWorldChecksum":"0123456789abcdef","tickBatchIndex":0,"tickBatchCount":1,"updates":[{"entityType":"cell","cellId":3,"surfaceFuelLoadGramsPerSquareMeter":779,"fuelMoisturePermille":119,"temperatureDeciCelsius":210,"smokeDensityIndex":4,"fireIntensityIndex":25},{"entityType":"sensor","sensorId":1,"cellId":3,"kind":"temperature","status":"failed"},{"entityType":"wind","direction":"south-east","speedCentimetersPerSecond":500}]}',
    )
  })

  it('round-trips an empty tick batch without changing its values', () => {
    const message: DeltaMessageV1 = {
      protocolVersion: TELEMETRY_PROTOCOL_VERSION,
      kind: 'delta',
      sequenceNumber: 8,
      simulationTick: 13,
      scheduledDeliveryOffsetMicroseconds: 400,
      authoritativeWorldChecksum: 'fedcba9876543210',
      tickBatchIndex: 0,
      tickBatchCount: 1,
      updates: [],
    }

    expect(JSON.parse(serializeDeltaMessageV1(message))).toEqual(message)
  })
})

