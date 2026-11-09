import { describe, expect, it } from 'vitest'
import {
  TELEMETRY_PROTOCOL_VERSION,
  type DeltaMessageV1,
  type SnapshotMessageV1,
  type TelemetryMessageV1,
} from './protocol'

const HEADER = {
  protocolVersion: TELEMETRY_PROTOCOL_VERSION,
  sequenceNumber: 0,
  simulationTick: 0,
  scheduledDeliveryOffsetMicroseconds: 0,
  authoritativeWorldChecksum: '0123456789abcdef',
} as const

describe('telemetry protocol v1', () => {
  it('represents a complete snapshot using JSON-safe values', () => {
    const message: SnapshotMessageV1 = {
      ...HEADER,
      kind: 'snapshot',
      snapshot: {
        dimensions: { width: 1, height: 1 },
        fuelBedCodeByCellId: [0],
        cells: [
          {
            cellId: 0,
            surfaceFuelLoadGramsPerSquareMeter: 780,
            fuelMoisturePermille: 120,
            temperatureDeciCelsius: 200,
            smokeDensityIndex: 0,
            fireIntensityIndex: 0,
          },
        ],
        sensors: [
          {
            sensorId: 0,
            cellId: 0,
            kind: 'temperature',
            status: 'active',
          },
        ],
        wind: {
          direction: 'north-west',
          speedCentimetersPerSecond: 430,
        },
      },
    }

    expect(JSON.parse(JSON.stringify(message))).toEqual(message)
  })

  it('uses discriminated complete entity records for delta updates', () => {
    const message: DeltaMessageV1 = {
      ...HEADER,
      sequenceNumber: 1,
      simulationTick: 1,
      scheduledDeliveryOffsetMicroseconds: 100_000,
      kind: 'delta',
      tickBatchIndex: 0,
      tickBatchCount: 1,
      updates: [
        {
          entityType: 'cell',
          cellId: 0,
          surfaceFuelLoadGramsPerSquareMeter: 779,
          fuelMoisturePermille: 119,
          temperatureDeciCelsius: 210,
          smokeDensityIndex: 4,
          fireIntensityIndex: 25,
        },
        {
          entityType: 'sensor',
          sensorId: 0,
          cellId: 0,
          kind: 'temperature',
          status: 'failed',
        },
        {
          entityType: 'wind',
          direction: 'south-east',
          speedCentimetersPerSecond: 500,
        },
      ],
    }

    expect(message.updates.map((update) => update.entityType)).toEqual([
      'cell',
      'sensor',
      'wind',
    ])
  })

  it('narrows snapshot and delta messages by kind', () => {
    const updateCount = (message: TelemetryMessageV1): number =>
      message.kind === 'snapshot'
        ? message.snapshot.cells.length
        : message.updates.length

    const delta: DeltaMessageV1 = {
      ...HEADER,
      kind: 'delta',
      tickBatchIndex: 0,
      tickBatchCount: 1,
      updates: [],
    }

    expect(updateCount(delta)).toBe(0)
  })
})

