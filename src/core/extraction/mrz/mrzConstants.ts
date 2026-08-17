/**
 * ICAO Doc 9303 check digit weight multipliers.
 * Repeated sequence: 7, 3, 1, 7, 3, 1...
 */
export const MRZ_CHECK_DIGIT_WEIGHTS = [7, 3, 1] as const

/**
 * Expected line parameters for TD3 passport MRZ.
 */
export const TD3_LINE_COUNT = 2
export const TD3_LINE_LENGTH = 44
