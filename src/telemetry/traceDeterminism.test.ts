import { describe, expect, it } from "vitest";
import type { DeltaMessageV1, TelemetryMessageV1 } from "./protocol";
import {
  createTrace,
  MAX_TRACE_CELL_TICKS,
  MAX_TRACE_GRID_CELLS,
  MAX_TRACE_MESSAGES,
  MAX_TRACE_TICKS,
  type TraceConfig,
} from "./trace";

function createConfig(seed: number): TraceConfig {
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

function parseTrace(config: TraceConfig): TelemetryMessageV1[] {
  return createTrace(config).map(
    ({ json }) => JSON.parse(json) as TelemetryMessageV1,
  );
}

describe("finite trace determinism", () => {
  it("repeats byte-for-byte for each of two seeds", () => {
    for (const seed of [42, 99]) {
      const config = createConfig(seed);
      expect(createTrace(config)).toEqual(createTrace(config));
    }
  });

  it("distinguishes traces generated from different seeds", () => {
    const first = createTrace(createConfig(42));
    const second = createTrace(createConfig(99));

    expect(first.map(({ json }) => json)).not.toEqual(
      second.map(({ json }) => json),
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
      createTrace({
        ...base,
        initialization: {
          ...base.initialization,
          width: 257,
          height: 256,
        },
      }),
    ).toThrow(`${MAX_TRACE_GRID_CELLS}`);
    expect(() =>
      createTrace({ ...base, tickCount: MAX_TRACE_TICKS + 1 }),
    ).toThrow(`${MAX_TRACE_TICKS}`);
    expect(() =>
      createTrace({
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
      createTrace({
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
