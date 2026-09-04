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
    targetField: 'country_applying_from',
    sourceField: 'presentAddress.country',
    sourceType: 'applicant-profile',
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
    targetField: 'indian_mission',
    sourceField: 'registration.indianMission',
    sourceType: 'applicant-profile',
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
    targetField: 'nationality',
    sourceField: 'personalInfo.nationality',
    sourceType: 'applicant-profile',
    selector: BANGLADESH_REGISTRATION_SELECTORS.nationality,
    inputType: 'select',
    status: 'verified',
    required: true,
    page: 'REGISTRATION',
  },
  {
    id: 'bd_reg_dob',
    section: 'application-information',
    targetField: 'dob',
    sourceField: 'personalInfo.dateOfBirth',
    sourceType: 'applicant-profile',
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
    targetField: 'email',
    sourceField: 'contact.email',
    sourceType: 'applicant-profile',
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
    targetField: 'email_re',
    sourceField: 'contact.email',
    sourceType: 'applicant-profile',
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
    targetField: 'arr_date',
    sourceField: 'travel.intendedArrivalDate',
    sourceType: 'applicant-profile',
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

