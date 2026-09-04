import type { IndiaFieldSelector } from '../../mapping.types'

/**
 * Bangladesh Indian Visa Portal (https://indianvisa-bangladesh.nic.in/)
 * Page: /visa/Registration (Canonical Page: REGISTRATION)
 * 
 * Candidate selector abstractions prioritized by:
 * 1. Unique ID
 * 2. Stable Name
 * 3. Stable CSS / Label
 * 
 * Live DOM status:
 * Direct unauthenticated HTTP requests return portal informational content; form controls
 * are rendered dynamically in-session. Selectors represent candidate strategies and remain
 * unverified ('needs-verification') until live session inspection is completed.
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
    { strategy: 'name', value: 'country' },
    { strategy: 'css', value: 'select[name="country"]' },
  ],
  indianMission: [
    { strategy: 'id', value: 'missioncode_id' },
    { strategy: 'name', value: 'indian_mission' },
    { strategy: 'css', value: 'select[name="indian_mission"]' },
  ],
  nationality: [
    { strategy: 'id', value: 'nationality_id' },
    { strategy: 'name', value: 'nationality' },
    { strategy: 'css', value: 'select[name="nationality"]' },
  ],
  dateOfBirth: [
    { strategy: 'id', value: 'dob_id' },
    { strategy: 'name', value: 'dob' },
    { strategy: 'css', value: 'input[name="dob"]' },
  ],
  email: [
    { strategy: 'id', value: 'email_id' },
    { strategy: 'name', value: 'email' },
    { strategy: 'css', value: 'input[name="email"]' },
  ],
  emailConfirm: [
    { strategy: 'id', value: 'email_re_id' },
    { strategy: 'name', value: 'email_re' },
    { strategy: 'css', value: 'input[name="email_re"]' },
  ],
  expectedArrivalDate: [
    { strategy: 'id', value: 'journey_id' },
    { strategy: 'name', value: 'arr_date' },
    { strategy: 'css', value: 'input[name="arr_date"]' },
  ],
  captcha: [
    { strategy: 'id', value: 'captcha' },
    { strategy: 'name', value: 'captcha' },
    { strategy: 'css', value: 'input[name="captcha"]' },
  ],
}

