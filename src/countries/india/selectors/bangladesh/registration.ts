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
  captcha: IndiaFieldSelector[]
}

export const BANGLADESH_REGISTRATION_SELECTORS: BangladeshRegistrationSelectors = {
  applyingFromCountry: [
    { strategy: 'id', value: 'countryname_id' },
    { strategy: 'name', value: 'appl.countryname' },
    { strategy: 'name', value: 'country' },
    { strategy: 'css', value: 'select[name="country"], select[name="appl.countryname"]' },
  ],
  indianMission: [
    { strategy: 'id', value: 'missioncode_id' },
    { strategy: 'name', value: 'appl.missioncode' },
    { strategy: 'name', value: 'indian_mission' },
    { strategy: 'css', value: 'select[name="indian_mission"], select[name="appl.missioncode"]' },
  ],
  nationality: [
    { strategy: 'id', value: 'nationality_id' },
    { strategy: 'name', value: 'appl.nationality' },
    { strategy: 'name', value: 'nationality' },
    { strategy: 'css', value: 'select[name="nationality"], select[name="appl.nationality"]' },
  ],
  dateOfBirth: [
    { strategy: 'id', value: 'dob_id' },
    { strategy: 'name', value: 'appl.birthdate' },
    { strategy: 'name', value: 'dob' },
    { strategy: 'css', value: 'input[name="appl.birthdate"], input[name="dob"]' },
  ],
  email: [
    { strategy: 'id', value: 'email_id' },
    { strategy: 'name', value: 'appl.email' },
    { strategy: 'name', value: 'email' },
    { strategy: 'css', value: 'input[name="appl.email"], input[name="email"]' },
  ],
  emailConfirm: [
    { strategy: 'id', value: 'email_re_id' },
    { strategy: 'name', value: 'appl.email_re' },
    { strategy: 'name', value: 'email_re' },
    { strategy: 'css', value: 'input[name="appl.email_re"], input[name="email_re"]' },
  ],
  expectedArrivalDate: [
    { strategy: 'id', value: 'jouryney_id' },
    { strategy: 'id', value: 'journey_id' },
    { strategy: 'name', value: 'appl.journeydate' },
    { strategy: 'name', value: 'arr_date' },
    { strategy: 'css', value: 'input[name="appl.journeydate"], input[name="arr_date"]' },
  ],
  captcha: [
    { strategy: 'id', value: 'captcha' },
    { strategy: 'name', value: 'captcha' },
    { strategy: 'css', value: 'input[name="captcha"]' },
  ],
}


