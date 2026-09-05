import type { IndiaFieldSelector } from '../../mapping.types'

/**
 * Bangladesh Indian Visa Portal (https://indianvisa-bangladesh.nic.in/)
 * Page: /visa/FamilyDetails (Canonical Page: FAMILY_DETAILS)
 * 
 * Verified DOM selectors provided from live Bangladesh portal DOM evidence.
 */
export interface BangladeshFamilyDetailsSelectors {
  presentAddress1: IndiaFieldSelector[]
  presentAddress2: IndiaFieldSelector[]
  presentStateCity: IndiaFieldSelector[]
  presentPostalCode: IndiaFieldSelector[]
  presentPhone: IndiaFieldSelector[]
  mobile: IndiaFieldSelector[]
  sameAddress: IndiaFieldSelector[]
  permanentAddress1: IndiaFieldSelector[]
  permanentAddress2: IndiaFieldSelector[]
  permanentStateCity: IndiaFieldSelector[]
  fatherName: IndiaFieldSelector[]
  fatherPlaceOfBirth: IndiaFieldSelector[]
  fatherCountryOfBirth: IndiaFieldSelector[]
  fatherNationality: IndiaFieldSelector[]
  fatherPreviousNationality: IndiaFieldSelector[]
  motherName: IndiaFieldSelector[]
  motherPlaceOfBirth: IndiaFieldSelector[]
  motherCountryOfBirth: IndiaFieldSelector[]
  motherNationality: IndiaFieldSelector[]
  motherPreviousNationality: IndiaFieldSelector[]
  maritalStatus: IndiaFieldSelector[]
  spouseName: IndiaFieldSelector[]
  spousePlaceOfBirth: IndiaFieldSelector[]
  spouseCountryOfBirth: IndiaFieldSelector[]
  spouseNationality: IndiaFieldSelector[]
  spousePreviousNationality: IndiaFieldSelector[]
  grandparentFlag: IndiaFieldSelector[]
  grandparentDetails: IndiaFieldSelector[]
  occupation: IndiaFieldSelector[]
  employerName: IndiaFieldSelector[]
  employerDesignation: IndiaFieldSelector[]
  employerAddress: IndiaFieldSelector[]
  employerPhone: IndiaFieldSelector[]
  previousOccupation: IndiaFieldSelector[]
  previousOrgFlag: IndiaFieldSelector[]
  previousOrganization: IndiaFieldSelector[]
  previousDesignation: IndiaFieldSelector[]
  previousRank: IndiaFieldSelector[]
  previousPosting: IndiaFieldSelector[]
}

