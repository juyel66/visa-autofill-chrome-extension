export * from './registration'
export * from './basicDetails'
export * from './familyDetails'
export * from './visaDetails'
export * from './additionalQuestions'
export * from './photoUpload'

import { BANGLADESH_REGISTRATION_MAPPINGS } from './registration'
import { BANGLADESH_BASIC_DETAILS_MAPPINGS } from './basicDetails'
import { BANGLADESH_FAMILY_DETAILS_MAPPINGS } from './familyDetails'
import { BANGLADESH_VISA_DETAILS_MAPPINGS } from './visaDetails'
import { BANGLADESH_ADDITIONAL_QUESTIONS_MAPPINGS } from './additionalQuestions'
import { BANGLADESH_PHOTO_UPLOAD_MAPPINGS } from './photoUpload'
import type { IndiaVisaFieldMapping } from '../../mapping.types'

export const BANGLADESH_VISA_MAPPINGS: IndiaVisaFieldMapping[] = [
  ...BANGLADESH_REGISTRATION_MAPPINGS,
  ...BANGLADESH_BASIC_DETAILS_MAPPINGS,
  ...BANGLADESH_FAMILY_DETAILS_MAPPINGS,
  ...BANGLADESH_VISA_DETAILS_MAPPINGS,
  ...BANGLADESH_ADDITIONAL_QUESTIONS_MAPPINGS,
  ...BANGLADESH_PHOTO_UPLOAD_MAPPINGS,
]

