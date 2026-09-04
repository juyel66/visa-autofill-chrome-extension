export * from './registration'
export * from './basicDetails'

import { BANGLADESH_REGISTRATION_SELECTORS, type BangladeshRegistrationSelectors } from './registration'
import { BANGLADESH_BASIC_DETAILS_SELECTORS, type BangladeshBasicDetailsSelectors } from './basicDetails'
import type { IndiaFieldSelector } from '../../mapping.types'

export interface BangladeshVisaSelectorConfig extends BangladeshRegistrationSelectors, BangladeshBasicDetailsSelectors {}

export const BANGLADESH_VISA_SELECTORS: Record<string, IndiaFieldSelector | IndiaFieldSelector[] | undefined> = {
  ...BANGLADESH_REGISTRATION_SELECTORS,
  ...BANGLADESH_BASIC_DETAILS_SELECTORS,
}
