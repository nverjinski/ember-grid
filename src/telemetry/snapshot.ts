import { checksumWorld } from "../simulation/checksum";
import type { WorldState } from "../simulation/types";
import {
  assertValidMessageMetadataV1,
  type TelemetryMessageMetadataV1,
} from "./messageMetadata";
import {
  TELEMETRY_PROTOCOL_VERSION,
  type SnapshotMessageV1,
  type WorldSnapshotV1,
} from "./protocol";

export type SnapshotMessageMetadataV1 = TelemetryMessageMetadataV1;

/**
 * Copies authoritative world state into a detached, JSON-safe protocol value.
 */
export function createWorldSnapshotV1(world: WorldState): WorldSnapshotV1 {
  return {
    dimensions: {
      height: world.dimensions.height,
      width: world.dimensions.width,
    },
    fuelBedCodeByCellId: Array.from(world.terrain.fuelBedCode),
    cells: Array.from({ length: world.cellCount }, (_, cellId) => ({
      cellId,
      surfaceFuelLoadGramsPerSquareMeter:
        world.current.surfaceFuelLoadGramsPerSquareMeter[cellId],
      fuelMoisturePermille: world.current.fuelMoisturePermille[cellId],
      temperatureDeciCelsius: world.current.temperatureDeciCelsius[cellId],
      smokeDensityIndex: world.current.smokeDensityIndex[cellId],
      fireIntensityIndex: world.current.fireIntensityIndex[cellId],
    })),
    sensors: Array.from({ length: world.sensors.length }, (_, sensorId) => ({
      sensorId: world.sensors[sensorId].id,
      cellId: world.sensors[sensorId].cellId,
      kind: world.sensors[sensorId].kind,
      status: world.sensors[sensorId].status,
    })),
    wind: { ...world.wind },
  };
}

/**
 * Copies authoritative simulation state into a JSON-safe protocol snapshot.
 * No typed arrays or mutable simulation objects are retained by the message.
 */
export function createSnapshotMessageV1(
  world: WorldState,
  metadata: SnapshotMessageMetadataV1,
): SnapshotMessageV1 {
  assertValidMessageMetadataV1(metadata);

  return {
    protocolVersion: TELEMETRY_PROTOCOL_VERSION,
    sequenceNumber: metadata.sequenceNumber,
    simulationTick: world.tick,
    scheduledDeliveryOffsetMicroseconds:
      metadata.scheduledDeliveryOffsetMicroseconds,
    authoritativeWorldChecksum: checksumWorld(world),
    kind: "snapshot",
    snapshot: createWorldSnapshotV1(world),
  };
}

/**
 * Serializes every field in a prescribed order instead of relying on the
 * insertion history of objects supplied by a caller.
 */
export function serializeSnapshotMessageV1(message: SnapshotMessageV1): string {
  return JSON.stringify({
    protocolVersion: message.protocolVersion,
    kind: message.kind,
    sequenceNumber: message.sequenceNumber,
    simulationTick: message.simulationTick,
    scheduledDeliveryOffsetMicroseconds:
      message.scheduledDeliveryOffsetMicroseconds,
    authoritativeWorldChecksum: message.authoritativeWorldChecksum,
    snapshot: {
      dimensions: {
        width: message.snapshot.dimensions.width,
        height: message.snapshot.dimensions.height,
      },
      fuelBedCodeByCellId: [...message.snapshot.fuelBedCodeByCellId],
      cells: message.snapshot.cells.map((cell) => ({
        cellId: cell.cellId,
        surfaceFuelLoadGramsPerSquareMeter:
          cell.surfaceFuelLoadGramsPerSquareMeter,
        fuelMoisturePermille: cell.fuelMoisturePermille,
        temperatureDeciCelsius: cell.temperatureDeciCelsius,
        smokeDensityIndex: cell.smokeDensityIndex,
        fireIntensityIndex: cell.fireIntensityIndex,
      })),
      sensors: message.snapshot.sensors.map((sensor) => ({
        sensorId: sensor.sensorId,
        cellId: sensor.cellId,
        kind: sensor.kind,
        status: sensor.status,
      })),
      wind: {
        direction: message.snapshot.wind.direction,
        speedCentimetersPerSecond:
          message.snapshot.wind.speedCentimetersPerSecond,
      },
    },
  });
}
