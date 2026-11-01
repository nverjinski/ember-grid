import {
  NORMALIZED_INDEX_MAX,
  type WindDirection,
  type WorldState,
} from './types'

export const SIMULATION_TICK_MILLISECONDS = 100

const AMBIENT_TEMPERATURE_DECI_CELSIUS = 200
const MAX_TEMPERATURE_DECI_CELSIUS = 12_000
const IGNITION_THRESHOLD = 100

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

function windFactorPermille(
  offsetX: number,
  offsetY: number,
  direction: WindDirection,
  speedCentimetersPerSecond: number,
): number {
  const [windX, windY] = WIND_VECTORS[direction]
  const alignment = offsetX * windX + offsetY * windY

  if (alignment > 0) {
    return 1_000 + speedCentimetersPerSecond
  }

  if (alignment < 0) {
    return Math.max(0, 1_000 - speedCentimetersPerSecond)
  }

  return 1_000
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
      const distanceDivisor = offsetX !== 0 && offsetY !== 0 ? 12 : 8
      const baseExposure = Math.floor(sourceFire / distanceDivisor)
      const windFactor = windFactorPermille(
        offsetX,
        offsetY,
        world.wind.direction,
        world.wind.speedCentimetersPerSecond,
      )

      exposure += Math.floor((baseExposure * windFactor) / 1_000)
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
  const change = Math.max(1, Math.floor(Math.abs(difference) / 50))

  return temperatureDeciCelsius + Math.sign(difference) * change
}

/** Advances the authoritative world by exactly one fixed 100 ms tick. */
export function stepWorld(world: WorldState): void {
  const { width } = world.dimensions

  for (let cellId = 0; cellId < world.cellCount; cellId += 1) {
    const x = cellId % width
    const y = Math.floor(cellId / width)
    const fuelLoad = world.current.fuelLoadGramsPerSquareMeter[cellId]
    const moisture = world.current.fuelMoisturePermille[cellId]
    const temperature = world.current.temperatureDeciCelsius[cellId]
    const smoke = world.current.smokeDensityIndex[cellId]
    const fire = world.current.fireIntensityIndex[cellId]
    const exposure = neighborFireExposure(world, x, y)
    const drynessPermille = clamp(1_000 - moisture, 0, 1_000)
    const fuelFactorPermille = clamp(fuelLoad, 0, 1_000)
    const ignitionPotential = Math.floor(
      (exposure * drynessPermille * fuelFactorPermille) / 1_000_000,
    )

    const consumedFuel = Math.min(fuelLoad, Math.ceil(fire / 50))
    const evaporatedMoisture = Math.min(moisture, Math.ceil(fire / 100))
    const nextFuelLoad = fuelLoad - consumedFuel
    const nextMoisture = moisture - evaporatedMoisture

    let nextFire = 0
    if (nextFuelLoad > 0 && fire > 0) {
      const combustionSupport = Math.floor(
        (nextFuelLoad * drynessPermille) / 20_000,
      )
      nextFire = clamp(
        fire + combustionSupport + Math.floor(exposure / 16) - 25,
        0,
        NORMALIZED_INDEX_MAX,
      )
    } else if (nextFuelLoad > 0 && ignitionPotential >= IGNITION_THRESHOLD) {
      nextFire = clamp(
        ignitionPotential * 2,
        0,
        NORMALIZED_INDEX_MAX,
      )
    }

    const generatedSmoke = Math.ceil(fire / 25)
    const dispersedSmoke = Math.floor(smoke / 40)
    const nextSmoke = clamp(
      smoke + generatedSmoke - dispersedSmoke,
      0,
      NORMALIZED_INDEX_MAX,
    )

    const nextTemperature =
      fire > 0 || exposure > 0
        ? clamp(
            temperature + Math.ceil((fire + exposure) / 20),
            -32_768,
            MAX_TEMPERATURE_DECI_CELSIUS,
          )
        : coolTowardAmbient(temperature)

    world.next.fuelLoadGramsPerSquareMeter[cellId] = nextFuelLoad
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
