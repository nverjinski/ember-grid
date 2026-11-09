import { assertValidMessageMetadataV1 } from "./messageMetadata";
import { TELEMETRY_PROTOCOL_VERSION, type DeltaMessageV1 } from "./protocol";
import type { TickBatchV1 } from "./batching";

const MICROSECONDS_PER_SECOND = 1_000_000;

export interface TickBatchScheduleV1 {
  firstSequenceNumber: number;
  firstScheduledDeliveryOffsetMicroseconds: number;
  messagesPerSecond: number;
}

function scheduledDeliveryOffsetAt(
  schedule: TickBatchScheduleV1,
  messageOffset: number,
): number {
  return (
    schedule.firstScheduledDeliveryOffsetMicroseconds +
    Math.floor(
      (messageOffset * MICROSECONDS_PER_SECOND) / schedule.messagesPerSecond,
    )
  );
}

function assertValidSchedule(
  batches: readonly TickBatchV1[],
  schedule: TickBatchScheduleV1,
): void {
  if (batches.length === 0) {
    throw new RangeError("at least one tick batch is required");
  }

  assertValidMessageMetadataV1({
    sequenceNumber: schedule.firstSequenceNumber,
    scheduledDeliveryOffsetMicroseconds:
      schedule.firstScheduledDeliveryOffsetMicroseconds,
  });

  if (
    !Number.isSafeInteger(schedule.messagesPerSecond) ||
    schedule.messagesPerSecond < 1
  ) {
    throw new RangeError("messagesPerSecond must be a positive safe integer");
  }

  const lastOffset = batches.length - 1;
  const lastSequenceNumber = schedule.firstSequenceNumber + lastOffset;
  const lastScheduledOffset = scheduledDeliveryOffsetAt(schedule, lastOffset);
  if (
    !Number.isSafeInteger(lastSequenceNumber) ||
    !Number.isSafeInteger(lastScheduledOffset)
  ) {
    throw new RangeError("scheduled message metadata exceeds safe integers");
  }
}

/** Assigns protocol identity and a deterministic logical schedule to a tick. */
export function scheduleTickBatchesV1(
  batches: readonly TickBatchV1[],
  schedule: TickBatchScheduleV1,
): DeltaMessageV1[] {
  assertValidSchedule(batches, schedule);

  return batches.map((batch, messageOffset) => ({
    protocolVersion: TELEMETRY_PROTOCOL_VERSION,
    kind: "delta",
    sequenceNumber: schedule.firstSequenceNumber + messageOffset,
    simulationTick: batch.simulationTick,
    scheduledDeliveryOffsetMicroseconds: scheduledDeliveryOffsetAt(
      schedule,
      messageOffset,
    ),
    authoritativeWorldChecksum: batch.authoritativeWorldChecksum,
    tickBatchIndex: batch.tickBatchIndex,
    tickBatchCount: batch.tickBatchCount,
    updates: batch.updates,
  }));
}
