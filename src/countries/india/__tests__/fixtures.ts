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
