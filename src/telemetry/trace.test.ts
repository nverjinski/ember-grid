import { describe, expect, it } from "vitest";
import type { TelemetryMessageV1 } from "./protocol";
import { serializeDeltaMessageV1 } from "./deltaSerialization";
import { serializeSnapshotMessageV1 } from "./snapshot";
import { createTrace, type TraceConfig } from "./trace";

const TRACE_CONFIG: TraceConfig = {
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

describe("serialized telemetry traces", () => {
  it("prepends one snapshot and globally schedules every delta batch", () => {
    const trace = createTrace(TRACE_CONFIG);
    const messages = trace.map(({ json }) =>
      JSON.parse(json) as TelemetryMessageV1,
    );

    expect(messages[0]).toMatchObject({
      kind: "snapshot",
      sequenceNumber: 0,
      scheduledDeliveryOffsetMicroseconds: 0,
    });
    expect(messages.slice(1).every(({ kind }) => kind === "delta")).toBe(true);

    const deltaEntries = trace.slice(1);
    expect(messages.slice(1).map(({ sequenceNumber }) => sequenceNumber)).toEqual(
      deltaEntries.map((_, index) => index + 1),
    );
    expect(
      deltaEntries.map(
        ({ scheduledOffsetMicroseconds }) => scheduledOffsetMicroseconds,
      ),
    ).toEqual(
      deltaEntries.map((_, index) =>
        Math.floor((index * 1_000_000) / TRACE_CONFIG.messagesPerSecond),
      ),
    );
  });

  it("stores canonical JSON whose routing metadata matches its trace entry", () => {
    const trace = createTrace(TRACE_CONFIG);

    for (const entry of trace) {
      const message = JSON.parse(entry.json) as TelemetryMessageV1;
      const canonical =
        message.kind === "snapshot"
          ? serializeSnapshotMessageV1(message)
          : serializeDeltaMessageV1(message);

      expect(entry.json).toBe(canonical);
      expect(entry.scheduledOffsetMicroseconds).toBe(
        message.scheduledDeliveryOffsetMicroseconds,
      );
    }
  });

  it("supports a canonical snapshot-only trace", () => {
    const trace = createTrace({
      ...TRACE_CONFIG,
      tickCount: 0,
    });

    expect(trace).toHaveLength(1);
    expect(JSON.parse(trace[0].json)).toMatchObject({
      kind: "snapshot",
      sequenceNumber: 0,
      scheduledDeliveryOffsetMicroseconds: 0,
    });
  });

  it("rejects an invalid message rate before generating the trace", () => {
    expect(() =>
      createTrace({
        ...TRACE_CONFIG,
        tickCount: 0,
        messagesPerSecond: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createTrace({
        ...TRACE_CONFIG,
        messagesPerSecond: 1.5,
      }),
    ).toThrow(RangeError);
  });
});
