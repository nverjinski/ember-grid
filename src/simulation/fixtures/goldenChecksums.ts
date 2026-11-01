import type { ScenarioEvent } from '../events'

export const GOLDEN_CHECKSUM_TICKS = [0, 10, 25, 50] as const

export const GOLDEN_CHECKSUM_EVENTS: readonly ScenarioEvent[] = [
  { type: 'ignition', tick: 0, cellId: 27, intensityIndex: 800 },
  {
    type: 'wind-shift',
    tick: 12,
    direction: 'west',
    speedCentimetersPerSecond: 450,
  },
  { type: 'sensor-status', tick: 20, sensorId: 1, status: 'failed' },
  {
    type: 'containment',
    tick: 30,
    cellIds: [27, 28, 35, 36],
    fuelRemovalPermille: 600,
  },
]

export const GOLDEN_CHECKSUMS = {
  42: [
    'ee0842ea31f308bb',
    '13a5078bd0e16625',
    'b269ec9905f3de3e',
    '07bb01b87dbe235b',
  ],
  314159: [
    '3c40e830d137afb5',
    '28b7aa64491c9c2b',
    'ef114037f4c28b60',
    '064f744218c34eeb',
  ],
} as const
