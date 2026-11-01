export const FUEL_BED_CODES = {
  grass: 0,
  timberLitter: 1,
  shrub: 2,
  slash: 3,
} as const

export type FuelBedCode =
  (typeof FUEL_BED_CODES)[keyof typeof FUEL_BED_CODES]

export interface FuelBedProfile {
  code: FuelBedCode
  name: 'grass' | 'timber-litter' | 'shrub' | 'slash'
  minimumSurfaceFuelLoadGramsPerSquareMeter: number
  maximumSurfaceFuelLoadGramsPerSquareMeter: number
  selectionWeight: number
}

/**
 * Stylized ranges based on the broad surface-fuel loads represented by
 * standard wildland fire fuel models. They are not a fire-science model.
 */
export const FUEL_BED_PROFILES = [
  {
    code: FUEL_BED_CODES.grass,
    name: 'grass',
    minimumSurfaceFuelLoadGramsPerSquareMeter: 100,
    maximumSurfaceFuelLoadGramsPerSquareMeter: 700,
    selectionWeight: 40,
  },
  {
    code: FUEL_BED_CODES.timberLitter,
    name: 'timber-litter',
    minimumSurfaceFuelLoadGramsPerSquareMeter: 700,
    maximumSurfaceFuelLoadGramsPerSquareMeter: 1_600,
    selectionWeight: 30,
  },
  {
    code: FUEL_BED_CODES.shrub,
    name: 'shrub',
    minimumSurfaceFuelLoadGramsPerSquareMeter: 1_000,
    maximumSurfaceFuelLoadGramsPerSquareMeter: 3_200,
    selectionWeight: 25,
  },
  {
    code: FUEL_BED_CODES.slash,
    name: 'slash',
    minimumSurfaceFuelLoadGramsPerSquareMeter: 2_000,
    maximumSurfaceFuelLoadGramsPerSquareMeter: 13_000,
    selectionWeight: 5,
  },
] as const satisfies readonly FuelBedProfile[]

export function getFuelBedProfile(code: number): FuelBedProfile {
  const profile = FUEL_BED_PROFILES[code]

  if (profile === undefined) {
    throw new RangeError(`unknown fuel-bed code: ${code}`)
  }

  return profile
}
