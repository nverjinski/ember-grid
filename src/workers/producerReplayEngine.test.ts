import { describe, expect, it, vi } from "vitest";
import type { TraceEntry } from "../telemetry/trace";
import type { ProducerWorkerEvent } from "./producerProtocol";
import {
  ProducerReplayEngine,
  type ProducerReplayRuntime,
} from "./producerReplayEngine";

const TRACE: readonly TraceEntry[] = [
  { scheduledOffsetMicroseconds: 0, json: '{"kind":"snapshot"}' },
  { scheduledOffsetMicroseconds: 0, json: '{"kind":"delta"}' },
  { scheduledOffsetMicroseconds: 200, json: '{"kind":"delta"}' },
];

function createEngine() {
  const events: ProducerWorkerEvent[] = [];
  const emit = vi.fn((event: ProducerWorkerEvent) => events.push(event));
  const runtime: ProducerReplayRuntime = {
    nowMilliseconds: () => 0,
    schedule: () => 1,
    cancel: () => undefined,
  };
  return {
    engine: new ProducerReplayEngine(emit, runtime),
    emit,
    events,
  };
}

describe("producer replay lifecycle", () => {
  it("configures a run and reports readiness", () => {
    const { engine, events } = createEngine();

    engine.handle({ type: "configure", runId: 7, trace: TRACE });

    expect(events).toEqual([{ type: "ready", runId: 7, totalCount: 3 }]);
  });

  it("supports valid start, pause, reset, and stop transitions", () => {
    const { engine, events } = createEngine();
    engine.handle({ type: "configure", runId: 7, trace: TRACE });
    events.length = 0;

    engine.handle({ type: "start", runId: 7 });
    engine.handle({ type: "pause", runId: 7 });
    engine.handle({ type: "reset", runId: 7 });
    engine.handle({ type: "start", runId: 7 });
    engine.handle({ type: "stop", runId: 7 });

    expect(events).toEqual([
      { type: "state", runId: 7, state: "running" },
      { type: "state", runId: 7, state: "paused" },
      { type: "ready", runId: 7, totalCount: 3 },
      { type: "state", runId: 7, state: "running" },
      { type: "state", runId: 7, state: "stopped" },
    ]);
  });

  it("silently ignores commands from an obsolete run", () => {
    const { engine, events } = createEngine();
    engine.handle({ type: "configure", runId: 7, trace: TRACE });
    events.length = 0;

    engine.handle({ type: "start", runId: 6 });
    engine.handle({ type: "pause", runId: 8 });
    engine.handle({ type: "reset", runId: 6 });
    engine.handle({ type: "stop", runId: 8 });

    expect(events).toEqual([]);
  });

  it("treats zero as a valid run identity when rejecting stale commands", () => {
    const { engine, events } = createEngine();
    engine.handle({ type: "configure", runId: 0, trace: TRACE });
    events.length = 0;

    engine.handle({ type: "start", runId: 1 });

    expect(events).toEqual([]);
  });

  it("lets configure replace any existing run", () => {
    const { engine, events } = createEngine();
    const replacementTrace = TRACE.slice(0, 1);
    engine.handle({ type: "configure", runId: 7, trace: TRACE });
    engine.handle({ type: "start", runId: 7 });
    events.length = 0;

    engine.handle({
      type: "configure",
      runId: 8,
      trace: replacementTrace,
    });
    engine.handle({ type: "start", runId: 7 });

    expect(events).toEqual([{ type: "ready", runId: 8, totalCount: 1 }]);
  });
  it("reports invalid current-run transitions without changing state", () => {
    const { engine, events } = createEngine();

    engine.handle({ type: "start", runId: 7 });
    expect(events).toEqual([
      { type: "error", runId: 7, message: "worker is not configured" },
    ]);

    events.length = 0;
    engine.handle({ type: "configure", runId: 7, trace: TRACE });
    events.length = 0;
    engine.handle({ type: "pause", runId: 7 });
    engine.handle({ type: "stop", runId: 7 });
    engine.handle({ type: "start", runId: 7 });

    expect(events).toEqual([
      {
        type: "error",
        runId: 7,
        message: 'cannot "pause" while worker is ready',
      },
      { type: "state", runId: 7, state: "stopped" },
      {
        type: "error",
        runId: 7,
        message: 'cannot "start" while worker is stopped',
      },
    ]);
  });
});
