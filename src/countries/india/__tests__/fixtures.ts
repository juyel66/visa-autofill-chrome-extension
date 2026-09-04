export const SYNTHETIC_REGULAR_VISA_FORM_HTML = `
<!DOCTYPE html>
<html>
<head><title>Indian Visa Application - Registration</title></head>
<body>
  <form id="visa_form" action="/visa/visadetails" method="post">
    <input type="text" id="surname" name="surname" value="" />
    <input type="text" id="given_name" name="given_name" value="" />
    <input type="text" id="dob" name="dob" value="" />
    <select id="nationality" name="nationality">
      <option value="">Select</option>
      <option value="BGD">BANGLADESH</option>
      <option value="USA">UNITED STATES</option>
    </select>
    <input type="text" id="passport_no" name="passport_no" value="" />
    <input type="text" id="captcha_input" name="captcha_input" value="" />
  </form>
</body>
</html>
`

export const SYNTHETIC_EVISA_FORM_HTML = `
<!DOCTYPE html>
<html>
<head><title>e-Visa Application</title></head>
<body>
  <form id="evisa_form" action="/evisa/registration" method="post">
    <input type="text" id="applicant_surname" name="applicant_surname" value="" />
    <input type="text" id="applicant_given_name" name="applicant_given_name" value="" />
    <input type="text" id="evisa_passport_no" name="evisa_passport_no" value="" />
  </form>
</body>
</html>
`

export const SYNTHETIC_ADDRESS_FORM_HTML = `
<!DOCTYPE html>
<html>
<head><title>Indian Visa Application - Address Details</title></head>
<body>
  <form id="address_form">
    <!-- Present Address -->
    <input type="text" name="pres_addr1" value="" />
    <input type="text" name="pres_addr2" value="" />
    <input type="text" name="pres_city" value="" />
    <input type="text" name="pres_state" value="" />
    <select name="pres_country">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="pres_postal_code" value="" />
    <input type="text" name="mobile_no" value="" />
    <input type="text" name="phone_no" value="" />

    <!-- Permanent Address -->
    <input type="text" name="perm_addr1" value="" />
    <input type="text" name="perm_addr2" value="" />
    <input type="text" name="perm_city" value="" />
    <input type="text" name="perm_state" value="" />
    <select name="perm_country">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="perm_postal_code" value="" />
    <input type="checkbox" name="same_address" />
  </form>
</body>
</html>
`

export const SYNTHETIC_FAMILY_FORM_HTML = `
<!DOCTYPE html>
<html>
<head><title>Indian Visa Application - Family Details</title></head>
<body>
  <form id="family_form">
    <!-- Father -->
    <input type="text" name="father_name" value="" />
    <select name="father_nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <select name="father_prev_nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="father_place_birth" value="" />
    <select name="father_country_birth">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>

    <!-- Mother -->
    <input type="text" name="mother_name" value="" />
    <select name="mother_nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <select name="mother_prev_nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="mother_place_birth" value="" />
    <select name="mother_country_birth">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
  </form>
</body>
</html>
`

export const SYNTHETIC_OCCUPATION_FORM_HTML = `
<!DOCTYPE html>
<html>
<head><title>Indian Visa Application - Occupation Details</title></head>
<body>
  <form id="occupation_form">
    <select name="present_occupation">
      <option value="">Select</option>
      <option value="Software Developer">Software Developer</option>
    </select>
    <input type="text" name="designation" value="" />
    <input type="text" name="employer_name" value="" />
    <input type="text" name="employer_address" value="" />
    <input type="text" name="employer_phone" value="" />
  </form>
</body>
</html>
`

export const SYNTHETIC_TRAVEL_FORM_HTML = `
<!DOCTYPE html>
<html>
<head><title>Indian Visa Application - Visa Details</title></head>
<body>
  <form id="travel_form">
    <select name="purpose">
      <option value="">Select</option>
      <option value="Tourism">Tourism</option>
    </select>
    <input type="text" name="arrival_date" value="" />
    <input type="text" name="departure_date" value="" />
  </form>
</body>
</html>
`

