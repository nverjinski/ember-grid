import { checksumWorld } from "../simulation/checksum";
import type { WorldState } from "../simulation/types";
import type {
  CellUpdateV1,
  EntityUpdateV1,
  SensorUpdateV1,
  WindUpdateV1,
  WorldSnapshotV1,
} from "./protocol";

export interface TickChangeSetV1 {
  simulationTick: number;
  authoritativeWorldChecksum: string;
  updates: readonly EntityUpdateV1[];
}

function assertCompatibleGrid(
  previousSnapshot: WorldSnapshotV1,
  currentWorld: WorldState,
): void {
  const sameDimensions =
    previousSnapshot.dimensions.width === currentWorld.dimensions.width &&
    previousSnapshot.dimensions.height === currentWorld.dimensions.height;

  if (
    !sameDimensions ||
    previousSnapshot.cells.length !== currentWorld.cellCount
  ) {
    throw new RangeError(
      "previous snapshot and current world must describe the same grid",
    );
  }
}

function assertCompatibleSensors(
  previousSnapshot: WorldSnapshotV1,
  currentWorld: WorldState,
): void {
  if (previousSnapshot.sensors.length !== currentWorld.sensors.length) {
    throw new RangeError(
      "previous snapshot and current world must contain the same sensors",
    );
  }

  for (
    let sensorIndex = 0;
    sensorIndex < currentWorld.sensors.length;
    sensorIndex += 1
  ) {
    if (
      previousSnapshot.sensors[sensorIndex].sensorId !==
      currentWorld.sensors[sensorIndex].id
    ) {
      throw new RangeError(
        "previous snapshot and current world must contain sensors in the same ID order",
      );
    }
  }
}

/**
 * Returns complete replacement records for cells whose dynamic state changed.
 * The result must be ordered by ascending cell ID.
 */
export function collectCellUpdatesV1(
  previousSnapshot: WorldSnapshotV1,
  currentWorld: WorldState,
): CellUpdateV1[] {
  assertCompatibleGrid(previousSnapshot, currentWorld);

  const updates: CellUpdateV1[] = [];
  const current = currentWorld.current;

  for (let cellId = 0; cellId < currentWorld.cellCount; cellId += 1) {
    const previousCell = previousSnapshot.cells[cellId];
    const hasCellUpdated =
      previousCell.surfaceFuelLoadGramsPerSquareMeter !==
        current.surfaceFuelLoadGramsPerSquareMeter[cellId] ||
      previousCell.fuelMoisturePermille !==
        current.fuelMoisturePermille[cellId] ||
      previousCell.temperatureDeciCelsius !==
        current.temperatureDeciCelsius[cellId] ||
      previousCell.smokeDensityIndex !== current.smokeDensityIndex[cellId] ||
      previousCell.fireIntensityIndex !== current.fireIntensityIndex[cellId];

    if (hasCellUpdated) {
      updates.push({
        entityType: "cell",
        cellId,
        surfaceFuelLoadGramsPerSquareMeter:
          current.surfaceFuelLoadGramsPerSquareMeter[cellId],
        fuelMoisturePermille: current.fuelMoisturePermille[cellId],
        temperatureDeciCelsius: current.temperatureDeciCelsius[cellId],
        smokeDensityIndex: current.smokeDensityIndex[cellId],
        fireIntensityIndex: current.fireIntensityIndex[cellId],
      });
    }
  }

  return updates;
}

/**
 * Returns complete replacement records for sensors whose state changed.
 * Sensor addition, removal, and identity changes are not part of protocol v1.
 */
export function collectSensorUpdatesV1(
  previousSnapshot: WorldSnapshotV1,
  currentWorld: WorldState,
): SensorUpdateV1[] {
  assertCompatibleSensors(previousSnapshot, currentWorld);

  const updates: SensorUpdateV1[] = [];

  for (let i = 0; i < previousSnapshot.sensors.length; i++) {
    const prevSensor = previousSnapshot.sensors[i];
    const currSensor = currentWorld.sensors[i];

    const hasSensorUpdated =
      prevSensor.cellId !== currSensor.cellId ||
      prevSensor.kind !== currSensor.kind ||
      prevSensor.status !== currSensor.status;

    if (hasSensorUpdated) {
      updates.push({
        entityType: "sensor",
        sensorId: currSensor.id,
        cellId: currSensor.cellId,
        kind: currSensor.kind,
        status: currSensor.status,
      });
    }
  }

  return updates;
}

/** Returns the complete wind record when either wind field changed. */
export function collectWindUpdateV1(
  previousSnapshot: WorldSnapshotV1,
  currentWorld: WorldState,
): WindUpdateV1 | undefined {
  const prevWind = previousSnapshot.wind;
  const currWind = currentWorld.wind;

  if (
    prevWind.direction !== currWind.direction ||
    prevWind.speedCentimetersPerSecond !== currWind.speedCentimetersPerSecond
  ) {
    return {
      entityType: "wind",
      ...currWind,
    };
  }

  return undefined;
}

/** Collects one tick's logical changes without choosing message boundaries. */
export function createTickChangeSetV1(
  previousSnapshot: WorldSnapshotV1,
  currentWorld: WorldState,
): TickChangeSetV1 {
  const cellUpdates = collectCellUpdatesV1(previousSnapshot, currentWorld);
  const sensorUpdates = collectSensorUpdatesV1(previousSnapshot, currentWorld);
  const windUpdate = collectWindUpdateV1(previousSnapshot, currentWorld);
  const updates: EntityUpdateV1[] = [...cellUpdates, ...sensorUpdates];

  if (windUpdate !== undefined) updates.push(windUpdate);

  return {
    simulationTick: currentWorld.tick,
    authoritativeWorldChecksum: checksumWorld(currentWorld),
    updates,
  };
}
