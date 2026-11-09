import { describe, expect, it } from "vitest";
import type { TickChangeSetV1 } from "./delta";
import type { EntityUpdateV1 } from "./protocol";
import { createTickBatchesV1, partitionUpdatesV1 } from "./batching";

function createSensorUpdates(count: number): EntityUpdateV1[] {
  return Array.from({ length: count }, (_, sensorId) => ({
    entityType: "sensor",
    sensorId,
    cellId: sensorId * 2,
    kind: "temperature",
    status: "active",
  }));
}

function createChangeSet(updateCount: number): TickChangeSetV1 {
  return {
    simulationTick: 12,
    authoritativeWorldChecksum: "0123456789abcdef",
    updates: createSensorUpdates(updateCount),
  };
}

describe("deterministic update partitioning", () => {
  it("splits updates into consecutive bounded batches", () => {
    const updates = createSensorUpdates(5);

    expect(partitionUpdatesV1(updates, 2)).toEqual([
      [updates[0], updates[1]],
      [updates[2], updates[3]],
      [updates[4]],
    ]);
  });

  it("does not create an extra batch at an exact boundary", () => {
    const updates = createSensorUpdates(4);

    expect(partitionUpdatesV1(updates, 2)).toEqual([
      [updates[0], updates[1]],
      [updates[2], updates[3]],
    ]);
  });

  it("emits one empty batch for a tick with no entity changes", () => {
    expect(partitionUpdatesV1([], 10)).toEqual([[]]);
  });

  it("rejects invalid batch sizes", () => {
    const updates = createSensorUpdates(1);

    expect(() => partitionUpdatesV1(updates, 0)).toThrow(RangeError);
    expect(() => partitionUpdatesV1(updates, 1.5)).toThrow(RangeError);
  });
});

describe("tick-batch metadata", () => {
  it("attaches zero-based batch position and a shared batch count", () => {
    const changeSet = createChangeSet(5);

    expect(createTickBatchesV1(changeSet, 2)).toEqual([
      {
        simulationTick: 12,
        authoritativeWorldChecksum: "0123456789abcdef",
        tickBatchIndex: 0,
        tickBatchCount: 3,
        updates: [changeSet.updates[0], changeSet.updates[1]],
      },
      {
        simulationTick: 12,
        authoritativeWorldChecksum: "0123456789abcdef",
        tickBatchIndex: 1,
        tickBatchCount: 3,
        updates: [changeSet.updates[2], changeSet.updates[3]],
      },
      {
        simulationTick: 12,
        authoritativeWorldChecksum: "0123456789abcdef",
        tickBatchIndex: 2,
        tickBatchCount: 3,
        updates: [changeSet.updates[4]],
      },
    ]);
  });

  it("marks an unchanged tick as one complete empty batch", () => {
    expect(createTickBatchesV1(createChangeSet(0), 10)).toEqual([
      {
        simulationTick: 12,
        authoritativeWorldChecksum: "0123456789abcdef",
        tickBatchIndex: 0,
        tickBatchCount: 1,
        updates: [],
      },
    ]);
  });
});
