import type { ApplicantProfile } from '../../src/core/applicant/types'

export const SYNTHETIC_APPLICANT_PROFILE: ApplicantProfile = {
  applicantId: 'app_test_john_001',
  createdAt: '2026-08-17T12:00:00.000Z',
  updatedAt: '2026-08-17T12:00:00.000Z',
  personalInfo: {
    surname: 'APPLICANT',
    givenNames: 'JOHN TEST',
    previousName: '',
    hasChangedName: false,
    dateOfBirth: '1995-01-15',
    townCityOfBirth: 'Dhaka',
    countryOfBirth: 'Bangladesh',
    gender: 'male',
    nationality: 'Bangladesh',
    nationalityAcquiredBy: 'birth',
    nationalIdNumber: '1234567890',
    religion: 'Islam',
    educationalQualification: 'Graduate',
  },
  passport: {
    passportNumber: 'TEST000000',
    passportType: 'Ordinary',
    issuingCountry: 'Bangladesh',
    issueDate: '2025-01-15',
    expiryDate: '2035-01-14',
    placeOfIssue: 'Dhaka',
    holdsOtherPassport: false,
  },
  presentAddress: {
    addressLine1: '123 Test Street',
    addressLine2: 'Suite 400',
    villageTownCity: 'Dhaka',
    stateProvince: 'Dhaka Division',
    country: 'Bangladesh',
    postalCode: '1200',
  },
  permanentAddress: {
    addressLine1: '123 Test Street',
    addressLine2: 'Suite 400',
    villageTownCity: 'Dhaka',
    stateProvince: 'Dhaka Division',
    country: 'Bangladesh',
    postalCode: '1200',
    sameAsPresentAddress: true,
  },
  contact: {
    email: 'john.test@example.invalid',
    mobile: '+8801000000000',
    phone: '',
  },
  family: {
    father: {
      name: 'FATHER TEST',
      nationality: 'Bangladesh',
      countryOfBirth: 'Bangladesh',
      placeOfBirth: 'Dhaka',
    },
    mother: {
      name: 'MOTHER TEST',
      nationality: 'Bangladesh',
      countryOfBirth: 'Bangladesh',
      placeOfBirth: 'Dhaka',
    },
    hasPakistanRelation: false,
  },
  employment: {
    presentOccupation: 'Software Developer',
    employerName: 'Test Tech Ltd',
    hasMilitaryService: false,
  },
  travel: {
    purposeOfVisit: 'Tourism',
    intendedArrivalDate: '2026-10-01',
    intendedDepartureDate: '2026-10-15',
  },
  accommodation: {
    placeHotelName: 'Grand Test Hotel',
    address: '456 Resort Road',
    state: 'Delhi',
    phone: '+911100000000',
  },
  reference: {
    name: 'Ref Person',
    address: '789 Host Ave',
    phone: '+911199999999',
    email: 'ref@example.invalid',
  },
}

export const SYNTHETIC_TD3_MRZ_LINES = [
  'P<BGDAPPLICANT<<JOHN<TEST<<<<<<<<<<<<<<<<<<<',
  'TEST000006BGD9501153M3501140<<<<<<<<<<<<<<04',
]

export const SYNTHETIC_INDIA_VISA_FORM_HTML = `
<!DOCTYPE html>
<html>
<head><title>Indian Visa Application - Personal Details</title></head>
<body>
  <form id="visa_form" action="/visa/visadetails" method="post">
    <input type="text" id="surname" name="surname" value="" />
    <input type="text" id="given_name" name="given_name" value="" />
    <input type="text" id="dob" name="dob" value="" />
    <select id="nationality" name="nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" id="passport_no" name="passport_no" value="" />
  </form>
</body>
</html>
`
