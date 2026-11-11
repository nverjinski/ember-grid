import type { ScenarioEvent } from "../simulation/events";
import type { WorldInitialization } from "../simulation/initialize";
import { Simulation } from "../simulation/simulation";
import { createTickBatchesV1, type TickBatchV1 } from "./batching";
import { createTickChangeSetV1 } from "./delta";
import type { SnapshotMessageV1 } from "./protocol";
import { createSnapshotMessageV1, createWorldSnapshotV1 } from "./snapshot";

export const MAX_TRACE_GRID_CELLS = 256 * 256;
export const MAX_TRACE_TICKS = 2_000;
export const MAX_TRACE_CELL_TICKS = 20_000_000;
export const MAX_TRACE_MESSAGES = 100_000;

export interface TraceRecordingConfigV1 {
  initialization: WorldInitialization;
  events?: readonly ScenarioEvent[];
  tickCount: number;
  updatesPerMessage: number;
}

export interface RecordedTraceBatchesV1 {
  initialSnapshot: SnapshotMessageV1;
  tickBatches: readonly TickBatchV1[];
}

function validateTraceRecordingConfig(config: TraceRecordingConfigV1): void {
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

/**
 * Runs an owned deterministic simulation for a finite number of ticks and
 * records its initial snapshot plus every ordered, unscheduled tick batch.
 */
export function recordTraceBatchesV1(
  config: TraceRecordingConfigV1,
): RecordedTraceBatchesV1 {
  validateTraceRecordingConfig(config);

  const initialTelemetryMessageMetadata = {
    sequenceNumber: 0,
    scheduledDeliveryOffsetMicroseconds: 0,
  };
  const simulation = new Simulation(config.initialization, config.events);
  const initialSnapshot = createSnapshotMessageV1(
    simulation.world,
    initialTelemetryMessageMetadata,
  );
  const tickBatches: TickBatchV1[] = [];

  let prevSnapshot = initialSnapshot.snapshot;

  for (let i = 0; i < config.tickCount; i++) {
    simulation.step();
    const tickChangeset = createTickChangeSetV1(prevSnapshot, simulation.world);
    const nextBatchCount = Math.max(
      1,
      Math.ceil(tickChangeset.updates.length / config.updatesPerMessage),
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
      ...createTickBatchesV1(tickChangeset, config.updatesPerMessage),
    );
    prevSnapshot = createWorldSnapshotV1(simulation.world);
  }

  return {
    initialSnapshot,
    tickBatches,
  };
}