export const SYNTHETIC_ACCOMMODATION_REFERENCE_FORM_HTML = `
<!DOCTYPE html>
<html>
<head><title>Indian Visa Application - Reference Details</title></head>
<body>
  <form id="ref_form">
    <!-- Accommodation -->
    <input type="text" name="hotel_name" value="" />
    <input type="text" name="hotel_address" value="" />
    <select name="hotel_state">
      <option value="">Select</option>
      <option value="Delhi">Delhi</option>
    </select>
    <input type="text" name="hotel_phone" value="" />
    <input type="text" name="booking_ref" value="" />

    <!-- References -->
    <input type="text" name="ref_india_name" value="" />
    <input type="text" name="ref_india_address" value="" />
    <input type="text" name="ref_india_phone" value="" />
  </form>
</body>
</html>
`

/**
 * Minimal observed/verified DOM fixture for Bangladesh Indian Visa Registration Page:
 * https://indianvisa-bangladesh.nic.in/visa/Registration
 */
export const BANGLADESH_REGISTRATION_FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Online Visa Application - Registration (Bangladesh Portal)</title></head>
<body>
  <form id="reg_form" action="/visa/Registration" method="post">
    <!-- Country Applying From -->
    <select id="countryname_id" name="appl.countryname">
      <option value="">Select Country...</option>
      <option value="BGD">BANGLADESH</option>
      <option value="USA">UNITED STATES</option>
    </select>

    <!-- Indian Mission -->
    <select id="missioncode_id" name="appl.missioncode">
      <option value="">Select Mission...</option>
      <option value="BD01">BANGLADESH - DHAKA (IVAC)</option>
      <option value="BD02">BANGLADESH - CHITTAGONG (IVAC)</option>
    </select>

    <!-- Nationality -->
    <select id="nationality_id" name="appl.nationality">
      <option value="">Select Nationality...</option>
      <option value="BGD">BANGLADESH</option>
      <option value="IND">INDIA</option>
    </select>

    <!-- Date of Birth -->
    <input type="text" id="dob_id" name="appl.birthdate" placeholder="DD/MM/YYYY" value="" />

    <!-- Email -->
    <input type="text" id="email_id" name="appl.email" value="" />

    <!-- Email Confirm -->
    <input type="text" id="email_re_id" name="appl.email_re" value="" />

    <!-- Expected Date of Arrival -->
    <input type="text" id="jouryney_id" name="appl.journeydate" placeholder="DD/MM/YYYY" value="" />

    <!-- CAPTCHA (Manual Security Control) -->
    <input type="text" id="captcha" name="captcha" value="" />
  </form>
