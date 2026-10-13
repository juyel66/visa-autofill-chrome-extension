import { executeAutofill } from '../src/core/autofill/autofillEngine'
import { BANGLADESH_REGISTRATION_MAPPINGS } from '../src/countries/india/mappings/bangladesh/registration'
import type { ApplicantProfile } from '../src/core/applicant/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`)
}

export async function runRealPortalRegistrationAutofillTests() {
  console.log('=== RUNNING REAL PORTAL REGISTRATION AUTOFILL TESTS ===')

  // The EXACT HTML provided by the user from the real Indian visa application portal
  const userPortalHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="form_container">
          <div class="row">
            <div class="col-1 mandatory" title="Country/Region you are applying visa from">Country/Region you are applying visa from</div>
            <div class="col-2">
              <select name="appl.countryname" id="countryname_id" class="" onchange="change_pia($(this).val(), &quot;missioncode_id&quot;)">
                <option value="">Select country</option>
                <option value="BGD">BANGLADESH</option>
              </select>
            </div>
            <div class="col-3"></div>
          </div>
          <div class="row">
            <div class="col-1 mandatory" title="Indian Mission/Office">Indian Mission/Office</div>
            <div class="col-2">
              <select name="appl.missioncode" id="missioncode_id" onchange="get_nationality($(this).val())">
                <option value="">Select Mission</option>
                <option value="BGDC">BANGLADESH-CHITTAGONG</option>
                <option value="BGDD">BANGLADESH-DHAKA</option>
                <option value="BGDK">BANGLADESH-KHULNA</option>
                <option value="BGDR">BANGLADESH-RAJSHAHI</option>
                <option value="BGDS">BANGLADESH-SYLHET</option>
              </select>
            </div>
            <div class="col-3"></div>
          </div>
          <div class="row">
            <div class="col-1 mandatory" id="appl_nationality" title="Nationality/Region">Nationality/Region</div>
            <div class="col-2">
              <select name="appl.nationality" id="nationality_id" onchange="fetchVisaServiceNew($('#missioncode_id').val(), 1, $('#nationality_id').val())">
                <option value="">Select Nationality</option>
                <option value="BGD">BANGLADESH</option>
              </select>
            </div>
            <div class="col-3"></div>
          </div>

          <div class="row">
            <div class="col-1 mandatory" title="Date of Birth" id="appl_dob">Date of Birth</div>
            <div class="col-2">
              <input name="appl.birthdate" type="text" size="10" id="dob_id" value="" class="hasDatepicker">
            </div>
            <div class="col-3" id="dd_mm_yy_1" title="(DD/MM/YYYY)">(DD/MM/YYYY)</div>
          </div>
          <div class="row">
            <div class="col-1 mandatory" title="Email ID" id="appl_email_id">Email ID</div>
            <div class="col-2">
              <input name="appl.email" type="text" size="50" maxlength="50" value="" id="email_id">
            </div>
            <div class="col-3"></div>
          </div>
          <div class="row">
            <div class="col-1 mandatory" title="Re-enter Email" id="re_email">Re-enter Email ID</div>
            <div class="col-2">
              <input name="appl.email_re" maxlength="50" value="" type="text" size="50" id="email_re_id">
            </div>
            <div class="col-3"></div>
          </div>
          <div class="row">
            <div class="col-1 mandatory" title="Expected Date of Arrival" id="expected_arrival_date">Expected Date of Arrival</div>
            <div class="col-2">
              <input name="appl.journeydate" type="text" size="10" id="jouryney_id" value="" class="hasDatepicker">
            </div>
            <div class="col-3" id="dd_mm_yy_2" title="(DD/MM/YYYY)">(DD/MM/YYYY)</div>
          </div>

          <!-- start purpose changes -->
          <div class="row" id="purpose_div_id" style="display:none;">
            <div class="col-31 mandatory">Visiting India for</div>
            <div class="col-32">
              <select class="chosen-select purpose_drp" id="visaPurposeDropdown" name="appl.purpose" data-placeholder="Select purpose.." onchange="visit_purpose($(this).val())" style="display: none;">
                <option value="">Select Purpose</option>
                <option value="537" data-service-id="1">
                  BUSINESS VISA (B1) -  FOR ALL BUSINESS ACTIVITIES [OTHER THAN THOSE COVERED BY B-2, B-3 AND B-4 VISAS
                </option>
                <option value="544" data-service-id="3">
                  TOURIST VISA (T1) -  FOR TOURISM RECREATION, SIGHTSEEING CASUAL VISIT TO MEET FRIENDS OR RELATIVES, ATTENDING A SHORT TERM YOGA PROGRAMME, SHORT DURATION MEDICAL TREATMENT (INCLUDING TREATMENT UNDER AYUSH SYSTEMS), SHORT TERM COURSES ON LOCAL LANGUAGES, MUSIC, DANCE , ARTS AND CRAFTS, COOKING, MEDICINE ETC. WHICH SHOULD NOT BE A FORMAL OR STRUCTURED COURSE/PROGRAMME (COURSE NOT EXCEEDING 6 MONTHS DURATION AND NOT ISSUED WITH A QUALIFYING CERTIFICATE/DIPLOMA ETC.) AND VOLUNTARY WORK OF SHORT DURATION( FOR A MAXIMUM PERIOD OF ONE MONTH, WHICH DO NOT INVOLVE ANY MONETARY PAYMENT OR CONSIDERATION OF ANY KIND IN RETURN ETC. AND NO OTHER PURPOSE/ACTIVITY.
                </option>
                <option value="545" data-service-id="16">
                  MEDICAL VISA (M1) -  FOR FOREIGN NATIONALS COMING FOR MEDICAL TREATMENT (OTHER THAN THOSE UNDER AYUSH  SYSTEMS).
                </option>
                <option value="540" data-service-id="2">
                  STUDENT VISA (S1) -  FOR HIGHER EDUCATION(INCLUDING IN SOUTH ASIAN UNIVERSITY AND NALANDA UNIVERSITY)...
                </option>
              </select>
              <div class="chosen-container chosen-container-single" title="" id="visaPurposeDropdown_chosen" style="width: 600px;">
                <a class="chosen-single">
                  <span>Select Purpose</span>
                  <div><b></b></div>
                </a>
                <div class="chosen-drop">
                  <div class="chosen-search">
                    <input class="chosen-search-input" type="text" autocomplete="off">
                  </div>
                  <ul class="chosen-results">
                    <li class="active-result" data-option-array-index="1">BUSINESS VISA (B1)...</li>
                    <li class="active-result" data-option-array-index="2">TOURIST VISA (T1)...</li>
                    <li class="active-result" data-option-array-index="3">MEDICAL VISA (M1)...</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="col-33"></div>
          </div>

          <div class="row" id="purpose_desc_row_id" style="display: none;">
            <div class="col-31">Purpose</div>
            <div class="col-32" id="purpose_desc_id" style="width: 600px;"></div>
            <div class="col-33"></div>
          </div>

          <div class="row" style="display: none;" id="visit_service_div_id">
            <div class="col-31">Visa Service</div>
            <div class="col-32" id="visaServiceID" style="width: 600px;"></div>
            <div class="col-33"></div>
          </div>
          <!-- end purpose changes -->         

          <div class="row">
            <div class="col-1"></div>
            <div class="col-2"> <img src="captcha" id="capt" style="display: inline"></div>
            <div class="col-3"><a href="#" onclick="return refreshCaptcha();"><img src="images/refresh.png"></a></div>
          </div>

          <div class="row">
            <div class="col-1 mandatory" id="enter_code" title="Please enter above text">Please enter above text</div>
            <div class="col-2"><input type="text" name="captcha" id="captcha" maxlength="6"></div>
            <div class="col-3"></div>
          </div>
          <div class="row text_center">
            <input name="submit_registration" type="submit" class="btn btn-primary" value="Continue">
          </div>
        </div>
      </body>
    </html>
  `

  document.body.innerHTML = userPortalHtml

  const applicant: ApplicantProfile = {
    applicantId: 'app_user_test_1',
    personalInfo: {
      givenNames: 'MD JUYEL',
      surname: 'RANA',
      nationality: 'BANGLADESH',
      dateOfBirth: '1995-10-15',
    },
    presentAddress: {
      country: 'BANGLADESH',
      villageTownCity: 'DHAKA',
    },
    registration: {
      indianMission: 'BANGLADESH-DHAKA',
    },
    contact: {
      email: 'juyel.rana@example.com',
    },
    travel: {
      intendedArrivalDate: '2026-11-20',
      purposeOfVisit: 'TOURISM',
    },
  }

  const result = await executeAutofill({
    mappings: BANGLADESH_REGISTRATION_MAPPINGS,
    applicant,
    options: { policy: 'overwrite' },
  })

  console.log(`Filled fields: ${result.filledFields}`)
  console.log(`Failed fields: ${result.failedFields}`)
  console.log(JSON.stringify(result.results, null, 2))

  const countrySel = document.getElementById('countryname_id') as HTMLSelectElement
  const missionSel = document.getElementById('missioncode_id') as HTMLSelectElement
  const nationalitySel = document.getElementById('nationality_id') as HTMLSelectElement
  const dobInput = document.getElementById('dob_id') as HTMLInputElement
  const emailInput = document.getElementById('email_id') as HTMLInputElement
  const emailReInput = document.getElementById('email_re_id') as HTMLInputElement
  const journeyInput = document.getElementById('jouryney_id') as HTMLInputElement
  const purposeSel = document.getElementById('visaPurposeDropdown') as HTMLSelectElement
  const captchaInput = document.getElementById('captcha') as HTMLInputElement

  // Assertions for all 8 registration fields
  assert(countrySel.value === 'BGD', `Country selected must be BGD (got "${countrySel.value}")`)
  console.log('✓ PASS: Country selected: ' + countrySel.value)

  assert(missionSel.value === 'BGDD', `Mission selected must be BGDD (got "${missionSel.value}")`)
  console.log('✓ PASS: Mission selected: ' + missionSel.value)

  assert(nationalitySel.value === 'BGD', `Nationality selected must be BGD (got "${nationalitySel.value}")`)
  console.log('✓ PASS: Nationality selected: ' + nationalitySel.value)

  assert(dobInput.value === '15/10/1995', `DOB must be formatted as DD/MM/YYYY 15/10/1995 (got "${dobInput.value}")`)
  console.log('✓ PASS: DOB filled: ' + dobInput.value)

  assert(emailInput.value === 'juyel.rana@example.com', `Email must be filled (got "${emailInput.value}")`)
  console.log('✓ PASS: Email filled: ' + emailInput.value)

  assert(emailReInput.value === 'juyel.rana@example.com', `Email confirmation must be filled (got "${emailReInput.value}")`)
  console.log('✓ PASS: Re-enter Email filled: ' + emailReInput.value)

  assert(journeyInput.value === '20/11/2026', `Expected Arrival Date must be DD/MM/YYYY 20/11/2026 (got "${journeyInput.value}")`)
  console.log('✓ PASS: Expected arrival date filled: ' + journeyInput.value)

  assert(purposeSel.value === '544', `Visiting India for must select TOURIST VISA 544 (got "${purposeSel.value}")`)
  console.log('✓ PASS: Purpose dropdown selected: ' + purposeSel.value)

  // Assert Chosen UI is updated
  const chosenSpan = document.querySelector('#visaPurposeDropdown_chosen .chosen-single span')
  assert(Boolean(chosenSpan && chosenSpan.textContent?.includes('TOURIST VISA (T1)')), 'Chosen container must display TOURIST VISA (T1)')
  console.log('✓ PASS: Chosen container span updated: ' + chosenSpan?.textContent?.slice(0, 30) + '...')

  // Assert unhidden rows
  const purposeDiv = document.getElementById('purpose_div_id')
  assert(purposeDiv?.style.display === 'block', 'purpose_div_id row must be visible (display: block)')
  console.log('✓ PASS: purpose_div_id row unhidden')

  const descRow = document.getElementById('purpose_desc_row_id')
  assert(descRow?.style.display === 'block', 'purpose_desc_row_id must be visible')
  console.log('✓ PASS: purpose_desc_row_id unhidden')

  const serviceEl = document.getElementById('visaServiceID')
  assert(Boolean(serviceEl && serviceEl.textContent?.includes('TOURIST VISA')), 'visaServiceID must contain TOURIST VISA')
  console.log('✓ PASS: visaServiceID populated: ' + serviceEl?.textContent)

  // Assert Captcha is strictly manual and left empty
  assert(captchaInput.value === '', 'Captcha MUST remain empty for manual user entry')
  console.log('✓ PASS: Captcha remains empty for manual entry')

  console.log('\n==================================================')
  console.log('ALL REAL PORTAL REGISTRATION AUTOFILL TESTS PASSED!')
  console.log('==================================================\n')
}

// Execute directly if run via tsx
runRealPortalRegistrationAutofillTests()
