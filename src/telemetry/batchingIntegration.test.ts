import { describe, expect, it } from "vitest";
import type { TickChangeSetV1 } from "./delta";
import { serializeDeltaMessageV1 } from "./deltaSerialization";
import { createScheduledTickMessagesV1 } from "./scheduling";

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
  updatesPerMessage: 2,
  firstSequenceNumber: 20,
  firstScheduledDeliveryOffsetMicroseconds: 1_000,
  messagesPerSecond: 5_000,
} as const;

describe("tick batching pipeline invariants", () => {
  it("preserves every update exactly once and in its original order", () => {
    const changeSet = createChangeSet(5);
    const messages = createScheduledTickMessagesV1(changeSet, SCHEDULE);

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
    const messages = createScheduledTickMessagesV1(
      createChangeSet(0),
      SCHEDULE,
    );

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
    const first = createScheduledTickMessagesV1(changeSet, SCHEDULE);
    const second = createScheduledTickMessagesV1(changeSet, SCHEDULE);

    expect(first).toHaveLength(3);
    expect(
      first.reduce((total, message) => total + message.updates.length, 0),
    ).toBe(5);
    expect(first.map(serializeDeltaMessageV1)).toEqual(
      second.map(serializeDeltaMessageV1),
    );
  });
});

