import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'

describe('createSeededRandom', () => {
  it('returns the same sequence for the same seed', () => {
    const first = createSeededRandom(42)
    const second = createSeededRandom(42)

    expect(Array.from({ length: 5 }, () => first.nextUint32())).toEqual(
      Array.from({ length: 5 }, () => second.nextUint32()),
    )
  })

  it('returns values inside a requested integer range', () => {
    const random = createSeededRandom(7)
    const values = Array.from({ length: 100 }, () => random.integer(10, 20))

    expect(values.every((value) => value >= 10 && value < 20)).toBe(true)
  })

  it('rejects seeds outside the unsigned 32-bit range', () => {
    expect(() => createSeededRandom(-1)).toThrow(RangeError)
    expect(() => createSeededRandom(0x1_0000_0000)).toThrow(RangeError)
  })
})