</body>
</html>
`

/**
 * Minimal observed/verified DOM fixture for Bangladesh Indian Visa Basic Details Page:
 * https://indianvisa-bangladesh.nic.in/visa/BasicDetails
 */
export const BANGLADESH_BASIC_DETAILS_FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Online Visa Application - Basic Details (Bangladesh Portal)</title></head>
<body>
  <form id="basic_details_form" action="/visa/BasicDetails" method="post">
    <!-- Surname & Given Name -->
    <input type="text" id="surname" name="appl.surname" value="" />
    <input type="text" id="givenName" name="appl.applname" value="" />
    <input type="checkbox" id="changedSurnameCheck" name="appl.changedSurnameCheck" />

    <!-- Gender -->
    <select id="gender" name="appl.applsex">
      <option value="">Select Gender...</option>
      <option value="M">MALE</option>
      <option value="F">FEMALE</option>
      <option value="T">TRANSGENDER</option>
    </select>

    <!-- Date of Birth -->
    <input type="text" id="dob" name="appl.birthdate" placeholder="DD/MM/YYYY" value="" />

    <!-- Place of Birth -->
    <input type="text" id="birth_place" name="appl.placbrth" value="" />
    <select id="country_birth" name="appl.country_of_birth">
      <option value="">Select Country of Birth...</option>
      <option value="BGD">BANGLADESH</option>
      <option value="IND">INDIA</option>
    </select>

    <!-- National ID / NIC -->
    <input type="text" id="nic_number" name="appl.nic_no" value="" />

    <!-- Religion -->
    <select id="religion" name="appl.religion">
      <option value="">Select Religion...</option>
      <option value="ISLAM">ISLAM</option>
      <option value="HINDU">HINDUISM</option>
      <option value="BUDDHISM">BUDDHISM</option>
      <option value="CHRISTIANITY">CHRISTIANITY</option>
    </select>

    <!-- Visible Identification Marks -->
    <input type="text" id="identity_marks" name="appl.visual_mark" value="" />

    <!-- Educational Qualification -->
    <select id="education" name="appl.edu_id">
      <option value="">Select Qualification...</option>
      <option value="GRADUATE">GRADUATE</option>
      <option value="POST GRADUATE">POST GRADUATE</option>
      <option value="HIGHER SECONDARY">HIGHER SECONDARY</option>
    </select>

    <!-- Nationality -->
    <select id="nationality_by" name="appl.nationality_by">
      <option value="By Birth">By Birth</option>
      <option value="Naturalization">Naturalization</option>
    </select>
    <select id="nationality" name="appl.nationality">
      <option value="">Select Nationality...</option>
      <option value="BGD">BANGLADESH</option>
      <option value="IND">INDIA</option>
    </select>

    <!-- Passport Details -->
    <input type="text" id="passport_no" name="appl.passport_number" value="" />
    <input type="text" id="passport_issue_place" name="appl.passport_issue_place" value="" />
    <input type="text" id="passport_issue_date" name="appl.passport_issue_date" placeholder="DD/MM/YYYY" value="" />
    <input type="text" id="passport_expiry_date" name="appl.passport_expiry_date" placeholder="DD/MM/YYYY" value="" />

    <!-- Other Passport -->
    <input type="radio" id="other_ppt_1" name="appl.oth_ppt" value="Y" />
    <input type="radio" id="other_ppt_2" name="appl.oth_ppt" value="N" />
    <input type="text" id="other_ppt_no" name="appl.oth_pptno" value="" />
    <input type="text" id="other_ppt_issue_place" name="appl.other_ppt_issue_place" value="" />
    <select id="other_ppt_country_issue" name="appl.prev_passport_country_issue">
      <option value="">Select Country...</option>
      <option value="BGD">BANGLADESH</option>
    </select>
    <select id="other_ppt_nat" name="appl.other_ppt_nationality">
      <option value="">Select Nationality...</option>
      <option value="BGD">BANGLADESH</option>
    </select>
  </form>
</body>
</html>
`

/**
 * Minimal observed/verified DOM fixture for Bangladesh Indian Visa Family Details Page:
 * https://indianvisa-bangladesh.nic.in/visa/FamilyDetails
 */
