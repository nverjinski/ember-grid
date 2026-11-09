import type { EntityUpdateV1 } from "./protocol";
import type { TickChangeSetV1 } from "./delta";

export interface TickBatchV1 {
  simulationTick: number;
  authoritativeWorldChecksum: string;
  /** Zero-based position among the batches for this tick. */
  tickBatchIndex: number;
  tickBatchCount: number;
  updates: readonly EntityUpdateV1[];
}

function assertValidUpdatesPerMessage(updatesPerMessage: number): void {
  if (!Number.isSafeInteger(updatesPerMessage) || updatesPerMessage < 1) {
    throw new RangeError("updatesPerMessage must be a positive safe integer");
  }
}

/**
 * Partitions an ordered tick change set into ordered message payloads.
 * An empty change set still produces one empty payload so the tick can advance.
 */
export function partitionUpdatesV1(
  updates: readonly EntityUpdateV1[],
  updatesPerMessage: number,
): EntityUpdateV1[][] {
  assertValidUpdatesPerMessage(updatesPerMessage);
  const partitionedUpdates: EntityUpdateV1[][] = [];

  if (updates.length === 0) {
    partitionedUpdates.push([]);
    return partitionedUpdates;
  }

  let index = 0;
  while (index < updates.length) {
    partitionedUpdates.push(updates.slice(index, index + updatesPerMessage));
    index += updatesPerMessage;
  }

  return partitionedUpdates;
}

/** Attaches tick-level identity and completion metadata to update partitions. */
export function createTickBatchesV1(
  changeSet: TickChangeSetV1,
  updatesPerMessage: number,
): TickBatchV1[] {
  const partitions = partitionUpdatesV1(changeSet.updates, updatesPerMessage);

  return partitions.map((partition, index) => ({
    simulationTick: changeSet.simulationTick,
    authoritativeWorldChecksum: changeSet.authoritativeWorldChecksum,
    tickBatchIndex: index,
    tickBatchCount: partitions.length,
    updates: partition,
  }));
}
