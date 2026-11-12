import { describe, expect, it } from "vitest";
import type { TraceEntry } from "../telemetry/trace";
import type { ProducerWorkerEvent } from "./producerProtocol";
import {
  ProducerReplayEngine,
  type ProducerReplayRuntime,
} from "./producerReplayEngine";

class FakeReplayRuntime implements ProducerReplayRuntime {
  now = 0;
  private nextHandle = 1;
  private readonly callbacks = new Map<
    number,
    { callback: () => void; delayMilliseconds: number }
  >();

  nowMilliseconds(): number {
    return this.now;
  }

  schedule(callback: () => void, delayMilliseconds: number): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, { callback, delayMilliseconds });
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  get pendingCount(): number {
    return this.callbacks.size;
  }

  get nextDelayMilliseconds(): number | undefined {
    return this.callbacks.values().next().value?.delayMilliseconds;
  }

  runNext(): void {
    const next = this.callbacks.entries().next().value as
      | [number, { callback: () => void }]
      | undefined;
    if (next === undefined) throw new Error("no pump is scheduled");

    const [handle, { callback }] = next;
    this.callbacks.delete(handle);
    callback();
  }
}

function createPumpEngine(
  trace: readonly TraceEntry[],
  maxMessagesPerPump = 2,
) {
  const runtime = new FakeReplayRuntime();
  const events: ProducerWorkerEvent[] = [];
  const engine = new ProducerReplayEngine(
    (event) => events.push(event),
    runtime,
    maxMessagesPerPump,
  );
  engine.handle({ type: "configure", runId: 7, trace });
  events.length = 0;
  return { engine, runtime, events };
}

describe("bounded producer replay pump", () => {
  it("posts due entries individually and yields at the per-turn bound", () => {
    const trace = Array.from({ length: 5 }, (_, index) => ({
      scheduledOffsetMicroseconds: 0,
      json: `message-${index}`,
    }));
    const { engine, runtime, events } = createPumpEngine(trace, 2);

    engine.handle({ type: "start", runId: 7 });
    expect(runtime.nextDelayMilliseconds).toBe(0);

    runtime.runNext();
    expect(events.filter(({ type }) => type === "telemetry")).toHaveLength(2);
    expect(events.at(-1)).toEqual({
      type: "progress",
      runId: 7,
      postedCount: 2,
      totalCount: 5,
    });
    expect(runtime.nextDelayMilliseconds).toBe(0);

    runtime.runNext();
    runtime.runNext();
    expect(
      events
        .filter(({ type }) => type === "telemetry")
        .map((event) => (event.type === "telemetry" ? event.json : undefined)),
    ).toEqual(trace.map(({ json }) => json));
    expect(events.at(-1)).toEqual({
      type: "complete",
      runId: 7,
      postedCount: 5,
    });
    expect(runtime.pendingCount).toBe(0);
  });

  it("waits until the next logical offset is due", () => {
    const { engine, runtime, events } = createPumpEngine([
      { scheduledOffsetMicroseconds: 0, json: "now" },
      { scheduledOffsetMicroseconds: 2_500, json: "later" },
    ]);
    engine.handle({ type: "start", runId: 7 });

    runtime.runNext();
    expect(runtime.nextDelayMilliseconds).toBe(3);
    expect(events.some((event) => event.type === "complete")).toBe(false);

    runtime.now = 3;
    runtime.runNext();
    expect(events.at(-1)).toEqual({
      type: "complete",
      runId: 7,
      postedCount: 2,
    });
  });

  it("preserves elapsed time across pause and resume", () => {
    const { engine, runtime, events } = createPumpEngine([
      { scheduledOffsetMicroseconds: 0, json: "first" },
      { scheduledOffsetMicroseconds: 10_000, json: "second" },
    ]);
    engine.handle({ type: "start", runId: 7 });
    runtime.runNext();

    runtime.now = 4;
    engine.handle({ type: "pause", runId: 7 });
    expect(runtime.pendingCount).toBe(0);

    runtime.now = 100;
    engine.handle({ type: "start", runId: 7 });
    runtime.runNext();
    expect(runtime.nextDelayMilliseconds).toBe(6);
    expect(events.filter(({ type }) => type === "telemetry")).toHaveLength(1);

    runtime.now = 106;
    runtime.runNext();
    expect(events.at(-1)?.type).toBe("complete");
  });

  it("reset replays from the beginning and stop cancels future work", () => {
    const { engine, runtime, events } = createPumpEngine([
      { scheduledOffsetMicroseconds: 0, json: "first" },
      { scheduledOffsetMicroseconds: 10_000, json: "second" },
    ]);
    engine.handle({ type: "start", runId: 7 });
    runtime.runNext();
    expect(events.filter(({ type }) => type === "telemetry")).toHaveLength(1);

    engine.handle({ type: "reset", runId: 7 });
    engine.handle({ type: "start", runId: 7 });
    runtime.runNext();
    expect(
      events
        .filter(({ type }) => type === "telemetry")
        .map((event) => (event.type === "telemetry" ? event.json : undefined)),
    ).toEqual(["first", "first"]);

    engine.handle({ type: "stop", runId: 7 });
    expect(runtime.pendingCount).toBe(0);
  });
});
