import type { ScenarioEvent } from "../simulation/events";
import type { WorldInitialization } from "../simulation/initialize";
import { Simulation } from "../simulation/simulation";
import { createTickBatchesV1, type TickBatchV1 } from "./batching";
import { createTickChangeSetV1 } from "./delta";
import type { SnapshotMessageV1 } from "./protocol";
import { createSnapshotMessageV1, createWorldSnapshotV1 } from "./snapshot";

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

/**
 * Runs an owned deterministic simulation for a finite number of ticks and
 * records its initial snapshot plus every ordered, unscheduled tick batch.
 */
export function recordTraceBatchesV1(
  config: TraceRecordingConfigV1,
): RecordedTraceBatchesV1 {
  if (!Number.isSafeInteger(config.tickCount) || config.tickCount < 0)
    throw new RangeError(
      "Invalid Config: tickCount must be a safe, non-negative integer",
    );
  if (
    !Number.isSafeInteger(config.updatesPerMessage) ||
    config.updatesPerMessage <= 0
  )
    throw new RangeError(
      "Invalid Config: updatesPerMessage must be a safe, positive integer",
    );

  const initialTelemetryMessageMetadata = {
    sequenceNumber: 0,
    scheduledDeliveryOffsetMicroseconds: 0,
  };
  const simulation = new Simulation(config.initialization, config.events);
  const initialSnapshot = createSnapshotMessageV1(
    simulation.world,
    initialTelemetryMessageMetadata,
  );
  const tickBatches = [];

  let prevSnapshot = initialSnapshot.snapshot;

  for (let i = 0; i < config.tickCount; i++) {
    simulation.step();
    const tickChangeset = createTickChangeSetV1(prevSnapshot, simulation.world);
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
