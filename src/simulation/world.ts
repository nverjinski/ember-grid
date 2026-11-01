import type { CellBuffer, GridDimensions, WorldState } from './types'

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`)
  }
}

function assertValidDimensions(dimensions: GridDimensions): number {
  assertPositiveInteger('width', dimensions.width)
  assertPositiveInteger('height', dimensions.height)

  const cellCount = dimensions.width * dimensions.height
  if (!Number.isSafeInteger(cellCount)) {
    throw new RangeError('width multiplied by height must be a safe integer')
  }

  return cellCount
}

export function createCellBuffer(cellCount: number): CellBuffer {
  assertPositiveInteger('cellCount', cellCount)

  return {
    fuelLoadGramsPerSquareMeter: new Uint16Array(cellCount),
    fuelMoisturePermille: new Uint16Array(cellCount),
    temperatureDeciCelsius: new Int16Array(cellCount),
    smokeDensityIndex: new Uint16Array(cellCount),
    fireIntensityIndex: new Uint16Array(cellCount),
  }
}

export function createEmptyWorld(dimensions: GridDimensions): WorldState {
  const cellCount = assertValidDimensions(dimensions)

  return {
    dimensions: { ...dimensions },
    cellCount,
    tick: 0,
    wind: {
      direction: 'north',
      speedCentimetersPerSecond: 0,
    },
    sensors: [],
    current: createCellBuffer(cellCount),
    next: createCellBuffer(cellCount),
  }
}

export function getCellId(
  dimensions: GridDimensions,
  x: number,
  y: number,
): number {
  assertValidDimensions(dimensions)

  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    x < 0 ||
    x >= dimensions.width ||
    y < 0 ||
    y >= dimensions.height
  ) {
    throw new RangeError(`cell coordinates (${x}, ${y}) are outside the grid`)
  }

  return y * dimensions.width + x
}

export function getCellCoordinates(
  dimensions: GridDimensions,
  cellId: number,
): { x: number; y: number } {
  const cellCount = assertValidDimensions(dimensions)

  if (
    !Number.isSafeInteger(cellId) ||
    cellId < 0 ||
    cellId >= cellCount
  ) {
    throw new RangeError(`cell ID ${cellId} is outside the grid`)
  }

  return {
    x: cellId % dimensions.width,
    y: Math.floor(cellId / dimensions.width),
  }
}