export const BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Online Visa Application - Family Details (Bangladesh Portal)</title></head>
<body>
  <form id="family_form" action="/visa/FamilyDetails" method="post">
    <!-- Present Address -->
    <input type="text" id="pres_add1" name="appl.pres_add1" value="" />
    <input type="text" id="pres_add2" name="appl.pres_add2" value="" />
    <input type="text" id="pres_add3" name="appl.state_name" value="" />
    <input type="text" id="pincode" name="appl.pincode" value="" />
    <input type="text" id="pres_phone" name="appl.pres_phone" value="" />
    <input type="text" id="mobile" name="appl.mobile" value="" />
    <input type="checkbox" id="sameAddress_id" name="sameAddress" />

    <!-- Permanent Address -->
    <input type="text" id="perm_address1" name="appl.perm_add1" value="" />
    <input type="text" id="perm_address2" name="appl.perm_add2" value="" />
    <input type="text" id="perm_address3" name="appl.perm_add3" value="" />

    <!-- Parents & Marital -->
    <input type="text" id="fthrname" name="appl.fthrname" value="" />
    <input type="text" id="father_place_of_birth" name="appl.father_place_of_birth" value="" />
    <select id="father_country_of_birth" name="appl.father_country_of_birth">
      <option value="BGD">BANGLADESH</option>
    </select>
    <select id="father_nationality" name="appl.father_nationality">
      <option value="BGD">BANGLADESH</option>
    </select>
    <input type="text" id="mother_name" name="appl.mother_name" value="" />
    <input type="text" id="mother_place_of_birth" name="appl.mother_place_of_birth" value="" />
    <select id="mother_country_of_birth" name="appl.mother_country_of_birth">
      <option value="BGD">BANGLADESH</option>
    </select>
    <select id="mother_nationality" name="appl.mother_nationality">
      <option value="BGD">BANGLADESH</option>
    </select>
    <select id="marital_status" name="appl.marital_status">
      <option value="Single">Single</option>
      <option value="Married">Married</option>
    </select>

    <!-- Grandparents -->
    <input type="radio" id="grandparent_flag1" name="appl.grandparent_flag" value="Y" />
    <input type="radio" id="grandparent_flag2" name="appl.grandparent_flag" value="N" />
    <textarea id="grandparent_details" name="appl.grandparent_details"></textarea>

    <!-- Occupation -->
    <select id="occupation" name="appl.occupation">
      <option value="BUSINESS">BUSINESS</option>
      <option value="SERVICE">SERVICE</option>
    </select>
    <input type="text" id="empname" name="appl.empname" value="" />
    <input type="text" id="empdesignation" name="appl.empdesignation" value="" />
    <input type="text" id="empaddress" name="appl.empaddress" value="" />
    <input type="text" id="empphone" name="appl.empphone" value="" />
    <select id="previous_occupation" name="appl.previous_occupation">
      <option value="">None</option>
    </select>
    <input type="radio" id="prev_org1" name="appl.prev_org" value="Y" />
    <input type="radio" id="prev_org2" name="appl.prev_org" value="N" />
    <input type="text" id="previous_organization" name="appl.previous_organization" value="" />
    <input type="text" id="previous_designation" name="appl.previous_designation" value="" />
    <input type="text" id="previous_rank" name="appl.previous_rank" value="" />
    <input type="text" id="previous_posting" name="appl.previous_posting" value="" />
  </form>
</body>
</html>
`

/**
 * Minimal observed/verified DOM fixture for Bangladesh Indian Visa Visa Details Page:
 * https://indianvisa-bangladesh.nic.in/visa/VisaDetails
 */
export const BANGLADESH_VISA_DETAILS_FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Online Visa Application - Visa Details (Bangladesh Portal)</title></head>
<body>
  <form id="visa_details_form" action="/visa/VisaDetails" method="post">
    <!-- Duration & Entry -->
    <input type="text" id="duration" name="appl.duration" value="" />
    <select id="visa_entry_id" name="appl.visa_entry_id">
      <option value="Single">Single</option>
      <option value="Double">Double</option>
      <option value="Multiple">Multiple</option>
    </select>
    <input type="text" id="jouryney_id" name="appl.journeydate" placeholder="DD/MM/YYYY" value="" />
    <select id="entrypoint" name="appl.entrypoint">
      <option value="HARIDASPUR">HARIDASPUR</option>
      <option value="CHENNAI">CHENNAI</option>
    </select>
    <select id="exitpointprc" name="appl.exitpoint">
      <option value="HARIDASPUR">HARIDASPUR</option>
    </select>

    <!-- Old Visa -->
    <input type="radio" id="old_visa_flag1" name="appl.old_visa_flag" value="Y" />
    <input type="radio" id="old_visa_flag2" name="appl.old_visa_flag" value="N" />
    <input type="text" id="prv_visit_add1" name="appl.prv_visit_add1" value="" />
    <input type="text" id="prv_visit_add2" name="appl.prv_visit_add2" value="" />
    <input type="text" id="prv_visit_add3" name="appl.prv_visit_add3" value="" />
    <input type="text" id="old_visa_no" name="appl.old_visa_no" value="" />
    <select id="old_visa_type_id" name="appl.old_visa_type_id">
      <option value="TOURIST">TOURIST</option>
    </select>
    <input type="text" id="oldvisaissueplace" name="appl.oldvisaissueplace" value="" />
    <input type="text" id="oldvisaissuedate" name="appl.oldvisaissuedate" value="" />

    <!-- Refusal & SAARC -->
    <input type="radio" id="refuse_flag1" name="appl.refuse_flag" value="Y" />
    <input type="radio" id="refuse_flag2" name="appl.refuse_flag" value="N" />
    <textarea id="refuse_details" name="appl.refuse_details"></textarea>
    <input type="text" id="country_visited" name="appl.country_visited" value="" />
    <input type="radio" id="saarc_flag1" name="appl.saarc_flag" value="Y" />
    <input type="radio" id="saarc_flag2" name="appl.saarc_flag" value="N" />

    <!-- References -->
    <input type="text" id="nameofsponsor_ind" name="appl.nameofsponsor_ind" value="" />
    <input type="text" id="add1ofsponsor_ind" name="appl.add1ofsponsor_ind" value="" />
    <input type="text" id="add2ofsponsor_ind" name="appl.add2ofsponsor_ind" value="" />
    <input type="text" id="phoneofsponsor_ind" name="appl.phoneofsponsor_ind" value="" />
    <input type="text" id="nameofsponsor_msn" name="appl.nameofsponsor_msn" value="" />
    <input type="text" id="add1ofsponsor_msn" name="appl.add1ofsponsor_msn" value="" />
    <input type="text" id="add2ofsponsor_msn" name="appl.add2ofsponsor_msn" value="" />
    <input type="text" id="phoneofsponsor_msn" name="appl.phoneofsponsor_msn" value="" />

    <!-- Action Buttons -->
    <button type="submit" id="continue" name="continue">Save and Continue</button>
    <button type="button" id="exit" name="exit">Save and Temporarily Exit</button>
  </form>
</body>
</html>
`

