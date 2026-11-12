import type { TraceEntry } from "../telemetry/trace";
import type {
  ProducerWorkerCommand,
  ProducerWorkerEvent,
} from "./producerProtocol";

type ProducerReplayState =
  | "unconfigured"
  | "ready"
  | "running"
  | "paused"
  | "complete"
  | "stopped";

export type ProducerWorkerEventEmitter = (event: ProducerWorkerEvent) => void;

export interface ProducerReplayRuntime {
  nowMilliseconds(): number;
  schedule(callback: () => void, delayMilliseconds: number): number;
  cancel(handle: number): void;
}

export const DEFAULT_MAX_MESSAGES_PER_PUMP = 500;

/** Worker-owned lifecycle state, independent from browser timer APIs. */
export class ProducerReplayEngine {
  private runId: number | undefined;
  private trace: readonly TraceEntry[] = [];
  private state: ProducerReplayState = "unconfigured";
  private readonly emit: ProducerWorkerEventEmitter;
  private readonly runtime: ProducerReplayRuntime;
  private readonly maxMessagesPerPump: number;
  private nextEntryIndex = 0;
  private elapsedBeforeStartMilliseconds = 0;
  private startedAtMilliseconds = 0;
  private scheduledPumpHandle: number | undefined;

  constructor(
    emit: ProducerWorkerEventEmitter,
    runtime: ProducerReplayRuntime,
    maxMessagesPerPump = DEFAULT_MAX_MESSAGES_PER_PUMP,
  ) {
    if (!Number.isSafeInteger(maxMessagesPerPump) || maxMessagesPerPump < 1) {
      throw new RangeError(
        "maxMessagesPerPump must be a positive safe integer",
      );
    }

    this.emit = emit;
    this.runtime = runtime;
    this.maxMessagesPerPump = maxMessagesPerPump;
  }

  handle(command: ProducerWorkerCommand): void {
    if (command.type === "configure") {
      this.cancelScheduledPump();
      this.runId = command.runId;
      this.trace = command.trace;
      this.state = "ready";
      this.resetReplayPosition();
      this.emitReady(command.runId);
      return;
    }

    if (this.runId === undefined) {
      this.emit({
        type: "error",
        runId: command.runId,
        message: "worker is not configured",
      });
      return;
    }

    if (command.runId !== this.runId) return;

    switch (command.type) {
      case "start":
        if (this.state !== "ready" && this.state !== "paused") {
          this.emitInvalidTransition(command);
          return;
        }
        this.state = "running";
        this.startedAtMilliseconds =
          this.runtime.nowMilliseconds() - this.elapsedBeforeStartMilliseconds;
        this.emit({
          type: "state",
          runId: command.runId,
          state: "running",
        });
        this.schedulePump(0);
        return;
      case "pause":
        if (this.state !== "running") {
          this.emitInvalidTransition(command);
          return;
        }
        this.elapsedBeforeStartMilliseconds = Math.max(
          0,
          this.runtime.nowMilliseconds() - this.startedAtMilliseconds,
        );
        this.cancelScheduledPump();
        this.state = "paused";
        this.emit({
          type: "state",
          runId: command.runId,
          state: "paused",
        });
        return;
      case "reset":
        this.cancelScheduledPump();
        this.resetReplayPosition();
        this.state = "ready";
        this.emitReady(command.runId);
        return;
      case "stop":
        if (
          this.state !== "ready" &&
          this.state !== "running" &&
          this.state !== "paused"
        ) {
          this.emitInvalidTransition(command);
          return;
        }
        this.cancelScheduledPump();
        this.state = "stopped";
        this.emit({
          type: "state",
          runId: command.runId,
          state: "stopped",
        });
        return;
    }
  }

  private pump(runId: number): void {
    let emittedMessagesCount = 0;

    // TODO: This is your part.
    //
    // - Return unless this is still the active running run.
    // - Convert elapsed runtime milliseconds to integer microseconds.
    // - Emit due trace entries individually, advancing nextEntryIndex, but
    //   never emit more than maxMessagesPerPump in this turn.
    // - Emit one progress event after a turn that posted messages.
    // - When every entry is posted, move to complete and emit complete.
    // - Otherwise schedule the next turn. Use delay zero when the next entry
    //   is already due; for a future entry, ceil its remaining microseconds
    //   to milliseconds so the timer does not intentionally wake early.
    if (this.runId === undefined || this.runId !== runId) return;
    const elapsedIntegerMicroseconds = Math.floor(
      (this.runtime.nowMilliseconds() - this.startedAtMilliseconds) * 1000,
    );

    // pump messages
    while (
      this.trace[this.nextEntryIndex] &&
      this.trace[this.nextEntryIndex].scheduledOffsetMicroseconds <=
        elapsedIntegerMicroseconds &&
      emittedMessagesCount < this.maxMessagesPerPump
    ) {
      this.emit({
        type: "telemetry",
        runId: runId,
        json: this.trace[this.nextEntryIndex].json,
      });
      this.nextEntryIndex += 1;
      emittedMessagesCount += 1;
    }

    // emit a progress event if any messages have been sent
    if (emittedMessagesCount) {
      this.emit({
        type: "progress",
        runId,
        postedCount: this.nextEntryIndex,
        totalCount: this.trace.length,
      });
    }

    // all messages have been sent, move to complete and emit complete
    if (this.nextEntryIndex === this.trace.length) {
      this.state = "complete";
      this.emit({
        type: "complete",
        runId,
        postedCount: this.trace.length,
      });
    }
    // schedule the next turn using the proper delay
    else {
      const delay =
        this.trace[this.nextEntryIndex].scheduledOffsetMicroseconds <
        elapsedIntegerMicroseconds
          ? 0
          : Math.ceil(
              (this.trace[this.nextEntryIndex].scheduledOffsetMicroseconds -
                elapsedIntegerMicroseconds) /
                1000,
            );

      this.schedulePump(delay);
    }
  }

  private schedulePump(delayMilliseconds: number): void {
    const runId = this.runId;
    if (runId === undefined) return;

    this.scheduledPumpHandle = this.runtime.schedule(() => {
      this.scheduledPumpHandle = undefined;
      this.pump(runId);
    }, delayMilliseconds);
  }

  private cancelScheduledPump(): void {
    if (this.scheduledPumpHandle === undefined) return;

    this.runtime.cancel(this.scheduledPumpHandle);
    this.scheduledPumpHandle = undefined;
  }

  private resetReplayPosition(): void {
    this.nextEntryIndex = 0;
    this.elapsedBeforeStartMilliseconds = 0;
    this.startedAtMilliseconds = 0;
  }

  private emitReady(runId: number): void {
    this.emit({
      type: "ready",
      runId,
      totalCount: this.trace.length,
    });
  }

  private emitInvalidTransition(command: ProducerWorkerCommand): void {
    this.emit({
      type: "error",
      runId: command.runId,
      message: `cannot "${command.type}" while worker is ${this.state}`,
    });
  }
}
