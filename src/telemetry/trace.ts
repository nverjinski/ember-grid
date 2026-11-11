import type { ScenarioEvent } from "../simulation/events";
import type { WorldInitialization } from "../simulation/initialize";
import { Simulation } from "../simulation/simulation";
import { createTickBatchesV1, type TickBatchV1 } from "./batching";
import { createTickChangeSetV1 } from "./delta";
import { serializeDeltaMessageV1 } from "./deltaSerialization";
import type { TelemetryMessageV1 } from "./protocol";
import { scheduleTickBatchesV1 } from "./scheduling";
import {
  createSnapshotMessageV1,
  createWorldSnapshotV1,
  serializeSnapshotMessageV1,
} from "./snapshot";

export const MAX_TRACE_GRID_CELLS = 256 * 256;
export const MAX_TRACE_TICKS = 2_000;
export const MAX_TRACE_CELL_TICKS = 20_000_000;
export const MAX_TRACE_MESSAGES = 100_000;

export interface TraceConfig {
  initialization: WorldInitialization;
  events?: readonly ScenarioEvent[];
  tickCount: number;
  updatesPerMessage: number;
  messagesPerSecond: number;
}

/** One worker-schedulable canonical JSON payload. */
export interface TraceEntry {
  scheduledOffsetMicroseconds: number;
  json: string;
}

function validateTraceConfig(config: TraceConfig): void {
  if (!Number.isSafeInteger(config.tickCount) || config.tickCount < 0) {
    throw new RangeError("tickCount must be a non-negative safe integer");
  }
  if (config.tickCount > MAX_TRACE_TICKS) {
    throw new RangeError(`tickCount must not exceed ${MAX_TRACE_TICKS}`);
  }
  if (
    !Number.isSafeInteger(config.updatesPerMessage) ||
    config.updatesPerMessage < 1
  ) {
    throw new RangeError("updatesPerMessage must be a positive safe integer");
  }
  if (
    !Number.isSafeInteger(config.messagesPerSecond) ||
    config.messagesPerSecond < 1
  ) {
    throw new RangeError("messagesPerSecond must be a positive safe integer");
  }

  const { width, height } = config.initialization;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new RangeError("trace dimensions must be positive safe integers");
  }

  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount) || cellCount > MAX_TRACE_GRID_CELLS) {
    throw new RangeError(
      `trace grid must contain at most ${MAX_TRACE_GRID_CELLS} cells`,
    );
  }
  if (cellCount * config.tickCount > MAX_TRACE_CELL_TICKS) {
    throw new RangeError(
      `trace generation must not exceed ${MAX_TRACE_CELL_TICKS} cell-ticks`,
    );
  }
}

function createTraceEntry(message: TelemetryMessageV1): TraceEntry {
  return {
    scheduledOffsetMicroseconds:
      message.scheduledDeliveryOffsetMicroseconds,
    json:
      message.kind === "snapshot"
        ? serializeSnapshotMessageV1(message)
        : serializeDeltaMessageV1(message),
  };
}

/** Generates a complete finite trace before replay begins. */
export function createTrace(config: TraceConfig): readonly TraceEntry[] {
  validateTraceConfig(config);

  const simulation = new Simulation(config.initialization, config.events);
  const initialSnapshot = createSnapshotMessageV1(simulation.world, {
    sequenceNumber: 0,
    scheduledDeliveryOffsetMicroseconds: 0,
  });
  const tickBatches: TickBatchV1[] = [];
  let previousSnapshot = initialSnapshot.snapshot;

  for (let tickOffset = 0; tickOffset < config.tickCount; tickOffset += 1) {
    simulation.step();
    const tickChangeSet = createTickChangeSetV1(
      previousSnapshot,
      simulation.world,
    );
    const nextBatchCount = Math.max(
      1,
      Math.ceil(tickChangeSet.updates.length / config.updatesPerMessage),
    );
    if (
      tickBatches.length + nextBatchCount >
      MAX_TRACE_MESSAGES - 1
    ) {
      throw new RangeError(
        `trace must not exceed ${MAX_TRACE_MESSAGES} messages including its snapshot`,
      );
    }

    tickBatches.push(
      ...createTickBatchesV1(tickChangeSet, config.updatesPerMessage),
    );
    previousSnapshot = createWorldSnapshotV1(simulation.world);
  }

  const trace: TraceEntry[] = [createTraceEntry(initialSnapshot)];
  if (tickBatches.length === 0) return trace;

  const deltaMessages = scheduleTickBatchesV1(tickBatches, {
    firstSequenceNumber: 1,
    firstScheduledDeliveryOffsetMicroseconds: 0,
    messagesPerSecond: config.messagesPerSecond,
  });
  trace.push(...deltaMessages.map(createTraceEntry));

  return trace;
}
