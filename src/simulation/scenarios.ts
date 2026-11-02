import type { ScenarioEvent } from './events'
import type { GridDimensions } from './types'
import { getCellId } from './world'

export interface ScenarioMilestone {
  tick: number
  label: string
}

export interface ScenarioDefinition {
  id: string
  name: string
  description: string
  events: readonly ScenarioEvent[]
  milestones: readonly ScenarioMilestone[]
}

export function createWildfireResponseScenario(
  dimensions: GridDimensions,
): ScenarioDefinition {
  const centerX = Math.floor(dimensions.width / 2)
  const centerY = Math.floor(dimensions.height / 2)
  const containmentX = Math.min(dimensions.width - 1, centerX + 5)
  const containmentCells = Array.from(
    { length: dimensions.height },
    (_, y) => getCellId(dimensions, containmentX, y),
  )

  return {
    id: 'wind-shift-response',
    name: 'Wind-shift response',
    description:
      'A central ignition spreads under changing wind before a north–south containment line is cut.',
    events: [
      {
        type: 'ignition',
        tick: 0,
        cellId: getCellId(dimensions, centerX, centerY),
        intensityIndex: 800,
      },
      {
        type: 'wind-shift',
        tick: 50,
        direction: 'south-east',
        speedCentimetersPerSecond: 500,
      },
      {
        type: 'sensor-status',
        tick: 80,
        sensorId: 0,
        status: 'failed',
      },
      {
        type: 'containment',
        tick: 120,
        cellIds: containmentCells,
        fuelRemovalPermille: 1_000,
      },
    ],
    milestones: [
      { tick: 0, label: 'Central ignition' },
      { tick: 50, label: 'Wind shifts south-east' },
      { tick: 80, label: 'Sensor 0 fails' },
      { tick: 120, label: 'Containment line completed' },
    ],
  }
}