export const BANGLADESH_FAMILY_DETAILS_SELECTORS: BangladeshFamilyDetailsSelectors = {
  presentAddress1: [
    { strategy: 'id', value: 'pres_add1' },
    { strategy: 'name', value: 'appl.pres_add1' },
    { strategy: 'name', value: 'pres_addr1' },
    { strategy: 'css', value: 'input[name="appl.pres_add1"], input#pres_add1' },
  ],
  presentAddress2: [
    { strategy: 'id', value: 'pres_add2' },
    { strategy: 'name', value: 'appl.pres_add2' },
    { strategy: 'name', value: 'pres_addr2' },
    { strategy: 'css', value: 'input[name="appl.pres_add2"], input#pres_add2' },
  ],
  presentStateCity: [
    { strategy: 'id', value: 'pres_add3' },
    { strategy: 'name', value: 'appl.state_name' },
    { strategy: 'name', value: 'pres_city' },
    { strategy: 'css', value: 'input[name="appl.state_name"], input#pres_add3' },
  ],
  presentPostalCode: [
    { strategy: 'id', value: 'pincode' },
    { strategy: 'name', value: 'appl.pincode' },
    { strategy: 'name', value: 'pres_postal_code' },
    { strategy: 'css', value: 'input[name="appl.pincode"], input#pincode' },
  ],
  presentPhone: [
    { strategy: 'id', value: 'pres_phone' },
    { strategy: 'name', value: 'appl.pres_phone' },
    { strategy: 'name', value: 'phone_no' },
    { strategy: 'css', value: 'input[name="appl.pres_phone"], input#pres_phone' },
  ],
  mobile: [
    { strategy: 'id', value: 'mobile' },
    { strategy: 'name', value: 'appl.mobile' },
    { strategy: 'name', value: 'mobile_no' },
    { strategy: 'css', value: 'input[name="appl.mobile"], input#mobile' },
  ],
  sameAddress: [
    { strategy: 'id', value: 'sameAddress_id' },
    { strategy: 'name', value: 'sameAddress' },
    { strategy: 'name', value: 'same_address' },
    { strategy: 'css', value: 'input[name="sameAddress"], input#sameAddress_id' },
  ],
  permanentAddress1: [
    { strategy: 'id', value: 'perm_address1' },
    { strategy: 'name', value: 'appl.perm_add1' },
    { strategy: 'name', value: 'perm_addr1' },
    { strategy: 'css', value: 'input[name="appl.perm_add1"], input#perm_address1' },
  ],
  permanentAddress2: [
    { strategy: 'id', value: 'perm_address2' },
    { strategy: 'name', value: 'appl.perm_add2' },
    { strategy: 'name', value: 'perm_addr2' },
    { strategy: 'css', value: 'input[name="appl.perm_add2"], input#perm_address2' },
  ],
  permanentStateCity: [
    { strategy: 'id', value: 'perm_address3' },
    { strategy: 'name', value: 'appl.perm_add3' },
    { strategy: 'name', value: 'perm_city' },
    { strategy: 'css', value: 'input[name="appl.perm_add3"], input#perm_address3' },
  ],
  fatherName: [
    { strategy: 'id', value: 'fthrname' },
    { strategy: 'name', value: 'appl.fthrname' },
    { strategy: 'name', value: 'father_name' },
    { strategy: 'css', value: 'input[name="appl.fthrname"], input#fthrname' },
  ],
  fatherPlaceOfBirth: [
    { strategy: 'id', value: 'father_place_of_birth' },
    { strategy: 'name', value: 'appl.father_place_of_birth' },
    { strategy: 'name', value: 'father_place_birth' },
    { strategy: 'css', value: 'input[name="appl.father_place_of_birth"], input#father_place_of_birth' },
  ],
  fatherCountryOfBirth: [
    { strategy: 'id', value: 'father_country_of_birth' },
    { strategy: 'name', value: 'appl.father_country_of_birth' },
    { strategy: 'name', value: 'father_country_birth' },
    { strategy: 'css', value: 'select[name="appl.father_country_of_birth"], select#father_country_of_birth' },
  ],
  fatherNationality: [
    { strategy: 'id', value: 'father_nationality' },
    { strategy: 'name', value: 'appl.father_nationality' },
    { strategy: 'css', value: 'select[name="appl.father_nationality"], select#father_nationality' },
  ],
  fatherPreviousNationality: [
    { strategy: 'id', value: 'father_prev_nationality' },
    { strategy: 'id', value: 'father_previous_nationality' },
    { strategy: 'name', value: 'appl.father_prev_nationality' },
    { strategy: 'name', value: 'father_prev_nationality' },
    { strategy: 'css', value: 'select[name="appl.father_prev_nationality"], select#father_prev_nationality, select#father_previous_nationality' },
  ],
  motherName: [
    { strategy: 'id', value: 'mother_name' },
    { strategy: 'name', value: 'appl.mother_name' },
    { strategy: 'name', value: 'mother_name' },
    { strategy: 'css', value: 'input[name="appl.mother_name"], input#mother_name' },
  ],
  motherPlaceOfBirth: [
    { strategy: 'id', value: 'mother_place_of_birth' },
    { strategy: 'name', value: 'appl.mother_place_of_birth' },
    { strategy: 'name', value: 'mother_place_birth' },
    { strategy: 'css', value: 'input[name="appl.mother_place_of_birth"], input#mother_place_of_birth' },
  ],
  motherCountryOfBirth: [
    { strategy: 'id', value: 'mother_country_of_birth' },
    { strategy: 'name', value: 'appl.mother_country_of_birth' },
    { strategy: 'name', value: 'mother_country_birth' },
    { strategy: 'css', value: 'select[name="appl.mother_country_of_birth"], select#mother_country_of_birth' },
  ],
  motherNationality: [
    { strategy: 'id', value: 'mother_nationality' },
    { strategy: 'name', value: 'appl.mother_nationality' },
    { strategy: 'css', value: 'select[name="appl.mother_nationality"], select#mother_nationality' },
  ],
  motherPreviousNationality: [
    { strategy: 'id', value: 'mother_prev_nationality' },
    { strategy: 'id', value: 'mother_previous_nationality' },
    { strategy: 'name', value: 'appl.mother_prev_nationality' },
    { strategy: 'name', value: 'mother_prev_nationality' },
    { strategy: 'css', value: 'select[name="appl.mother_prev_nationality"], select#mother_prev_nationality, select#mother_previous_nationality' },
  ],
  maritalStatus: [
    { strategy: 'id', value: 'marital_status' },
    { strategy: 'name', value: 'appl.marital_status' },
    { strategy: 'name', value: 'marital_status' },
    { strategy: 'css', value: 'select[name="appl.marital_status"], select#marital_status' },
  ],
  spouseName: [
    { strategy: 'id', value: 'spouse_name' },
    { strategy: 'name', value: 'appl.spouse_name' },
    { strategy: 'name', value: 'spouse_name' },
    { strategy: 'css', value: 'input[name="appl.spouse_name"], input#spouse_name' },
  ],
  spousePlaceOfBirth: [
    { strategy: 'id', value: 'spouse_birth_place' },
    { strategy: 'id', value: 'spouse_place_of_birth' },
    { strategy: 'name', value: 'appl.spouse_place_birth' },
    { strategy: 'name', value: 'appl.spouse_place_of_birth' },
    { strategy: 'name', value: 'spouse_place_birth' },
    { strategy: 'css', value: 'input[name="appl.spouse_place_birth"], input#spouse_birth_place, input#spouse_place_of_birth' },
  ],
  spouseCountryOfBirth: [
    { strategy: 'id', value: 'spouse_birth_country' },
    { strategy: 'id', value: 'spouse_country_of_birth' },
    { strategy: 'name', value: 'appl.spouse_country_birth' },
    { strategy: 'name', value: 'appl.spouse_country_of_birth' },
    { strategy: 'name', value: 'spouse_country_birth' },
    { strategy: 'css', value: 'select[name="appl.spouse_country_birth"], select#spouse_birth_country, select#spouse_country_of_birth' },
  ],
  spouseNationality: [
    { strategy: 'id', value: 'spouse_nationality' },
    { strategy: 'name', value: 'appl.spouse_nationality' },
    { strategy: 'name', value: 'spouse_nationality' },
    { strategy: 'css', value: 'select[name="appl.spouse_nationality"], select#spouse_nationality' },
  ],
  spousePreviousNationality: [
    { strategy: 'id', value: 'spouse_prev_nationality' },
    { strategy: 'id', value: 'spouse_previous_nationality' },
    { strategy: 'name', value: 'appl.spouse_prev_nationality' },
    { strategy: 'name', value: 'spouse_prev_nationality' },
    { strategy: 'css', value: 'select[name="appl.spouse_prev_nationality"], select#spouse_prev_nationality, select#spouse_previous_nationality' },
  ],
  grandparentFlag: [
    { strategy: 'id', value: 'grandparent_flag1' },
    { strategy: 'id', value: 'grandparent_flag2' },
    { strategy: 'name', value: 'appl.grandparent_flag' },
    { strategy: 'css', value: 'input[name="appl.grandparent_flag"]' },
  ],
  grandparentDetails: [
    { strategy: 'id', value: 'grandparent_details' },
    { strategy: 'name', value: 'appl.grandparent_details' },
    { strategy: 'css', value: 'textarea[name="appl.grandparent_details"], input#grandparent_details' },
  ],
  occupation: [
    { strategy: 'id', value: 'occupation' },
    { strategy: 'name', value: 'appl.occupation' },
    { strategy: 'name', value: 'present_occupation' },
    { strategy: 'css', value: 'select[name="appl.occupation"], select#occupation' },
  ],
  employerName: [
    { strategy: 'id', value: 'empname' },
    { strategy: 'name', value: 'appl.empname' },
    { strategy: 'name', value: 'employer_name' },
    { strategy: 'css', value: 'input[name="appl.empname"], input#empname' },
  ],
  employerDesignation: [
    { strategy: 'id', value: 'empdesignation' },
    { strategy: 'name', value: 'appl.empdesignation' },
    { strategy: 'name', value: 'designation' },
    { strategy: 'css', value: 'input[name="appl.empdesignation"], input#empdesignation' },
  ],
  employerAddress: [
    { strategy: 'id', value: 'empaddress' },
    { strategy: 'name', value: 'appl.empaddress' },
    { strategy: 'name', value: 'employer_address' },
    { strategy: 'css', value: 'input[name="appl.empaddress"], input#empaddress' },
  ],
  employerPhone: [
    { strategy: 'id', value: 'empphone' },
    { strategy: 'name', value: 'appl.empphone' },
    { strategy: 'name', value: 'employer_phone' },
    { strategy: 'css', value: 'input[name="appl.empphone"], input#empphone' },
  ],
  previousOccupation: [
    { strategy: 'id', value: 'previous_occupation' },
    { strategy: 'name', value: 'appl.previous_occupation' },
    { strategy: 'css', value: 'select[name="appl.previous_occupation"], input#previous_occupation' },
  ],
  previousOrgFlag: [
    { strategy: 'id', value: 'prev_org1' },
    { strategy: 'id', value: 'prev_org2' },
    { strategy: 'name', value: 'appl.prev_org' },
    { strategy: 'css', value: 'input[name="appl.prev_org"]' },
  ],
  previousOrganization: [
    { strategy: 'id', value: 'previous_organization' },
    { strategy: 'name', value: 'appl.previous_organization' },
    { strategy: 'css', value: 'input[name="appl.previous_organization"], input#previous_organization' },
  ],
  previousDesignation: [
    { strategy: 'id', value: 'previous_designation' },
    { strategy: 'name', value: 'appl.previous_designation' },
    { strategy: 'css', value: 'input[name="appl.previous_designation"], input#previous_designation' },
  ],
  previousRank: [
    { strategy: 'id', value: 'previous_rank' },
    { strategy: 'name', value: 'appl.previous_rank' },
    { strategy: 'css', value: 'input[name="appl.previous_rank"], input#previous_rank' },
  ],
  previousPosting: [
    { strategy: 'id', value: 'previous_posting' },
    { strategy: 'name', value: 'appl.previous_posting' },
    { strategy: 'css', value: 'input[name="appl.previous_posting"], input#previous_posting' },
  ],
}
