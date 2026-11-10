import type { DeltaMessageV1, EntityUpdateV1 } from "./protocol";

function unsupportedEntityUpdate(update: never): never {
  throw new TypeError(`unsupported entity update: ${String(update)}`);
}

function canonicalizeEntityUpdateV1(update: EntityUpdateV1): EntityUpdateV1 {
  switch (update.entityType) {
    case "cell":
      return {
        entityType: "cell",
        cellId: update.cellId,
        surfaceFuelLoadGramsPerSquareMeter:
          update.surfaceFuelLoadGramsPerSquareMeter,
        fuelMoisturePermille: update.fuelMoisturePermille,
        temperatureDeciCelsius: update.temperatureDeciCelsius,
        smokeDensityIndex: update.smokeDensityIndex,
        fireIntensityIndex: update.fireIntensityIndex,
      };
    case "sensor":
      return {
        entityType: "sensor",
        sensorId: update.sensorId,
        cellId: update.cellId,
        kind: update.kind,
        status: update.status,
      };
    case "wind":
      return {
        entityType: "wind",
        direction: update.direction,
        speedCentimetersPerSecond: update.speedCentimetersPerSecond,
      };
    default:
      return unsupportedEntityUpdate(update);
  }
}

/** Serializes a delta using prescribed header and entity-field ordering. */
export function serializeDeltaMessageV1(message: DeltaMessageV1): string {
  return JSON.stringify({
    protocolVersion: message.protocolVersion,
    kind: message.kind,
    sequenceNumber: message.sequenceNumber,
    simulationTick: message.simulationTick,
    scheduledDeliveryOffsetMicroseconds:
      message.scheduledDeliveryOffsetMicroseconds,
    authoritativeWorldChecksum: message.authoritativeWorldChecksum,
    tickBatchIndex: message.tickBatchIndex,
    tickBatchCount: message.tickBatchCount,
    updates: message.updates.map(canonicalizeEntityUpdateV1),
  });
}
