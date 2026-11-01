import { createSeededRandom, type SeededRandom } from './random'
import {
  SENSOR_KINDS,
  WIND_DIRECTIONS,
  type GridDimensions,
  type SensorState,
  type WorldState,
} from './types'
import { createEmptyWorld } from './world'

export interface WorldInitialization extends GridDimensions {
  seed: number
  sensorCount: number
}

function createSensors(
  random: SeededRandom,
  cellCount: number,
  sensorCount: number,
): SensorState[] {
  if (
    !Number.isSafeInteger(sensorCount) ||
    sensorCount < 0 ||
    sensorCount > cellCount
  ) {
    throw new RangeError(
      'sensorCount must be an integer between zero and the cell count',
    )
  }

  const availableCellIds = Uint32Array.from(
    { length: cellCount },
    (_, cellId) => cellId,
  )

  return Array.from({ length: sensorCount }, (_, sensorId) => {
    const selectedIndex = random.integer(sensorId, cellCount)
    const selectedCellId = availableCellIds[selectedIndex]
    availableCellIds[selectedIndex] = availableCellIds[sensorId]
    availableCellIds[sensorId] = selectedCellId

    return {
      id: sensorId,
      cellId: selectedCellId,
      kind: SENSOR_KINDS[random.integer(0, SENSOR_KINDS.length)],
      status: 'active',
    }
  })
}

export function createInitializedWorld(
  initialization: WorldInitialization,
): WorldState {
  const world = createEmptyWorld(initialization)
  const random = createSeededRandom(initialization.seed)

  for (let cellId = 0; cellId < world.cellCount; cellId += 1) {
    world.current.fuelLoadGramsPerSquareMeter[cellId] = random.integer(
      600,
      1_001,
    )
    world.current.fuelMoisturePermille[cellId] = random.integer(150, 751)
    world.current.temperatureDeciCelsius[cellId] = random.integer(150, 351)
  }

  world.next.fuelLoadGramsPerSquareMeter.set(
    world.current.fuelLoadGramsPerSquareMeter,
  )
  world.next.fuelMoisturePermille.set(world.current.fuelMoisturePermille)
  world.next.temperatureDeciCelsius.set(world.current.temperatureDeciCelsius)

  world.wind = {
    direction: WIND_DIRECTIONS[random.integer(0, WIND_DIRECTIONS.length)],
    speedCentimetersPerSecond: random.integer(100, 501),
  }
  world.sensors = createSensors(
    random,
    world.cellCount,
    initialization.sensorCount,
  )

  return world
}
