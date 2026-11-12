import { describe, expect, it } from "vitest";
import {
  isProducerWorkerCommand,
  type ProducerWorkerCommand,
  type ProducerWorkerEvent,
} from "./producerProtocol";

const TRACE = [
  { scheduledOffsetMicroseconds: 0, json: '{"kind":"snapshot"}' },
  { scheduledOffsetMicroseconds: 0, json: '{"kind":"delta"}' },
  { scheduledOffsetMicroseconds: 200, json: '{"kind":"delta"}' },
] as const;

describe("producer-worker command contract", () => {
  it("accepts configure and every lifecycle command", () => {
    const commands: ProducerWorkerCommand[] = [
      { type: "configure", runId: 7, trace: TRACE },
      { type: "start", runId: 7 },
      { type: "pause", runId: 7 },
      { type: "reset", runId: 7 },
      { type: "stop", runId: 7 },
    ];

    expect(commands.every(isProducerWorkerCommand)).toBe(true);
  });

  it("rejects unknown shapes, command types, and run identities", () => {
    expect(isProducerWorkerCommand(null)).toBe(false);
    expect(isProducerWorkerCommand("start")).toBe(false);
    expect(isProducerWorkerCommand({ type: "launch", runId: 7 })).toBe(false);
    expect(isProducerWorkerCommand({ type: "start" })).toBe(false);
    expect(isProducerWorkerCommand({ type: "start", runId: -1 })).toBe(false);
    expect(isProducerWorkerCommand({ type: "start", runId: 1.5 })).toBe(
      false,
    );
  });

  it("rejects malformed and out-of-order configured traces", () => {
    expect(
      isProducerWorkerCommand({ type: "configure", runId: 7, trace: [] }),
    ).toBe(false);
    expect(
      isProducerWorkerCommand({
        type: "configure",
        runId: 7,
        trace: [{ scheduledOffsetMicroseconds: -1, json: "{}" }],
      }),
    ).toBe(false);
    expect(
      isProducerWorkerCommand({
        type: "configure",
        runId: 7,
        trace: [{ scheduledOffsetMicroseconds: 0, json: 42 }],
      }),
    ).toBe(false);
    expect(
      isProducerWorkerCommand({
        type: "configure",
        runId: 7,
        trace: [
          { scheduledOffsetMicroseconds: 200, json: "{}" },
          { scheduledOffsetMicroseconds: 100, json: "{}" },
        ],
      }),
    ).toBe(false);
  });
});

describe("producer-worker event contract", () => {
  it("represents lifecycle, telemetry, progress, completion, and errors", () => {
    const events: ProducerWorkerEvent[] = [
      { type: "ready", runId: 7, totalCount: 3 },
      { type: "state", runId: 7, state: "running" },
      { type: "telemetry", runId: 7, json: TRACE[0].json },
      { type: "progress", runId: 7, postedCount: 1, totalCount: 3 },
      { type: "complete", runId: 7, postedCount: 3 },
      { type: "error", runId: 7, message: "invalid transition" },
    ];

    expect(events.map(({ type }) => type)).toEqual([
      "ready",
      "state",
      "telemetry",
      "progress",
      "complete",
      "error",
    ]);
  });
});
