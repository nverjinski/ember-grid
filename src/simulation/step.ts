import {
  NORMALIZED_INDEX_MAX,
  type WindDirection,
  type WorldState,
} from './types'

export const SIMULATION_TICK_MILLISECONDS = 100

const PERMILLE_SCALE = 1_000
const INT16_MINIMUM = -32_768
const AMBIENT_TEMPERATURE_DECI_CELSIUS = 200
const MAX_TEMPERATURE_DECI_CELSIUS = 12_000

const FIRE_RULES = {
  // Neighbor exposure is weaker across diagonals because they are farther away.
  cardinalNeighborExposureDivisor: 8,
  diagonalNeighborExposureDivisor: 12,

  // A 10 m/s wind adds 100% exposure downwind and removes it upwind.
  windSpeedForFullExposureAdjustmentCentimetersPerSecond: 1_000,

  ignitionPotentialThreshold: 100,
  ignitionIntensityMultiplier: 2,

  // Per-tick rates; each tick represents SIMULATION_TICK_MILLISECONDS.
  fireIntensityPointsPerGramOfFuelConsumed: 50,
  fireIntensityPointsPerMoisturePermilleEvaporated: 100,
  dryFuelGramsPerCombustionSupportPoint: 20,
  neighborExposurePerCombustionSupportPoint: 16,
  fireIntensityDecayPoints: 25,
  fireIntensityPointsPerSmokePointGenerated: 25,
  smokePointsPerDispersedPoint: 40,
  heatSourcePointsPerDeciCelsiusGained: 20,
  ambientCoolingDifferenceDivisor: 50,
} as const

const WIND_VECTORS: Record<WindDirection, readonly [number, number]> = {
  north: [0, -1],
  'north-east': [1, -1],
  east: [1, 0],
  'south-east': [1, 1],
  south: [0, 1],
  'south-west': [-1, 1],
  west: [-1, 0],
  'north-west': [-1, -1],
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function scaleByPermille(value: number, factorPermille: number): number {
  return Math.floor((value * factorPermille) / PERMILLE_SCALE)
}

function windFactorPermille(
  offsetX: number,
  offsetY: number,
  direction: WindDirection,
  speedCentimetersPerSecond: number,
): number {
  const [windX, windY] = WIND_VECTORS[direction]
  const alignment = offsetX * windX + offsetY * windY
  const windAdjustmentPermille = Math.floor(
    (speedCentimetersPerSecond * PERMILLE_SCALE) /
      FIRE_RULES.windSpeedForFullExposureAdjustmentCentimetersPerSecond,
  )

  if (alignment > 0) {
    return PERMILLE_SCALE + windAdjustmentPermille
  }

  if (alignment < 0) {
    return Math.max(0, PERMILLE_SCALE - windAdjustmentPermille)
  }

  return PERMILLE_SCALE
}

function neighborFireExposure(
  world: WorldState,
  targetX: number,
  targetY: number,
): number {
  const { width, height } = world.dimensions
  let exposure = 0

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue
      }

      const sourceX = targetX - offsetX
      const sourceY = targetY - offsetY
      if (sourceX < 0 || sourceX >= width || sourceY < 0 || sourceY >= height) {
        continue
      }

      const sourceId = sourceY * width + sourceX
      const sourceFire = world.current.fireIntensityIndex[sourceId]
      const distanceDivisor =
        offsetX !== 0 && offsetY !== 0
          ? FIRE_RULES.diagonalNeighborExposureDivisor
          : FIRE_RULES.cardinalNeighborExposureDivisor
      const baseExposure = Math.floor(sourceFire / distanceDivisor)
      const windFactor = windFactorPermille(
        offsetX,
        offsetY,
        world.wind.direction,
        world.wind.speedCentimetersPerSecond,
      )

      exposure += scaleByPermille(baseExposure, windFactor)
    }
  }

  return exposure
}

