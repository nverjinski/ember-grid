export interface TelemetryMessageMetadataV1 {
  sequenceNumber: number
  scheduledDeliveryOffsetMicroseconds: number
}

export function assertValidMessageMetadataV1(
  metadata: TelemetryMessageMetadataV1,
): void {
  if (!Number.isSafeInteger(metadata.sequenceNumber) || metadata.sequenceNumber < 0) {
    throw new RangeError('sequenceNumber must be a non-negative safe integer')
  }

  if (
    !Number.isSafeInteger(metadata.scheduledDeliveryOffsetMicroseconds) ||
    metadata.scheduledDeliveryOffsetMicroseconds < 0
  ) {
    throw new RangeError(
      'scheduledDeliveryOffsetMicroseconds must be a non-negative safe integer',
    )
  }
}

