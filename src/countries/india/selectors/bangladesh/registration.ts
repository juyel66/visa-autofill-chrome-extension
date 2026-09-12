import type { IndiaFieldSelector } from '../../mapping.types'

/**
 * Bangladesh Indian Visa Portal (https://indianvisa-bangladesh.nic.in/)
 * Page: /visa/Registration (Canonical Page: REGISTRATION)
 * 
 * Verified DOM selectors provided from live Bangladesh portal DOM evidence.
 */
export interface BangladeshRegistrationSelectors {
  applyingFromCountry: IndiaFieldSelector[]
  indianMission: IndiaFieldSelector[]
  nationality: IndiaFieldSelector[]
  dateOfBirth: IndiaFieldSelector[]
  email: IndiaFieldSelector[]
  emailConfirm: IndiaFieldSelector[]
  expectedArrivalDate: IndiaFieldSelector[]
  visitingPurpose: IndiaFieldSelector[]
  captcha: IndiaFieldSelector[]
}

export const BANGLADESH_REGISTRATION_SELECTORS: BangladeshRegistrationSelectors = {
  applyingFromCountry: [
    { strategy: 'id', value: 'countryname_id' },
    { strategy: 'name', value: 'appl.countryname' },
    { strategy: 'css', value: 'select[name="appl.countryname"], select#countryname_id' },
  ],
  indianMission: [
    { strategy: 'id', value: 'missioncode_id' },
    { strategy: 'name', value: 'appl.missioncode' },
    { strategy: 'css', value: 'select[name="appl.missioncode"], select#missioncode_id' },
  ],
  nationality: [
    { strategy: 'id', value: 'nationality_id' },
    { strategy: 'name', value: 'appl.nationality' },
    { strategy: 'css', value: 'select[name="appl.nationality"], select#nationality_id' },
  ],
  dateOfBirth: [
    { strategy: 'id', value: 'dob_id' },
    { strategy: 'name', value: 'appl.birthdate' },
    { strategy: 'css', value: 'input[name="appl.birthdate"], input#dob_id' },
  ],
  email: [
    { strategy: 'id', value: 'email_id' },
    { strategy: 'name', value: 'appl.email' },
    { strategy: 'css', value: 'input[name="appl.email"], input#email_id' },
  ],
  emailConfirm: [
    { strategy: 'id', value: 'email_re_id' },
    { strategy: 'name', value: 'appl.email_re' },
    { strategy: 'css', value: 'input[name="appl.email_re"], input#email_re_id' },
  ],
  expectedArrivalDate: [
    { strategy: 'id', value: 'jouryney_id' },
    { strategy: 'name', value: 'appl.journeydate' },
    { strategy: 'id', value: 'journey_id' },
    { strategy: 'css', value: 'input[name="appl.journeydate"], input#jouryney_id' },
  ],
  visitingPurpose: [
    { strategy: 'id', value: 'purpose_id' },
    { strategy: 'name', value: 'appl.purpose' },
    { strategy: 'id', value: 'visatype_id' },
    { strategy: 'name', value: 'appl.visatype' },
    { strategy: 'id', value: 'purpose' },
    { strategy: 'name', value: 'purpose' },
    { strategy: 'id', value: 'visatype' },
    { strategy: 'name', value: 'visatype' },
    { strategy: 'css', value: 'select[name="appl.purpose"], select#purpose_id, select[name="appl.visatype"], select#visatype_id, select#purpose, select[name="purpose"], select#visatype, select[name="visatype"], select[name*="purpose"], select[id*="purpose"], select[name*="visatype"], select[id*="visatype"]' },
  ],
  captcha: [
    { strategy: 'id', value: 'captcha' },
    { strategy: 'name', value: 'captcha' },
    { strategy: 'css', value: 'input#captcha' },
  ],
}


