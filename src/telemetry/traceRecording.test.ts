import { describe, expect, it } from "vitest";
import { Simulation } from "../simulation/simulation";
import { createTickBatchesV1 } from "./batching";
import { createTickChangeSetV1 } from "./delta";
import { createWorldSnapshotV1 } from "./snapshot";
import {
  recordTraceBatchesV1,
  type TraceRecordingConfigV1,
} from "./traceRecording";

const BASE_CONFIG: TraceRecordingConfigV1 = {
  initialization: {
    width: 4,
    height: 4,
    seed: 42,
    sensorCount: 2,
  },
  events: [
    { type: "ignition", tick: 0, cellId: 5, intensityIndex: 800 },
    {
      type: "wind-shift",
      tick: 2,
      direction: "south",
      speedCentimetersPerSecond: 350,
    },
  ],
  tickCount: 3,
  updatesPerMessage: 2,
};

describe("finite trace batch recording", () => {
  it("records the initial snapshot and every configured simulation tick", () => {
    const recording = recordTraceBatchesV1(BASE_CONFIG);

    expect(recording.initialSnapshot).toMatchObject({
      kind: "snapshot",
      sequenceNumber: 0,
      simulationTick: 0,
      scheduledDeliveryOffsetMicroseconds: 0,
    });

    const recordedTicks = [
      ...new Set(recording.tickBatches.map(({ simulationTick }) => simulationTick)),
    ];
    expect(recordedTicks).toEqual([1, 2, 3]);

    for (const tick of recordedTicks) {
      const batches = recording.tickBatches.filter(
        ({ simulationTick }) => simulationTick === tick,
      );
      expect(batches.at(-1)?.tickBatchIndex).toBe(batches.length - 1);
      expect(batches.every(({ tickBatchCount }) => tickBatchCount === batches.length)).toBe(
        true,
      );
    }
  });

  it("compares each tick with the immediately preceding detached state", () => {
    const simulation = new Simulation(
      BASE_CONFIG.initialization,
      BASE_CONFIG.events,
    );
    let previousSnapshot = createWorldSnapshotV1(simulation.world);
    const expectedBatches = [];

    for (let tickOffset = 0; tickOffset < BASE_CONFIG.tickCount; tickOffset += 1) {
      simulation.step();
      const changeSet = createTickChangeSetV1(
        previousSnapshot,
        simulation.world,
      );
      expectedBatches.push(
        ...createTickBatchesV1(changeSet, BASE_CONFIG.updatesPerMessage),
      );
      previousSnapshot = createWorldSnapshotV1(simulation.world);
    }

    expect(recordTraceBatchesV1(BASE_CONFIG).tickBatches).toEqual(
      expectedBatches,
    );
  });

  it("allows a finite snapshot-only trace", () => {
    const recording = recordTraceBatchesV1({
      ...BASE_CONFIG,
      tickCount: 0,
    });

    expect(recording.initialSnapshot.simulationTick).toBe(0);
    expect(recording.tickBatches).toEqual([]);
  });

  it("rejects invalid finite bounds even when no ticks would be recorded", () => {
    expect(() =>
      recordTraceBatchesV1({ ...BASE_CONFIG, tickCount: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      recordTraceBatchesV1({ ...BASE_CONFIG, tickCount: 1.5 }),
    ).toThrow(RangeError);
    expect(() =>
      recordTraceBatchesV1({
        ...BASE_CONFIG,
        tickCount: 0,
        updatesPerMessage: 0,
      }),
    ).toThrow(RangeError);
  });
});
