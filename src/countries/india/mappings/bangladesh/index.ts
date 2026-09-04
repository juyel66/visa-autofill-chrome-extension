export * from './registration'
export * from './basicDetails'

import { BANGLADESH_REGISTRATION_MAPPINGS } from './registration'
import { BANGLADESH_BASIC_DETAILS_MAPPINGS } from './basicDetails'
import type { IndiaVisaFieldMapping } from '../../mapping.types'

export const BANGLADESH_VISA_MAPPINGS: IndiaVisaFieldMapping[] = [
  ...BANGLADESH_REGISTRATION_MAPPINGS,
  ...BANGLADESH_BASIC_DETAILS_MAPPINGS,
]
