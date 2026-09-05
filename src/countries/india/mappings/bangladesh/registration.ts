import type { IndiaVisaFieldMapping } from '../../mapping.types'
import { BANGLADESH_REGISTRATION_SELECTORS } from '../../selectors/bangladesh/registration'

/**
 * Field mappings for Bangladesh Indian Visa Portal - Registration page (/visa/Registration)
 * Canonical Page Identity: 'REGISTRATION'
 * 
 * Verified field mappings:
 * - All normal form fields with verified DOM selectors are marked 'verified'.
 *   (Autofill executes when confirmed document data exists; left untouched if missing).
 * - CAPTCHA: Strictly 'manual-required' security control.
 */
export const BANGLADESH_REGISTRATION_MAPPINGS: IndiaVisaFieldMapping[] = [
  {
    id: 'bd_reg_country',
    section: 'application-information',
    targetField: 'appl.countryname',
    sourceField: 'presentAddress.country',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_REGISTRATION_SELECTORS.applyingFromCountry,
    inputType: 'select',
    status: 'verified',
    required: true,
    page: 'REGISTRATION',
    notes: 'Country/Region applying visa from (#countryname_id)',
  },
  {
    id: 'bd_reg_indian_mission',
    section: 'application-information',
    targetField: 'appl.missioncode',
    sourceField: 'registration.indianMission',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_REGISTRATION_SELECTORS.indianMission,
    inputType: 'select',
    status: 'verified',
    required: true,
    page: 'REGISTRATION',
    notes: 'Indian Mission/Office in Bangladesh (#missioncode_id)',
  },
  {
    id: 'bd_reg_nationality',
    section: 'application-information',
    targetField: 'appl.nationality',
    sourceField: 'personalInfo.nationality',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_REGISTRATION_SELECTORS.nationality,
    inputType: 'select',
    status: 'verified',
    required: true,
    page: 'REGISTRATION',
  },
  {
    id: 'bd_reg_dob',
    section: 'application-information',
    targetField: 'appl.birthdate',
    sourceField: 'personalInfo.dateOfBirth',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_REGISTRATION_SELECTORS.dateOfBirth,
    inputType: 'date',
    status: 'verified',
    required: true,
    page: 'REGISTRATION',
    transform: 'isoDateToDdMmYyyy',
  },
  {
    id: 'bd_reg_email',
    section: 'application-information',
    targetField: 'appl.email',
    sourceField: 'contact.email',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_REGISTRATION_SELECTORS.email,
    inputType: 'text',
    status: 'verified',
    required: true,
    page: 'REGISTRATION',
    transform: 'lowercase',
  },
  {
    id: 'bd_reg_email_confirm',
    section: 'application-information',
    targetField: 'appl.email_re',
    sourceField: 'contact.email',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_REGISTRATION_SELECTORS.emailConfirm,
    inputType: 'text',
    status: 'verified',
    required: true,
    page: 'REGISTRATION',
    transform: 'lowercase',
  },
  {
    id: 'bd_reg_expected_arrival',
    section: 'application-information',
    targetField: 'appl.journeydate',
    sourceField: 'travel.intendedArrivalDate',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_REGISTRATION_SELECTORS.expectedArrivalDate,
    inputType: 'date',
    status: 'verified',
    required: true,
    page: 'REGISTRATION',
    transform: 'isoDateToDdMmYyyy',
  },
  {
    id: 'bd_reg_captcha',
    section: 'application-information',
    targetField: 'captcha',
    sourceType: 'manual',
    selector: BANGLADESH_REGISTRATION_SELECTORS.captcha,
    inputType: 'text',
    status: 'manual-required',
    required: true,
    page: 'REGISTRATION',
    notes: 'CAPTCHA MUST be solved manually by the user. Automation is prohibited.',
  },
]

