import { describe, expect, it } from 'vitest'
import { checksumWorld } from './checksum'
import {
  GOLDEN_CHECKSUM_EVENTS,
  GOLDEN_CHECKSUM_TICKS,
  GOLDEN_CHECKSUMS,
} from './fixtures/goldenChecksums'
import { createInitializedWorld } from './initialize'
import { Simulation } from './simulation'

describe('checksumWorld', () => {
  it('returns the same checksum for identical authoritative state', () => {
    const initialization = {
      width: 4,
      height: 4,
      seed: 42,
      sensorCount: 2,
    }

    expect(checksumWorld(createInitializedWorld(initialization))).toBe(
      checksumWorld(createInitializedWorld(initialization)),
    )
  })

  it('changes when authoritative state changes', () => {
    const world = createInitializedWorld({
      width: 4,
      height: 4,
      seed: 42,
      sensorCount: 2,
    })
    const before = checksumWorld(world)

    world.current.fireIntensityIndex[0] = 1

    expect(checksumWorld(world)).not.toBe(before)
  })

  it('ignores the inactive scratch buffer', () => {
    const world = createInitializedWorld({
      width: 4,
      height: 4,
      seed: 42,
      sensorCount: 2,
    })
    const before = checksumWorld(world)

    world.next.fireIntensityIndex[0] = 999

    expect(checksumWorld(world)).toBe(before)
  })

  for (const seed of [42, 314159] as const) {
    it(`matches golden checkpoints for seed ${seed}`, () => {
      const simulation = new Simulation(
        { width: 8, height: 8, seed, sensorCount: 4 },
        GOLDEN_CHECKSUM_EVENTS,
      )
      const actual = GOLDEN_CHECKSUM_TICKS.map((tick) => {
        simulation.advanceToTick(tick)
        return checksumWorld(simulation.world)
      })

      expect(actual).toEqual(GOLDEN_CHECKSUMS[seed])
    })
  }
})
