export * from './registration'
export * from './basicDetails'
export * from './familyDetails'
export * from './visaDetails'
export * from './additionalQuestions'
export * from './photoUpload'
export * from './registry'

import { BANGLADESH_REGISTRATION_SELECTORS, type BangladeshRegistrationSelectors } from './registration'
import { BANGLADESH_BASIC_DETAILS_SELECTORS, type BangladeshBasicDetailsSelectors } from './basicDetails'
import { BANGLADESH_FAMILY_DETAILS_SELECTORS, type BangladeshFamilyDetailsSelectors } from './familyDetails'
import { BANGLADESH_VISA_DETAILS_SELECTORS, type BangladeshVisaDetailsSelectors } from './visaDetails'
import { BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS, type BangladeshAdditionalQuestionsSelectors } from './additionalQuestions'
import { BANGLADESH_PHOTO_UPLOAD_SELECTORS, type BangladeshPhotoUploadSelectors } from './photoUpload'
import type { IndiaFieldSelector } from '../../mapping.types'

export interface BangladeshVisaSelectorConfig
  extends BangladeshRegistrationSelectors,
    BangladeshBasicDetailsSelectors,
    BangladeshFamilyDetailsSelectors,
    BangladeshVisaDetailsSelectors,
    BangladeshAdditionalQuestionsSelectors,
    BangladeshPhotoUploadSelectors {}

export const BANGLADESH_VISA_SELECTORS: Record<string, IndiaFieldSelector | IndiaFieldSelector[] | undefined> = {
  ...BANGLADESH_REGISTRATION_SELECTORS,
  ...BANGLADESH_BASIC_DETAILS_SELECTORS,
  ...BANGLADESH_FAMILY_DETAILS_SELECTORS,
  ...BANGLADESH_VISA_DETAILS_SELECTORS,
  ...BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS,
  ...BANGLADESH_PHOTO_UPLOAD_SELECTORS,
}

