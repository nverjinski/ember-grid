import { describe, expect, it } from "vitest";
import type { TelemetryMessageV1 } from "./protocol";
import { serializeDeltaMessageV1 } from "./deltaSerialization";
import { serializeSnapshotMessageV1 } from "./snapshot";
import {
  createSerializedTraceV1,
  type TraceGenerationConfigV1,
} from "./trace";

const TRACE_CONFIG: TraceGenerationConfigV1 = {
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
    const { entries } = createSerializedTraceV1(TRACE_CONFIG);
    const messages = entries.map(({ serializedMessage }) =>
      JSON.parse(serializedMessage) as TelemetryMessageV1,
    );

    expect(messages[0]).toMatchObject({
      kind: "snapshot",
      sequenceNumber: 0,
      scheduledDeliveryOffsetMicroseconds: 0,
    });
    expect(messages.slice(1).every(({ kind }) => kind === "delta")).toBe(true);

    const deltaEntries = entries.slice(1);
    expect(deltaEntries.map(({ sequenceNumber }) => sequenceNumber)).toEqual(
      deltaEntries.map((_, index) => index + 1),
    );
    expect(
      deltaEntries.map(({ scheduledDeliveryOffsetMicroseconds }) =>
        scheduledDeliveryOffsetMicroseconds,
      ),
    ).toEqual(
      deltaEntries.map((_, index) =>
        Math.floor((index * 1_000_000) / TRACE_CONFIG.messagesPerSecond),
      ),
    );
  });

  it("stores canonical JSON whose routing metadata matches its trace entry", () => {
    const { entries } = createSerializedTraceV1(TRACE_CONFIG);

    for (const entry of entries) {
      const message = JSON.parse(entry.serializedMessage) as TelemetryMessageV1;
      const canonical =
        message.kind === "snapshot"
          ? serializeSnapshotMessageV1(message)
          : serializeDeltaMessageV1(message);

      expect(entry.serializedMessage).toBe(canonical);
      expect(entry.sequenceNumber).toBe(message.sequenceNumber);
      expect(entry.scheduledDeliveryOffsetMicroseconds).toBe(
        message.scheduledDeliveryOffsetMicroseconds,
      );
    }
  });

  it("supports a canonical snapshot-only trace", () => {
    const { entries } = createSerializedTraceV1({
      ...TRACE_CONFIG,
      tickCount: 0,
    });

    expect(entries).toHaveLength(1);
    expect(JSON.parse(entries[0].serializedMessage)).toMatchObject({
      kind: "snapshot",
      sequenceNumber: 0,
      scheduledDeliveryOffsetMicroseconds: 0,
    });
  });

  it("rejects an invalid message rate before generating the trace", () => {
    expect(() =>
      createSerializedTraceV1({
        ...TRACE_CONFIG,
        tickCount: 0,
        messagesPerSecond: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createSerializedTraceV1({
        ...TRACE_CONFIG,
        messagesPerSecond: 1.5,
      }),
    ).toThrow(RangeError);
  });
});
