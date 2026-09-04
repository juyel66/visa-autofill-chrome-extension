import type { IndiaFieldSelector } from '../../mapping.types'

/**
 * Bangladesh Indian Visa Portal (https://indianvisa-bangladesh.nic.in/)
 * Page: /visa/VisaDetails (Canonical Page: TRAVEL_DETAILS)
 * 
 * Verified DOM selectors provided from live Bangladesh portal DOM evidence.
 */
export interface BangladeshVisaDetailsSelectors {
  duration: IndiaFieldSelector[]
  visaEntryType: IndiaFieldSelector[]
  expectedArrivalDate: IndiaFieldSelector[]
  entryPoint: IndiaFieldSelector[]
  exitPoint: IndiaFieldSelector[]
  oldVisaFlag: IndiaFieldSelector[]
  previousVisitAddress1: IndiaFieldSelector[]
  previousVisitAddress2: IndiaFieldSelector[]
  previousVisitAddress3: IndiaFieldSelector[]
  oldVisaNumber: IndiaFieldSelector[]
  oldVisaType: IndiaFieldSelector[]
  oldVisaIssuePlace: IndiaFieldSelector[]
  oldVisaIssueDate: IndiaFieldSelector[]
  refuseFlag: IndiaFieldSelector[]
  refuseDetails: IndiaFieldSelector[]
  countryVisited: IndiaFieldSelector[]
  saarcFlag: IndiaFieldSelector[]
  sponsorIndiaName: IndiaFieldSelector[]
  sponsorIndiaAddress1: IndiaFieldSelector[]
  sponsorIndiaAddress2: IndiaFieldSelector[]
  sponsorIndiaPhone: IndiaFieldSelector[]
  sponsorMissionName: IndiaFieldSelector[]
  sponsorMissionAddress1: IndiaFieldSelector[]
  sponsorMissionAddress2: IndiaFieldSelector[]
  sponsorMissionPhone: IndiaFieldSelector[]
  submitContinue: IndiaFieldSelector[]
  submitExit: IndiaFieldSelector[]
}

