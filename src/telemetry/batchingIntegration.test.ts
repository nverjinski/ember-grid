import { describe, expect, it } from "vitest";
import { createTickBatchesV1 } from "./batching";
import type { TickChangeSetV1 } from "./delta";
import { serializeDeltaMessageV1 } from "./deltaSerialization";
import { scheduleTickBatchesV1 } from "./scheduling";

function createChangeSet(updateCount: number): TickChangeSetV1 {
  return {
    simulationTick: 12,
    authoritativeWorldChecksum: "0123456789abcdef",
    updates: Array.from({ length: updateCount }, (_, sensorId) => ({
      entityType: "sensor" as const,
      sensorId,
      cellId: sensorId,
      kind: "temperature" as const,
      status: "active" as const,
    })),
  };
}

const SCHEDULE = {
  firstSequenceNumber: 20,
  firstScheduledDeliveryOffsetMicroseconds: 1_000,
  messagesPerSecond: 5_000,
} as const;

function createScheduledMessages(changeSet: TickChangeSetV1) {
  return scheduleTickBatchesV1(
    createTickBatchesV1(changeSet, 2),
    SCHEDULE,
  );
}

describe("tick batching pipeline invariants", () => {
  it("preserves every update exactly once and in its original order", () => {
    const changeSet = createChangeSet(5);
    const messages = createScheduledMessages(changeSet);

    expect(messages.flatMap(({ updates }) => updates)).toEqual(
      changeSet.updates,
    );
    expect(messages.map(({ sequenceNumber }) => sequenceNumber)).toEqual([
      20, 21, 22,
    ]);
    expect(
      messages.map(({ scheduledDeliveryOffsetMicroseconds }) =>
        scheduledDeliveryOffsetMicroseconds,
      ),
    ).toEqual([1_000, 1_200, 1_400]);
    expect(messages.map(({ tickBatchIndex }) => tickBatchIndex)).toEqual([
      0, 1, 2,
    ]);
    expect(messages.every(({ tickBatchCount }) => tickBatchCount === 3)).toBe(
      true,
    );
  });

  it("represents an unchanged tick as one complete empty message", () => {
    const messages = createScheduledMessages(createChangeSet(0));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      sequenceNumber: 20,
      simulationTick: 12,
      tickBatchIndex: 0,
      tickBatchCount: 1,
      updates: [],
    });
  });

  it("separates message count from update count and repeats byte-for-byte", () => {
    const changeSet = createChangeSet(5);
    const first = createScheduledMessages(changeSet);
    const second = createScheduledMessages(changeSet);

    expect(first).toHaveLength(3);
    expect(
      first.reduce((total, message) => total + message.updates.length, 0),
    ).toBe(5);
    expect(first.map(serializeDeltaMessageV1)).toEqual(
      second.map(serializeDeltaMessageV1),
    );
  });
});

