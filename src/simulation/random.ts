export interface SeededRandom {
  nextUint32(): number
  nextFloat(): number
  integer(minInclusive: number, maxExclusive: number): number
}

function assertUint32(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${name} must be an unsigned 32-bit integer`)
  }
}

/**
 * Mulberry32 is a compact deterministic generator suitable for simulations.
 * It is not intended for passwords, tokens, or other cryptographic uses.
 */
export function createSeededRandom(seed: number): SeededRandom {
  assertUint32('seed', seed)

  let state = seed >>> 0

  const nextUint32 = (): number => {
    state = (state + 0x6d2b_79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return (value ^ (value >>> 14)) >>> 0
  }

  const nextFloat = (): number => nextUint32() / 0x1_0000_0000

  const integer = (minInclusive: number, maxExclusive: number): number => {
    if (
      !Number.isSafeInteger(minInclusive) ||
      !Number.isSafeInteger(maxExclusive) ||
      maxExclusive <= minInclusive
    ) {
      throw new RangeError(
        'integer range must contain safe integers with max greater than min',
      )
    }

    return Math.floor(
      nextFloat() * (maxExclusive - minInclusive) + minInclusive,
    )
  }

  return { nextUint32, nextFloat, integer }
}
