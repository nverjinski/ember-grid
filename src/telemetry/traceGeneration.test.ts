import { describe, expect, it } from "vitest";
import { Simulation } from "../simulation/simulation";
import { createTickBatchesV1 } from "./batching";
import { createTickChangeSetV1 } from "./delta";
import type { DeltaMessageV1, TelemetryMessageV1 } from "./protocol";
import { createWorldSnapshotV1 } from "./snapshot";
import { createTrace, type TraceConfig } from "./trace";

const BASE_CONFIG: TraceConfig = {
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
  messagesPerSecond: 3_000,
};

function parseTrace(config: TraceConfig): TelemetryMessageV1[] {
  return createTrace(config).map(
    ({ json }) => JSON.parse(json) as TelemetryMessageV1,
  );
}

describe("finite trace generation", () => {
  it("records the initial snapshot and every configured simulation tick", () => {
    const messages = parseTrace(BASE_CONFIG);

    expect(messages[0]).toMatchObject({
      kind: "snapshot",
      sequenceNumber: 0,
      simulationTick: 0,
      scheduledDeliveryOffsetMicroseconds: 0,
    });
    expect([
      ...new Set(messages.slice(1).map(({ simulationTick }) => simulationTick)),
    ]).toEqual([1, 2, 3]);
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

    const actualBatches = (parseTrace(BASE_CONFIG).slice(1) as DeltaMessageV1[]).map(
      ({
        simulationTick,
        authoritativeWorldChecksum,
        tickBatchIndex,
        tickBatchCount,
        updates,
      }) => ({
        simulationTick,
        authoritativeWorldChecksum,
        tickBatchIndex,
        tickBatchCount,
        updates,
      }),
    );
    expect(actualBatches).toEqual(expectedBatches);
  });

  it("allows a finite snapshot-only trace", () => {
    const messages = parseTrace({ ...BASE_CONFIG, tickCount: 0 });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ kind: "snapshot", simulationTick: 0 });
  });

  it("rejects invalid finite bounds even for a snapshot-only trace", () => {
    expect(() => createTrace({ ...BASE_CONFIG, tickCount: -1 })).toThrow(
      RangeError,
    );
    expect(() => createTrace({ ...BASE_CONFIG, tickCount: 1.5 })).toThrow(
      RangeError,
    );
    expect(() =>
      createTrace({
        ...BASE_CONFIG,
        tickCount: 0,
        updatesPerMessage: 0,
      }),
    ).toThrow(RangeError);
  });
});
