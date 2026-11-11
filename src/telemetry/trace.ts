import type { DeltaMessageV1 } from "./protocol";
import { serializeDeltaMessageV1 } from "./deltaSerialization";
import { scheduleTickBatchesV1, type TickBatchScheduleV1 } from "./scheduling";
import { serializeSnapshotMessageV1 } from "./snapshot";
import {
  recordTraceBatchesV1,
  type TraceRecordingConfigV1,
} from "./traceRecording";

export interface TraceGenerationConfigV1 extends TraceRecordingConfigV1 {
  messagesPerSecond: number;
}

export interface SerializedTraceEntryV1 {
  sequenceNumber: number;
  scheduledDeliveryOffsetMicroseconds: number;
  serializedMessage: string;
}

export interface SerializedTraceV1 {
  entries: readonly SerializedTraceEntryV1[];
}

/**
 * Generates a finite canonical trace before replay begins. The initial
 * snapshot is bootstrap data at offset zero; messagesPerSecond schedules the
 * complete delta stream from its own offset-zero origin.
 */
export function createSerializedTraceV1(
  config: TraceGenerationConfigV1,
): SerializedTraceV1 {
  if (
    !Number.isSafeInteger(config.messagesPerSecond) ||
    config.messagesPerSecond <= 0
  ) {
    throw new RangeError(
      "Invalid Config: messagesPerSecond must be a safe, positive integer",
    );
  }

  const recordedTraceBatches = recordTraceBatchesV1(config);
  const entries: SerializedTraceEntryV1[] = [
    {
      sequenceNumber: recordedTraceBatches.initialSnapshot.sequenceNumber,
      scheduledDeliveryOffsetMicroseconds:
        recordedTraceBatches.initialSnapshot
          .scheduledDeliveryOffsetMicroseconds,
      serializedMessage: serializeSnapshotMessageV1(
        recordedTraceBatches.initialSnapshot,
      ),
    },
  ];

  if (recordedTraceBatches.tickBatches.length === 0) {
    return { entries };
  }

  const deltaMessages = scheduleTickBatchesV1(
    recordedTraceBatches.tickBatches,
    createDeltaSchedule(config.messagesPerSecond),
  );
  entries.push(...deltaMessages.map(createDeltaTraceEntry));

  return { entries };
}

function createDeltaTraceEntry(
  message: DeltaMessageV1,
): SerializedTraceEntryV1 {
  return {
    sequenceNumber: message.sequenceNumber,
    scheduledDeliveryOffsetMicroseconds:
      message.scheduledDeliveryOffsetMicroseconds,
    serializedMessage: serializeDeltaMessageV1(message),
  };
}

function createDeltaSchedule(messagesPerSecond: number): TickBatchScheduleV1 {
  return {
    firstSequenceNumber: 1,
    firstScheduledDeliveryOffsetMicroseconds: 0,
    messagesPerSecond,
  };
}
