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
  | "stopped";

export type ProducerWorkerEventEmitter = (event: ProducerWorkerEvent) => void;

/** Worker-owned lifecycle state, independent from browser timer APIs. */
export class ProducerReplayEngine {
  private runId: number | undefined;
  private trace: readonly TraceEntry[] = [];
  private state: ProducerReplayState = "unconfigured";
  private readonly emit: ProducerWorkerEventEmitter;

  constructor(emit: ProducerWorkerEventEmitter) {
    this.emit = emit;
  }

  handle(command: ProducerWorkerCommand): void {
    if (command.type === "configure") {
      this.runId = command.runId;
      this.trace = command.trace;
      this.state = "ready";
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
        this.emit({
          type: "state",
          runId: command.runId,
          state: "running",
        });
        return;
      case "pause":
        if (this.state !== "running") {
          this.emitInvalidTransition(command);
          return;
        }
        this.state = "paused";
        this.emit({
          type: "state",
          runId: command.runId,
          state: "paused",
        });
        return;
      case "reset":
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
        this.state = "stopped";
        this.emit({
          type: "state",
          runId: command.runId,
          state: "stopped",
        });
        return;
    }
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
