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
