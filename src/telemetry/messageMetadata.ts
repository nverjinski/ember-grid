export interface TelemetryMessageMetadataV1 {
  sequenceNumber: number
  scheduledDeliveryTimeMilliseconds: number
}

export function assertValidMessageMetadataV1(
  metadata: TelemetryMessageMetadataV1,
): void {
  if (!Number.isSafeInteger(metadata.sequenceNumber) || metadata.sequenceNumber < 0) {
    throw new RangeError('sequenceNumber must be a non-negative safe integer')
  }

  if (
    !Number.isSafeInteger(metadata.scheduledDeliveryTimeMilliseconds) ||
    metadata.scheduledDeliveryTimeMilliseconds < 0
  ) {
    throw new RangeError(
      'scheduledDeliveryTimeMilliseconds must be a non-negative safe integer',
    )
  }
}

