import type { TraceEntry } from "../telemetry/trace";

export type ProducerWorkerCommand =
  | {
      type: "configure";
      runId: number;
      trace: readonly TraceEntry[];
    }
  | { type: "start"; runId: number }
  | { type: "pause"; runId: number }
  | { type: "reset"; runId: number }
  | { type: "stop"; runId: number };

export type ProducerWorkerEvent =
  | {
      type: "ready";
      runId: number;
      totalCount: number;
    }
  | {
      type: "state";
      runId: number;
      state: "running" | "paused" | "stopped";
    }
  | {
      type: "telemetry";
      runId: number;
      json: string;
    }
  | {
      type: "progress";
      runId: number;
      postedCount: number;
      totalCount: number;
    }
  | {
      type: "complete";
      runId: number;
      postedCount: number;
    }
  | {
      type: "error";
      runId: number;
      message: string;
    };

/**
 * Narrows unknown main-thread input before the worker state machine handles it.
 * Configure commands must contain a nonempty trace with nondecreasing,
 * non-negative safe-integer offsets and string payloads.
 */
export function isProducerWorkerCommand(
  value: unknown,
): value is ProducerWorkerCommand {
  if (value === null || typeof value !== "object") return false;

  const command = value as Record<string, unknown>;
  const { type, runId } = command;
  if (!Number.isSafeInteger(runId) || (runId as number) < 0) return false;

  if (type !== "configure") {
    return type === "start" || type === "pause" || type === "reset" || type === "stop";
  }

  const trace = command.trace;
  if (!Array.isArray(trace) || trace.length === 0) return false;

  let previousOffset = 0;
  for (let index = 0; index < trace.length; index += 1) {
    const entry = trace[index] as Partial<TraceEntry> | null;
    if (entry === null || typeof entry !== "object") return false;

    const offset = entry.scheduledOffsetMicroseconds;
    if (
      !Number.isSafeInteger(offset) ||
      (offset as number) < previousOffset ||
      typeof entry.json !== "string"
    ) {
      return false;
    }
    previousOffset = offset as number;
  }

  return true;
}
