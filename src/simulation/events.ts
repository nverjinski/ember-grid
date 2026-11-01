import {
  NORMALIZED_INDEX_MAX,
  WIND_DIRECTIONS,
  type SensorStatus,
  type WindDirection,
  type WorldState,
} from './types'

const PERMILLE_SCALE = 1_000

interface EventAtTick {
  tick: number
}

export interface IgnitionEvent extends EventAtTick {
  type: 'ignition'
  cellId: number
  intensityIndex: number
}

export interface WindShiftEvent extends EventAtTick {
  type: 'wind-shift'
  direction: WindDirection
  speedCentimetersPerSecond: number
}

export interface ContainmentEvent extends EventAtTick {
  type: 'containment'
  cellIds: readonly number[]
  fuelRemovalPermille: number
}

export interface SensorStatusEvent extends EventAtTick {
  type: 'sensor-status'
  sensorId: number
  status: SensorStatus
}

export type ScenarioEvent =
  | IgnitionEvent
  | WindShiftEvent
  | ContainmentEvent
  | SensorStatusEvent

function assertIntegerInRange(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    )
  }
}

export function validateScenarioEvent(
  world: WorldState,
  event: ScenarioEvent,
): void {
  assertIntegerInRange('event tick', event.tick, 0, Number.MAX_SAFE_INTEGER)

  switch (event.type) {
    case 'ignition':
      assertIntegerInRange('cellId', event.cellId, 0, world.cellCount - 1)
      assertIntegerInRange(
        'intensityIndex',
        event.intensityIndex,
        0,
        NORMALIZED_INDEX_MAX,
      )
      break

    case 'wind-shift':
      if (!WIND_DIRECTIONS.includes(event.direction)) {
        throw new RangeError(`unknown wind direction: ${event.direction}`)
      }
      assertIntegerInRange(
        'speedCentimetersPerSecond',
        event.speedCentimetersPerSecond,
        0,
        Number.MAX_SAFE_INTEGER,
      )
      break

    case 'containment':
      assertIntegerInRange(
        'fuelRemovalPermille',
        event.fuelRemovalPermille,
        0,
        PERMILLE_SCALE,
      )
      for (const cellId of event.cellIds) {
        assertIntegerInRange('cellId', cellId, 0, world.cellCount - 1)
      }
      break

    case 'sensor-status':
      if (!world.sensors.some((sensor) => sensor.id === event.sensorId)) {
        throw new RangeError(`unknown sensor ID: ${event.sensorId}`)
      }
      break
  }
}

/** Applies an already-validated event to the state at its assigned tick. */
export function applyScenarioEvent(
  world: WorldState,
  event: ScenarioEvent,
): void {
  switch (event.type) {
    case 'ignition':
      world.current.fireIntensityIndex[event.cellId] = Math.max(
        world.current.fireIntensityIndex[event.cellId],
        event.intensityIndex,
      )
      break

    case 'wind-shift':
      world.wind = {
        direction: event.direction,
        speedCentimetersPerSecond: event.speedCentimetersPerSecond,
      }
      break

    case 'containment': {
      const remainingFuelPermille =
        PERMILLE_SCALE - event.fuelRemovalPermille
      for (const cellId of event.cellIds) {
        const currentFuel =
          world.current.surfaceFuelLoadGramsPerSquareMeter[cellId]
        world.current.surfaceFuelLoadGramsPerSquareMeter[cellId] = Math.floor(
          (currentFuel * remainingFuelPermille) / PERMILLE_SCALE,
        )
        world.current.fireIntensityIndex[cellId] = 0
      }
      break
    }

    case 'sensor-status': {
      const sensor = world.sensors.find(
        (candidate) => candidate.id === event.sensorId,
      )
      if (sensor === undefined) {
        throw new RangeError(`unknown sensor ID: ${event.sensorId}`)
      }
      sensor.status = event.status
      break
    }
  }
}