export const BANGLADESH_VISA_DETAILS_SELECTORS: BangladeshVisaDetailsSelectors = {
  duration: [
    { strategy: 'id', value: 'duration' },
    { strategy: 'name', value: 'appl.duration' },
    { strategy: 'name', value: 'duration' },
    { strategy: 'css', value: 'input[name="appl.duration"], select[name="appl.duration"], input#duration' },
  ],
  visaEntryType: [
    { strategy: 'id', value: 'visa_entry_id' },
    { strategy: 'name', value: 'appl.visa_entry_id' },
    { strategy: 'css', value: 'select[name="appl.visa_entry_id"], select#visa_entry_id' },
  ],
  expectedArrivalDate: [
    { strategy: 'id', value: 'jouryney_id' },
    { strategy: 'id', value: 'journey_id' },
    { strategy: 'name', value: 'appl.journeydate' },
    { strategy: 'css', value: 'input[name="appl.journeydate"], input#jouryney_id' },
  ],
  entryPoint: [
    { strategy: 'id', value: 'entrypoint' },
    { strategy: 'name', value: 'appl.entrypoint' },
    { strategy: 'css', value: 'select[name="appl.entrypoint"], input[name="appl.entrypoint"], select#entrypoint' },
  ],
  exitPoint: [
    { strategy: 'id', value: 'exitpointprc' },
    { strategy: 'name', value: 'appl.exitpoint' },
    { strategy: 'css', value: 'select[name="appl.exitpoint"], input[name="appl.exitpoint"], select#exitpointprc' },
  ],
  oldVisaFlag: [
    { strategy: 'id', value: 'old_visa_flag1' },
    { strategy: 'id', value: 'old_visa_flag2' },
    { strategy: 'name', value: 'appl.old_visa_flag' },
    { strategy: 'css', value: 'input[name="appl.old_visa_flag"]' },
  ],
  previousVisitAddress1: [
    { strategy: 'id', value: 'prv_visit_add1' },
    { strategy: 'name', value: 'appl.prv_visit_add1' },
    { strategy: 'css', value: 'input[name="appl.prv_visit_add1"], input#prv_visit_add1' },
  ],
  previousVisitAddress2: [
    { strategy: 'id', value: 'prv_visit_add2' },
    { strategy: 'name', value: 'appl.prv_visit_add2' },
    { strategy: 'css', value: 'input[name="appl.prv_visit_add2"], input#prv_visit_add2' },
  ],
  previousVisitAddress3: [
    { strategy: 'id', value: 'prv_visit_add3' },
    { strategy: 'name', value: 'appl.prv_visit_add3' },
    { strategy: 'css', value: 'input[name="appl.prv_visit_add3"], input#prv_visit_add3' },
  ],
  oldVisaNumber: [
    { strategy: 'id', value: 'old_visa_no' },
    { strategy: 'name', value: 'appl.old_visa_no' },
    { strategy: 'css', value: 'input[name="appl.old_visa_no"], input#old_visa_no' },
  ],
  oldVisaType: [
    { strategy: 'id', value: 'old_visa_type_id' },
    { strategy: 'name', value: 'appl.old_visa_type_id' },
    { strategy: 'css', value: 'select[name="appl.old_visa_type_id"], select#old_visa_type_id' },
  ],
  oldVisaIssuePlace: [
    { strategy: 'id', value: 'oldvisaissueplace' },
    { strategy: 'name', value: 'appl.oldvisaissueplace' },
    { strategy: 'css', value: 'input[name="appl.oldvisaissueplace"], input#oldvisaissueplace' },
  ],
  oldVisaIssueDate: [
    { strategy: 'id', value: 'oldvisaissuedate' },
    { strategy: 'name', value: 'appl.oldvisaissuedate' },
    { strategy: 'css', value: 'input[name="appl.oldvisaissuedate"], input#oldvisaissuedate' },
  ],
  refuseFlag: [
    { strategy: 'id', value: 'refuse_flag1' },
    { strategy: 'id', value: 'refuse_flag2' },
    { strategy: 'name', value: 'appl.refuse_flag' },
    { strategy: 'css', value: 'input[name="appl.refuse_flag"]' },
  ],
  refuseDetails: [
    { strategy: 'id', value: 'refuse_details' },
    { strategy: 'name', value: 'appl.refuse_details' },
    { strategy: 'css', value: 'textarea[name="appl.refuse_details"], input#refuse_details' },
  ],
  countryVisited: [
    { strategy: 'id', value: 'country_visited' },
    { strategy: 'name', value: 'appl.country_visited' },
    { strategy: 'css', value: 'input[name="appl.country_visited"], textarea[name="appl.country_visited"], input#country_visited' },
  ],
  saarcFlag: [
    { strategy: 'id', value: 'saarc_flag1' },
    { strategy: 'id', value: 'saarc_flag2' },
    { strategy: 'name', value: 'appl.saarc_flag' },
    { strategy: 'css', value: 'input[name="appl.saarc_flag"]' },
  ],
  sponsorIndiaName: [
    { strategy: 'id', value: 'nameofsponsor_ind' },
    { strategy: 'name', value: 'appl.nameofsponsor_ind' },
    { strategy: 'css', value: 'input[name="appl.nameofsponsor_ind"], input#nameofsponsor_ind' },
  ],
  sponsorIndiaAddress1: [
    { strategy: 'id', value: 'add1ofsponsor_ind' },
    { strategy: 'name', value: 'appl.add1ofsponsor_ind' },
    { strategy: 'css', value: 'input[name="appl.add1ofsponsor_ind"], input#add1ofsponsor_ind' },
  ],
  sponsorIndiaAddress2: [
    { strategy: 'id', value: 'add2ofsponsor_ind' },
    { strategy: 'name', value: 'appl.add2ofsponsor_ind' },
    { strategy: 'css', value: 'input[name="appl.add2ofsponsor_ind"], input#add2ofsponsor_ind' },
  ],
  sponsorIndiaPhone: [
    { strategy: 'id', value: 'phoneofsponsor_ind' },
    { strategy: 'name', value: 'appl.phoneofsponsor_ind' },
    { strategy: 'css', value: 'input[name="appl.phoneofsponsor_ind"], input#phoneofsponsor_ind' },
  ],
  sponsorMissionName: [
    { strategy: 'id', value: 'nameofsponsor_msn' },
    { strategy: 'name', value: 'appl.nameofsponsor_msn' },
    { strategy: 'css', value: 'input[name="appl.nameofsponsor_msn"], input#nameofsponsor_msn' },
  ],
  sponsorMissionAddress1: [
    { strategy: 'id', value: 'add1ofsponsor_msn' },
    { strategy: 'name', value: 'appl.add1ofsponsor_msn' },
    { strategy: 'css', value: 'input[name="appl.add1ofsponsor_msn"], input#add1ofsponsor_msn' },
  ],
  sponsorMissionAddress2: [
    { strategy: 'id', value: 'add2ofsponsor_msn' },
    { strategy: 'name', value: 'appl.add2ofsponsor_msn' },
    { strategy: 'css', value: 'input[name="appl.add2ofsponsor_msn"], input#add2ofsponsor_msn' },
  ],
  sponsorMissionPhone: [
    { strategy: 'id', value: 'phoneofsponsor_msn' },
    { strategy: 'name', value: 'appl.phoneofsponsor_msn' },
    { strategy: 'css', value: 'input[name="appl.phoneofsponsor_msn"], input#phoneofsponsor_msn' },
  ],
  submitContinue: [
    { strategy: 'id', value: 'continue' },
    { strategy: 'name', value: 'continue' },
    { strategy: 'css', value: 'input#continue, button#continue' },
  ],
  submitExit: [
    { strategy: 'id', value: 'exit' },
    { strategy: 'name', value: 'exit' },
    { strategy: 'css', value: 'input#exit, button#exit' },
  ],
}
