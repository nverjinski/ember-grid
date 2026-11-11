import { describe, expect, it } from "vitest";
import type { DeltaMessageV1, TelemetryMessageV1 } from "./protocol";
import {
  createSerializedTraceV1,
  type TraceGenerationConfigV1,
} from "./trace";
import {
  MAX_TRACE_CELL_TICKS,
  MAX_TRACE_GRID_CELLS,
  MAX_TRACE_MESSAGES,
  MAX_TRACE_TICKS,
  recordTraceBatchesV1,
} from "./traceRecording";

function createConfig(seed: number): TraceGenerationConfigV1 {
  return {
    initialization: {
      width: 8,
      height: 8,
      seed,
      sensorCount: 4,
    },
    events: [
      { type: "ignition", tick: 0, cellId: 27, intensityIndex: 800 },
      {
        type: "wind-shift",
        tick: 3,
        direction: "east",
        speedCentimetersPerSecond: 400,
      },
    ],
    tickCount: 5,
    updatesPerMessage: 3,
    messagesPerSecond: 3_000,
  };
}

function parseTrace(config: TraceGenerationConfigV1): TelemetryMessageV1[] {
  return createSerializedTraceV1(config).entries.map(
    ({ serializedMessage }) =>
      JSON.parse(serializedMessage) as TelemetryMessageV1,
  );
}

describe("finite trace determinism", () => {
  it("repeats byte-for-byte for each of two seeds", () => {
    for (const seed of [42, 99]) {
      const config = createConfig(seed);
      expect(createSerializedTraceV1(config)).toEqual(
        createSerializedTraceV1(config),
      );
    }
  });

  it("distinguishes traces generated from different seeds", () => {
    const first = createSerializedTraceV1(createConfig(42));
    const second = createSerializedTraceV1(createConfig(99));

    expect(
      first.entries.map(({ serializedMessage }) => serializedMessage),
    ).not.toEqual(
      second.entries.map(({ serializedMessage }) => serializedMessage),
    );
  });

  it("preserves global sequence, schedule, tick, and batch invariants", () => {
    const config = createConfig(42);
    const messages = parseTrace(config);

    expect(messages[0].kind).toBe("snapshot");
    expect(messages.map(({ sequenceNumber }) => sequenceNumber)).toEqual(
      messages.map((_, index) => index),
    );

    const deltas = messages.slice(1) as DeltaMessageV1[];
    expect(
      deltas.map(({ scheduledDeliveryOffsetMicroseconds }) =>
        scheduledDeliveryOffsetMicroseconds,
      ),
    ).toEqual(
      deltas.map((_, index) =>
        Math.floor((index * 1_000_000) / config.messagesPerSecond),
      ),
    );

    const ticks = [
      ...new Set(deltas.map(({ simulationTick }) => simulationTick)),
    ];
    expect(ticks).toEqual([1, 2, 3, 4, 5]);
    for (const tick of ticks) {
      const tickMessages = deltas.filter(
        ({ simulationTick }) => simulationTick === tick,
      );
      expect(tickMessages.map(({ tickBatchIndex }) => tickBatchIndex)).toEqual(
        tickMessages.map((_, index) => index),
      );
      expect(
        tickMessages.every(
          ({ tickBatchCount }) => tickBatchCount === tickMessages.length,
        ),
      ).toBe(true);
    }
  });
});

describe("finite trace resource bounds", () => {
  it("rejects excessive grid, tick, and cell-tick configurations", () => {
    const base = createConfig(42);

    expect(() =>
      recordTraceBatchesV1({
        ...base,
        initialization: {
          ...base.initialization,
          width: 257,
          height: 256,
        },
      }),
    ).toThrow(`${MAX_TRACE_GRID_CELLS}`);
    expect(() =>
      recordTraceBatchesV1({ ...base, tickCount: MAX_TRACE_TICKS + 1 }),
    ).toThrow(`${MAX_TRACE_TICKS}`);
    expect(() =>
      recordTraceBatchesV1({
        ...base,
        initialization: {
          ...base.initialization,
          width: 256,
          height: 256,
        },
        tickCount: Math.floor(MAX_TRACE_CELL_TICKS / (256 * 256)) + 1,
      }),
    ).toThrow(`${MAX_TRACE_CELL_TICKS}`);
  });

  it("rejects a trace that would exceed its total message budget", () => {
    const base = createConfig(42);

    expect(() =>
      recordTraceBatchesV1({
        ...base,
        initialization: {
          width: 256,
          height: 256,
          seed: 42,
          sensorCount: 0,
        },
        events: [],
        tickCount: 2,
        updatesPerMessage: 1,
      }),
    ).toThrow(`${MAX_TRACE_MESSAGES}`);
  });
});
