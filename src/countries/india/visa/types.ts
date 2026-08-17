import type { AccommodationDetails, ReferenceDetails } from '../../../core/applicant/types'
import type { DocumentMetadata } from '../../../core/document/types'

export type IndiaVisaFieldId =
  // Registration
  | 'reg_applying_from_country'
  | 'reg_indian_mission'
  | 'reg_nationality'
  | 'reg_date_of_birth'
  | 'reg_email'
  | 'reg_reenter_email'
  | 'reg_expected_arrival_date'
  | 'reg_captcha'
  // Basic Details
  | 'surname'
  | 'given_names'
  | 'has_changed_name'
  | 'previous_name'
  | 'gender'
  | 'date_of_birth'
  | 'town_city_of_birth'
  | 'country_of_birth'
  | 'national_id_number'
  | 'religion'
  | 'visible_identification_marks'
  | 'educational_qualification'
  | 'nationality'
  | 'nationality_acquired_by'
  | 'previous_nationality'
  | 'passport_number'
  | 'passport_place_of_issue'
  | 'passport_issue_date'
  | 'passport_expiry_date'
  | 'holds_other_passport'
  | 'other_passport_number'
  | 'other_passport_country_of_issue'
  | 'other_passport_issue_date'
  | 'other_passport_place_of_issue'
  | 'other_passport_nationality'
  | 'present_address_line1'
  | 'present_address_line2'
  | 'present_village_town_city'
  | 'present_district'
  | 'present_state_province'
  | 'present_country'
  | 'present_postal_code'
  | 'present_phone'
  | 'present_mobile'
  | 'present_email'
  | 'same_as_present_address'
  | 'permanent_address_line1'
  | 'permanent_address_line2'
  | 'permanent_village_town_city'
  | 'permanent_district'
  | 'permanent_state_province'
  | 'permanent_country'
  | 'permanent_postal_code'
  // Family Details
  | 'father_name'
  | 'father_nationality'
  | 'father_previous_nationality'
  | 'father_place_of_birth'
  | 'father_country_of_birth'
  | 'mother_name'
  | 'mother_nationality'
  | 'mother_previous_nationality'
  | 'mother_place_of_birth'
  | 'mother_country_of_birth'
  | 'spouse_name'
  | 'spouse_nationality'
  | 'spouse_previous_nationality'
  | 'spouse_place_of_birth'
  | 'spouse_country_of_birth'
  | 'has_pakistan_relation'
  | 'pakistan_relation_details'
  // Visa Details
  | 'visa_type'
  | 'number_of_entries'
  | 'period_of_visa'
  | 'expected_date_of_journey'
  | 'port_of_arrival'
  | 'port_of_exit'
  | 'places_to_be_visited'
  | 'purpose_of_visit'
  // Previous Visit Details
  | 'has_visited_india'
  | 'stay_address_in_india'
  | 'cities_visited_in_india'
  | 'previous_visa_type'
  | 'previous_visa_number'
  | 'previous_visa_issued_place'
  | 'previous_visa_date_of_issue'
  | 'countries_visited_last_10_years'
  | 'has_been_refused_visa'
  | 'visa_refusal_details'
  | 'has_been_deported'
  | 'deportation_details'
  // Profession / Occupation
  | 'present_occupation'
  | 'designation_rank'
  | 'employer_name'
  | 'employer_address'
  | 'employer_phone'
  | 'past_occupation'
  | 'has_military_service'
  | 'military_organization'
  | 'military_designation'
  | 'military_place_of_posting'
  | 'military_rank'
  // Accommodation
  | 'acc_hotel_name'
  | 'acc_address'
  | 'acc_state'
  | 'acc_phone'
  // References
  | 'ref_india_name'
  | 'ref_india_address'
  | 'ref_india_phone'
  | 'ref_bangladesh_name'
  | 'ref_bangladesh_address'
  | 'ref_bangladesh_phone'
  // Documents
  | 'doc_passport'
  | 'doc_photo'
  | 'doc_supporting'
  // Declaration
  | 'dec_agreed'
  | 'dec_date'

export interface RegistrationDetails {
  applyingFromCountry: string
  indianMission: string
  nationality: string
  dateOfBirth: string // YYYY-MM-DD
  email: string
  expectedArrivalDate: string // YYYY-MM-DD
  captchaCompletedManually: boolean
}

export interface VisaDetails {
  visaType: string
  numberOfEntries: string
  periodOfVisaMonths: number
  expectedDateOfJourney: string // YYYY-MM-DD
  portOfArrival: string
  portOfExit: string
  placesToBeVisited: string
  purposeOfVisit: string
}

export interface PreviousVisitDetails {
  hasVisitedIndia: boolean
  stayAddressInIndia?: string
  citiesVisitedInIndia?: string
  previousVisaType?: string
  previousVisaNumber?: string
  previousVisaIssuedPlace?: string
  previousVisaIssueDate?: string // YYYY-MM-DD
  countriesVisitedLast10Years?: string[]
  hasBeenRefusedIndianVisa: boolean
  refusalDetails?: string
  hasBeenDeportedFromIndia: boolean
  deportationDetails?: string
}

export interface IndiaVisaReferences {
  india: ReferenceDetails
  bangladesh: ReferenceDetails
}

export interface DeclarationDetails {
  isDeclared: boolean
  declarationDate?: string // YYYY-MM-DD
}

export type ApplicationStatus = 'draft' | 'in_progress' | 'completed'

export interface IndiaVisaApplication {
  applicationId: string
  applicantId: string // Reference to core ApplicantProfile
  registration: RegistrationDetails
  visaDetails: VisaDetails
  previousVisitDetails: PreviousVisitDetails
  accommodations: AccommodationDetails[]
  references: IndiaVisaReferences
  documents: DocumentMetadata[]
  declaration: DeclarationDetails
  status: ApplicationStatus
  createdAt: string // ISO 8601 string
  updatedAt: string // ISO 8601 string
}
