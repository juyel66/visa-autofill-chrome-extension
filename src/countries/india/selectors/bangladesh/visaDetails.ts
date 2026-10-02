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
  purpose: IndiaFieldSelector[]
  businessCompanyName: IndiaFieldSelector[]
  businessCompanyAddress: IndiaFieldSelector[]
  businessCompanyPhone: IndiaFieldSelector[]
  businessCompanyEmail: IndiaFieldSelector[]
  expectedArrivalDate: IndiaFieldSelector[]
  entryPoint: IndiaFieldSelector[]
  exitPoint: IndiaFieldSelector[]
  oldVisaFlag: IndiaFieldSelector[]
  previousVisitAddress1: IndiaFieldSelector[]
  previousVisitAddress2: IndiaFieldSelector[]
  previousVisitAddress3: IndiaFieldSelector[]
  citiesVisitedIndia: IndiaFieldSelector[]
  oldVisaNumber: IndiaFieldSelector[]
  oldVisaType: IndiaFieldSelector[]
  oldVisaIssuePlace: IndiaFieldSelector[]
  oldVisaIssueDate: IndiaFieldSelector[]
  refuseFlag: IndiaFieldSelector[]
  refuseDetails: IndiaFieldSelector[]
  countryVisited: IndiaFieldSelector[]
  saarcFlag: IndiaFieldSelector[]
  saarcDetails: IndiaFieldSelector[]
  sponsorIndiaName: IndiaFieldSelector[]
  sponsorIndiaAddress1: IndiaFieldSelector[]
  sponsorIndiaAddress2: IndiaFieldSelector[]
  sponsorState: IndiaFieldSelector[]
  sponsorDistrict: IndiaFieldSelector[]
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
  purpose: [
    { strategy: 'id', value: 'purpose' },
    { strategy: 'name', value: 'appl.purpose' },
    { strategy: 'id', value: 'purpose_id' },
    { strategy: 'name', value: 'appl.purpose_id' },
    { strategy: 'css', value: 'select[name="appl.purpose"], select#purpose, input[name="appl.purpose"], input#purpose' },
  ],
  businessCompanyName: [
    { strategy: 'id', value: 'comp_name' },
    { strategy: 'name', value: 'appl.comp_name' },
    { strategy: 'name', value: 'comp_name' },
    { strategy: 'id', value: 'business_company_name' },
    { strategy: 'name', value: 'appl.business_company_name' },
    { strategy: 'name', value: 'appl.ind_comp_name' },
    {
      strategy: 'css',
      value:
        'input[name="appl.comp_name"], input#comp_name, input[name="comp_name"], input[name="appl.business_company_name"], input#business_company_name, input[name*="comp_name" i], input[id*="comp_name" i], input[name*="company" i]',
    },
  ],
  businessCompanyAddress: [
    { strategy: 'id', value: 'comp_address' },
    { strategy: 'name', value: 'appl.comp_address' },
    { strategy: 'name', value: 'comp_address' },
    { strategy: 'id', value: 'business_address' },
    { strategy: 'name', value: 'appl.business_address' },
    { strategy: 'name', value: 'appl.ind_comp_address' },
    {
      strategy: 'css',
      value:
        'input[name="appl.comp_address"], input#comp_address, input[name="comp_address"], input[name="appl.business_address"], input#business_address, input[name*="comp_address" i], input[id*="comp_address" i], input[name*="comp_add" i], input[id*="comp_add" i]',
    },
  ],
  businessCompanyPhone: [
    { strategy: 'id', value: 'comp_phone' },
    { strategy: 'name', value: 'appl.comp_phone' },
    { strategy: 'name', value: 'comp_phone' },
    { strategy: 'id', value: 'business_phone' },
    { strategy: 'name', value: 'appl.business_phone' },
    { strategy: 'name', value: 'appl.ind_comp_phone' },
    {
      strategy: 'css',
      value:
        'input[name="appl.comp_phone"], input#comp_phone, input[name="comp_phone"], input[name="appl.business_phone"], input#business_phone, input[name*="comp_phone" i], input[id*="comp_phone" i]',
    },
  ],
  businessCompanyEmail: [
    { strategy: 'id', value: 'comp_email' },
    { strategy: 'name', value: 'appl.comp_email' },
    { strategy: 'name', value: 'comp_email' },
    { strategy: 'id', value: 'business_email' },
    { strategy: 'name', value: 'appl.business_email' },
    { strategy: 'name', value: 'appl.ind_comp_email' },
    {
      strategy: 'css',
      value:
        'input[name="appl.comp_email"], input#comp_email, input[name="comp_email"], input[name="appl.business_email"], input#business_email, input[name*="comp_email" i], input[id*="comp_email" i]',
    },
  ],
  expectedArrivalDate: [
    { strategy: 'id', value: 'jouryney_id' },
    { strategy: 'id', value: 'journey_id' },
    { strategy: 'name', value: 'appl.journeydate' },
    { strategy: 'css', value: 'input[name="appl.journeydate"], input#jouryney_id' },
  ],
  entryPoint: [
    { strategy: 'id', value: 'entrypoint' },
    { strategy: 'id', value: 'portOfArrival' },
    { strategy: 'id', value: 'port_of_arrival' },
    { strategy: 'id', value: 'portofarrival' },
    { strategy: 'id', value: 'arrival_port' },
    { strategy: 'name', value: 'appl.entrypoint' },
    { strategy: 'name', value: 'entrypoint' },
    { strategy: 'name', value: 'appl.port_of_arrival' },
    { strategy: 'name', value: 'port_of_arrival' },
    { strategy: 'name', value: 'appl.portOfArrival' },
    { strategy: 'css', value: 'select[name="appl.entrypoint"], select[name="entrypoint"], select#entrypoint, input[name="appl.entrypoint"], input#entrypoint, select[name*="entry" i], input[name*="entry" i], select[name*="arrival" i], input[name*="arrival" i], select#portOfArrival, input#portOfArrival' },
  ],
  exitPoint: [
    { strategy: 'id', value: 'exitpointprc' },
    { strategy: 'id', value: 'exitpoint' },
    { strategy: 'id', value: 'portOfExit' },
    { strategy: 'id', value: 'port_of_exit' },
    { strategy: 'id', value: 'portofexit' },
    { strategy: 'id', value: 'departure_port' },
    { strategy: 'name', value: 'appl.exitpoint' },
    { strategy: 'name', value: 'exitpoint' },
    { strategy: 'name', value: 'appl.port_of_exit' },
    { strategy: 'name', value: 'port_of_exit' },
    { strategy: 'name', value: 'appl.portOfExit' },
    { strategy: 'css', value: 'select[name="appl.exitpoint"], select[name="exitpoint"], select#exitpointprc, select#exitpoint, input[name="appl.exitpoint"], input#exitpoint, select[name*="exit" i], input[name*="exit" i], select#portOfExit, input#portOfExit' },
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
  citiesVisitedIndia: [
    { strategy: 'id', value: 'cities_visited' },
    { strategy: 'name', value: 'appl.cities_visited' },
    { strategy: 'id', value: 'prv_visit_cities' },
    { strategy: 'name', value: 'appl.prv_visit_cities' },
    { strategy: 'id', value: 'prv_visit_add3' },
    { strategy: 'css', value: 'textarea[name="appl.cities_visited"], textarea#cities_visited, input#cities_visited, textarea[name="appl.prv_visit_cities"], input#prv_visit_add3' },
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
    { strategy: 'id', value: 'refuse_flag2' },
    { strategy: 'id', value: 'refuse_flag1' },
    { strategy: 'name', value: 'appl.refuse_flag' },
    { strategy: 'name', value: 'refuse_flag' },
    { strategy: 'css', value: 'input[name="appl.refuse_flag"], input[name="refuse_flag"], input#refuse_flag2, input#refuse_flag1' },
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
  saarcDetails: [
    { strategy: 'id', value: 'saarc_details' },
    { strategy: 'name', value: 'appl.saarc_details' },
    { strategy: 'css', value: 'textarea[name="appl.saarc_details"], input#saarc_details, textarea#saarc_details' },
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
  sponsorState: [
    { strategy: 'id', value: 'stateofsponsor_ind' },
    { strategy: 'name', value: 'appl.stateofsponsor_ind' },
    { strategy: 'id', value: 'sponsor_state' },
    { strategy: 'name', value: 'appl.sponsor_state' },
    { strategy: 'css', value: 'select[name="appl.stateofsponsor_ind"], select#stateofsponsor_ind, select[name="appl.sponsor_state"], select#sponsor_state' },
  ],
  sponsorDistrict: [
    { strategy: 'id', value: 'districtofsponsor_ind' },
    { strategy: 'name', value: 'appl.districtofsponsor_ind' },
    { strategy: 'id', value: 'sponsor_district' },
    { strategy: 'name', value: 'appl.sponsor_district' },
    { strategy: 'css', value: 'select[name="appl.districtofsponsor_ind"], select#districtofsponsor_ind, select[name="appl.sponsor_district"], input#districtofsponsor_ind' },
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
