import { describe, expect, it } from 'vitest'
import type { TickChangeSetV1 } from './delta'
import { createTickBatchesV1 } from './batching'
import { scheduleTickBatchesV1 } from './scheduling'

function createChangeSet(updateCount: number): TickChangeSetV1 {
  return {
    simulationTick: 12,
    authoritativeWorldChecksum: '0123456789abcdef',
    updates: Array.from({ length: updateCount }, (_, sensorId) => ({
      entityType: 'sensor' as const,
      sensorId,
      cellId: sensorId,
      kind: 'temperature' as const,
      status: 'active' as const,
    })),
  }
}

describe('deterministic tick-batch scheduling', () => {
  it('assigns consecutive sequences and logical delivery times', () => {
    const batches = createTickBatchesV1(createChangeSet(5), 2)
    const messages = scheduleTickBatchesV1(batches, {
      firstSequenceNumber: 7,
      firstScheduledDeliveryOffsetMicroseconds: 100_000,
      messagesPerSecond: 4,
    })

    expect(
      messages.map((message) => ({
        protocolVersion: message.protocolVersion,
        kind: message.kind,
        sequenceNumber: message.sequenceNumber,
        simulationTick: message.simulationTick,
        scheduledDeliveryOffsetMicroseconds:
          message.scheduledDeliveryOffsetMicroseconds,
        authoritativeWorldChecksum: message.authoritativeWorldChecksum,
        tickBatchIndex: message.tickBatchIndex,
        tickBatchCount: message.tickBatchCount,
        updates: message.updates,
      })),
    ).toEqual([
      {
        protocolVersion: 1,
        kind: 'delta',
        sequenceNumber: 7,
        simulationTick: 12,
        scheduledDeliveryOffsetMicroseconds: 100_000,
        authoritativeWorldChecksum: '0123456789abcdef',
        tickBatchIndex: 0,
        tickBatchCount: 3,
        updates: batches[0].updates,
      },
      {
        protocolVersion: 1,
        kind: 'delta',
        sequenceNumber: 8,
        simulationTick: 12,
        scheduledDeliveryOffsetMicroseconds: 350_000,
        authoritativeWorldChecksum: '0123456789abcdef',
        tickBatchIndex: 1,
        tickBatchCount: 3,
        updates: batches[1].updates,
      },
      {
        protocolVersion: 1,
        kind: 'delta',
        sequenceNumber: 9,
        simulationTick: 12,
        scheduledDeliveryOffsetMicroseconds: 600_000,
        authoritativeWorldChecksum: '0123456789abcdef',
        tickBatchIndex: 2,
        tickBatchCount: 3,
        updates: batches[2].updates,
      },
    ])
  })

  it('represents sub-millisecond spacing at high message rates', () => {
    const batches = createTickBatchesV1(createChangeSet(3), 1)
    const messages = scheduleTickBatchesV1(batches, {
      firstSequenceNumber: 0,
      firstScheduledDeliveryOffsetMicroseconds: 0,
      messagesPerSecond: 5_000,
    })

    expect(
      messages.map(
        ({ scheduledDeliveryOffsetMicroseconds }) =>
          scheduledDeliveryOffsetMicroseconds,
      ),
    ).toEqual([0, 200, 400])
  })

  it('calculates from the origin instead of accumulating rounded intervals', () => {
    const batches = createTickBatchesV1(createChangeSet(4), 1)
    const messages = scheduleTickBatchesV1(batches, {
      firstSequenceNumber: 0,
      firstScheduledDeliveryOffsetMicroseconds: 0,
      messagesPerSecond: 3_000,
    })

    expect(
      messages.map(
        ({ scheduledDeliveryOffsetMicroseconds }) =>
          scheduledDeliveryOffsetMicroseconds,
      ),
    ).toEqual([0, 333, 666, 1_000])
  })

  it('rejects invalid or overflowing schedules', () => {
    const batches = createTickBatchesV1(createChangeSet(2), 1)

    expect(() =>
      scheduleTickBatchesV1(batches, {
        firstSequenceNumber: 0,
        firstScheduledDeliveryOffsetMicroseconds: 0,
        messagesPerSecond: 0,
      }),
    ).toThrow(RangeError)
    expect(() =>
      scheduleTickBatchesV1(batches, {
        firstSequenceNumber: Number.MAX_SAFE_INTEGER,
        firstScheduledDeliveryOffsetMicroseconds: 0,
        messagesPerSecond: 1,
      }),
    ).toThrow(RangeError)
  })
})