function coolTowardAmbient(temperatureDeciCelsius: number): number {
  if (temperatureDeciCelsius === AMBIENT_TEMPERATURE_DECI_CELSIUS) {
    return temperatureDeciCelsius
  }

  const difference =
    AMBIENT_TEMPERATURE_DECI_CELSIUS - temperatureDeciCelsius
  const change = Math.max(
    1,
    Math.floor(
      Math.abs(difference) / FIRE_RULES.ambientCoolingDifferenceDivisor,
    ),
  )

  return temperatureDeciCelsius + Math.sign(difference) * change
}

/** Advances the authoritative world by exactly one fixed 100 ms tick. */
export function stepWorld(world: WorldState): void {
  const { width } = world.dimensions

  for (let cellId = 0; cellId < world.cellCount; cellId += 1) {
    const x = cellId % width
    const y = Math.floor(cellId / width)
    const surfaceFuelLoad =
      world.current.surfaceFuelLoadGramsPerSquareMeter[cellId]
    const moisture = world.current.fuelMoisturePermille[cellId]
    const temperature = world.current.temperatureDeciCelsius[cellId]
    const smoke = world.current.smokeDensityIndex[cellId]
    const fire = world.current.fireIntensityIndex[cellId]
    const exposure = neighborFireExposure(world, x, y)
    const drynessPermille = clamp(
      PERMILLE_SCALE - moisture,
      0,
      PERMILLE_SCALE,
    )
    const ignitionPotential = scaleByPermille(exposure, drynessPermille)

    const consumedFuel = Math.min(
      surfaceFuelLoad,
      Math.ceil(
        fire / FIRE_RULES.fireIntensityPointsPerGramOfFuelConsumed,
      ),
    )
    const evaporatedMoisture = Math.min(
      moisture,
      Math.ceil(
        fire /
          FIRE_RULES.fireIntensityPointsPerMoisturePermilleEvaporated,
      ),
    )
    const nextSurfaceFuelLoad = surfaceFuelLoad - consumedFuel
    const nextMoisture = moisture - evaporatedMoisture

    let nextFire = 0
    if (nextSurfaceFuelLoad > 0 && fire > 0) {
      const effectiveDryFuelLoad = scaleByPermille(
        nextSurfaceFuelLoad,
        drynessPermille,
      )
      const combustionSupport = Math.floor(
        effectiveDryFuelLoad /
          FIRE_RULES.dryFuelGramsPerCombustionSupportPoint,
      )
      nextFire = clamp(
        fire +
          combustionSupport +
          Math.floor(
            exposure /
              FIRE_RULES.neighborExposurePerCombustionSupportPoint,
          ) -
          FIRE_RULES.fireIntensityDecayPoints,
        0,
        NORMALIZED_INDEX_MAX,
      )
    } else if (
      nextSurfaceFuelLoad > 0 &&
      ignitionPotential >= FIRE_RULES.ignitionPotentialThreshold
    ) {
      nextFire = clamp(
        ignitionPotential * FIRE_RULES.ignitionIntensityMultiplier,
        0,
        NORMALIZED_INDEX_MAX,
      )
    }

    const generatedSmoke = Math.ceil(
      fire / FIRE_RULES.fireIntensityPointsPerSmokePointGenerated,
    )
    const dispersedSmoke = Math.floor(
      smoke / FIRE_RULES.smokePointsPerDispersedPoint,
    )
    const nextSmoke = clamp(
      smoke + generatedSmoke - dispersedSmoke,
      0,
      NORMALIZED_INDEX_MAX,
    )

    const nextTemperature =
      fire > 0 || exposure > 0
        ? clamp(
            temperature +
              Math.ceil(
                (fire + exposure) /
                  FIRE_RULES.heatSourcePointsPerDeciCelsiusGained,
              ),
            INT16_MINIMUM,
            MAX_TEMPERATURE_DECI_CELSIUS,
          )
        : coolTowardAmbient(temperature)

    world.next.surfaceFuelLoadGramsPerSquareMeter[cellId] =
      nextSurfaceFuelLoad
    world.next.fuelMoisturePermille[cellId] = nextMoisture
    world.next.temperatureDeciCelsius[cellId] = nextTemperature
    world.next.smokeDensityIndex[cellId] = nextSmoke
    world.next.fireIntensityIndex[cellId] = nextFire
  }

  const previous = world.current
  world.current = world.next
  world.next = previous
  world.tick += 1
}