/**
 * Minimal observed/verified DOM fixture for Bangladesh Indian Visa Additional Questions Page:
 * https://indianvisa-bangladesh.nic.in/visa/AdditionalQuestions
 */
export const BANGLADESH_ADDITIONAL_QUESTIONS_FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Online Visa Application - Additional Questions (Bangladesh Portal)</title></head>
<body>
  <form id="questions_form" action="/visa/AdditionalQuestions" method="post">
    <!-- Questions 1-6 -->
    <input type="radio" id="question_yes_1" name="q1" value="Y" />
    <input type="radio" id="question_no_1" name="q1" value="N" />
    <input type="text" id="answer_1" name="ans1" value="" />

    <input type="radio" id="question_yes_2" name="q2" value="Y" />
    <input type="radio" id="question_no_2" name="q2" value="N" />
    <input type="text" id="answer_2" name="ans2" value="" />

    <input type="radio" id="question_yes_3" name="q3" value="Y" />
    <input type="radio" id="question_no_3" name="q3" value="N" />
    <input type="text" id="answer_3" name="ans3" value="" />

    <input type="radio" id="question_yes_4" name="q4" value="Y" />
    <input type="radio" id="question_no_4" name="q4" value="N" />
    <input type="text" id="answer_4" name="ans4" value="" />

    <input type="radio" id="question_yes_5" name="q5" value="Y" />
    <input type="radio" id="question_no_5" name="q5" value="N" />
    <input type="text" id="answer_5" name="ans5" value="" />

    <input type="radio" id="question_yes_6" name="q6" value="Y" />
    <input type="radio" id="question_no_6" name="q6" value="N" />
    <input type="text" id="answer_6" name="ans6" value="" />

    <!-- Declaration -->
    <input type="checkbox" id="verifyQuestions" name="verifyQuestions" />

    <!-- Action Buttons -->
    <button type="submit" id="continue" name="continue">Save and Continue</button>
    <button type="button" id="exit" name="exit">Exit</button>
  </form>
</body>
</html>
`

/**
 * Minimal observed/verified DOM fixture for Bangladesh Indian Visa Photo Upload Page:
 * https://indianvisa-bangladesh.nic.in/visa/PhotoUpload
 */
export const BANGLADESH_PHOTO_UPLOAD_FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Online Visa Application - Photo Upload (Bangladesh Portal)</title></head>
<body>
  <form id="photo_form" action="/visa/PhotoUpload" method="post" enctype="multipart/form-data">
    <input type="file" id="photo" name="photo" />
    <button type="submit" id="upload" name="upload">Upload Photo</button>
    <button type="submit" id="continue" name="continue">Save and Continue</button>
    <button type="button" id="exit" name="exit">Exit</button>
  </form>
</body>
</html>
`


