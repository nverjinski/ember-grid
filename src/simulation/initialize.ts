import {
  FUEL_BED_PROFILES,
  getFuelBedProfile,
  type FuelBedCode,
} from './fuelBeds'
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

const TERRAIN_PATCH_SIZE = 4

function selectFuelBedCode(random: SeededRandom): FuelBedCode {
  const totalWeight = FUEL_BED_PROFILES.reduce(
    (total, profile) => total + profile.selectionWeight,
    0,
  )
  const selection = random.integer(0, totalWeight)
  let cumulativeWeight = 0

  for (const profile of FUEL_BED_PROFILES) {
    cumulativeWeight += profile.selectionWeight
    if (selection < cumulativeWeight) {
      return profile.code
    }
  }

  return FUEL_BED_PROFILES[FUEL_BED_PROFILES.length - 1].code
}

function initializeTerrain(world: WorldState, random: SeededRandom): void {
  const { width, height } = world.dimensions

  for (let patchY = 0; patchY < height; patchY += TERRAIN_PATCH_SIZE) {
    for (let patchX = 0; patchX < width; patchX += TERRAIN_PATCH_SIZE) {
      const fuelBedCode = selectFuelBedCode(random)
      const endY = Math.min(patchY + TERRAIN_PATCH_SIZE, height)
      const endX = Math.min(patchX + TERRAIN_PATCH_SIZE, width)

      for (let y = patchY; y < endY; y += 1) {
        for (let x = patchX; x < endX; x += 1) {
          world.terrain.fuelBedCode[y * width + x] = fuelBedCode
        }
      }
    }
  }
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
  initializeTerrain(world, random)

  for (let cellId = 0; cellId < world.cellCount; cellId += 1) {
    const profile = getFuelBedProfile(world.terrain.fuelBedCode[cellId])
    world.current.surfaceFuelLoadGramsPerSquareMeter[cellId] = random.integer(
      profile.minimumSurfaceFuelLoadGramsPerSquareMeter,
      profile.maximumSurfaceFuelLoadGramsPerSquareMeter + 1,
    )
    world.current.fuelMoisturePermille[cellId] = random.integer(150, 751)
    world.current.temperatureDeciCelsius[cellId] = random.integer(150, 351)
  }

  world.next.surfaceFuelLoadGramsPerSquareMeter.set(
    world.current.surfaceFuelLoadGramsPerSquareMeter,
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
