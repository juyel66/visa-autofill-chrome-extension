import { extractApplicantDataFromDocuments } from '../../../core/extraction/data/applicantDataExtractor'
import { applyExtractionToApplicant } from '../../../core/extraction/data/extractionMapper'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import { BANGLADESH_VISA_DETAILS_MAPPINGS } from '../mappings/bangladesh/visaDetails'
import { BANGLADESH_VISA_DETAILS_FIXTURE_HTML } from './fixtures'
import type { ApplicantProfile } from '../../../core/applicant/types'

export async function runTravelDetailsExtractionTests(): Promise<{ passed: boolean; testCount: number; failures: string[] }> {
  const failures: string[] = []
  let testCount = 0

  function createEmptyProfile(): ApplicantProfile {
    return {
      applicantId: 'test-applicant-travel-051',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }
  }

  // -------------------------------------------------------------
  // FALLBACK CASE A: Baseline passport only (No travel/visa docs)
  // -------------------------------------------------------------
  testCount++
  try {
    const passportDoc = {
      id: 'doc-pass-1',
      documentType: 'passport',
      fileName: 'passport.pdf',
      text: 'P<BGDRAHMAN<<MD<JUYEL<<<<<<<<<<<<<<<<<<<<<<<\nA123456788BGD9005156M3005154<<<<<<<<<<<<<<02',
    }
    const extractedA = extractApplicantDataFromDocuments([passportDoc])
    const emptyProfile = createEmptyProfile()
    const mappedProfileA = applyExtractionToApplicant(emptyProfile, extractedA)

    if (mappedProfileA.personalInfo?.surname !== 'RAHMAN') {
      failures.push("Case A Failed: Passport surname 'RAHMAN' not extracted.")
    }
    if (mappedProfileA.travel !== undefined) {
      failures.push(`Case A Failed: travel object should be undefined when no travel docs exist, got: ${JSON.stringify(mappedProfileA.travel)}`)
    }
    if (mappedProfileA.previousVisa !== undefined) {
      failures.push(`Case A Failed: previousVisa object should be undefined when no previous visa doc exists, got: ${JSON.stringify(mappedProfileA.previousVisa)}`)
    }
    if (mappedProfileA.reference !== undefined) {
      failures.push(`Case A Failed: reference object should be undefined when no reference doc exists, got: ${JSON.stringify(mappedProfileA.reference)}`)
    }
    if (mappedProfileA.sponsorMission !== undefined) {
      failures.push(`Case A Failed: sponsorMission object should be undefined, got: ${JSON.stringify(mappedProfileA.sponsorMission)}`)
    }

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const journeyInput = document.getElementById('jouryney_id') as HTMLInputElement
      const oldVisaInput = document.getElementById('old_visa_no') as HTMLInputElement
      const sponsorInput = document.getElementById('nameofsponsor_ind') as HTMLInputElement

      journeyInput.value = 'USER_PREFILLED_DATE'
      oldVisaInput.value = 'USER_PREFILLED_VISA'
      sponsorInput.value = 'USER_PREFILLED_SPONSOR'

      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: mappedProfileA,
      })

      if (journeyInput.value !== 'USER_PREFILLED_DATE') {
        failures.push(`Case A Failed: Pre-filled journey date was mutated without document data. Got '${journeyInput.value}'`)
      }
      if (oldVisaInput.value !== 'USER_PREFILLED_VISA') {
        failures.push(`Case A Failed: Pre-filled old visa no was mutated. Got '${oldVisaInput.value}'`)
      }
      if (sponsorInput.value !== 'USER_PREFILLED_SPONSOR') {
        failures.push(`Case A Failed: Pre-filled sponsor was mutated. Got '${sponsorInput.value}'`)
      }
    }
  } catch (err: unknown) {
    failures.push(`Case A Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // FALLBACK CASE B: Valid flight itinerary with departure date and arrival port
  // -------------------------------------------------------------
  testCount++
  try {
    const flightDoc = {
      id: 'doc-flight-1',
      documentType: 'flight_itinerary',
      fileName: 'flight_ticket.pdf',
      text: `
        ELECTRONIC TICKET RECEIPT
        BOOKING DATE: 10/08/2025
        ISSUE DATE: 12/08/2025
        FLIGHT NUMBER: BG 391
        DEPARTURE DATE: 25/11/2025
        PORT OF ARRIVAL: CHENNAI AIRPORT
        PORT OF EXIT: CHENNAI AIRPORT
        PASSENGER: RAHMAN / MD JUYEL
      `,
    }
    const extractedB = extractApplicantDataFromDocuments([flightDoc])
    const mappedProfileB = applyExtractionToApplicant(createEmptyProfile(), extractedB)

    if (mappedProfileB.travel?.intendedArrivalDate !== '2025-11-25') {
      failures.push(`Case B Failed: Expected intendedArrivalDate '2025-11-25', got '${mappedProfileB.travel?.intendedArrivalDate}'`)
    }
    if (mappedProfileB.travel?.entryPoint !== 'CHENNAI') {
      failures.push(`Case B Failed: Expected entryPoint 'CHENNAI', got '${mappedProfileB.travel?.entryPoint}'`)
    }
    if (mappedProfileB.travel?.exitPoint !== 'CHENNAI') {
      failures.push(`Case B Failed: Expected exitPoint 'CHENNAI', got '${mappedProfileB.travel?.exitPoint}'`)
    }
    if (mappedProfileB.previousVisa !== undefined) {
      failures.push('Case B Failed: previousVisa must remain undefined with only flight doc.')
    }
    if (mappedProfileB.reference !== undefined) {
      failures.push('Case B Failed: reference must remain undefined with only flight doc.')
    }

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const journeyInput = document.getElementById('jouryney_id') as HTMLInputElement
      const entrySelect = document.getElementById('entrypoint') as HTMLSelectElement
      const exitSelect = document.getElementById('exitpointprc') as HTMLSelectElement
      const oldVisaInput = document.getElementById('old_visa_no') as HTMLInputElement

      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: mappedProfileB,
      })

      if (journeyInput.value !== '25/11/2025') {
        failures.push(`Case B Failed: Expected #jouryney_id to be '25/11/2025', got '${journeyInput.value}'`)
      }
      if (entrySelect.value !== 'CHENNAI') {
        failures.push(`Case B Failed: Expected #entrypoint to be 'CHENNAI', got '${entrySelect.value}'`)
      }
      if (exitSelect.value !== 'CHENNAI') {
        failures.push(`Case B Failed: Expected #exitpointprc to be 'CHENNAI', got '${exitSelect.value}'`)
      }
      if (oldVisaInput.value !== '') {
        failures.push(`Case B Failed: Old visa number was unexpectedly filled: '${oldVisaInput.value}'`)
      }
    }
  } catch (err: unknown) {
    failures.push(`Case B Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // FALLBACK CASE C: Hotel booking / Invitation letter
  // -------------------------------------------------------------
  testCount++
  try {
    const hotelDoc = {
      id: 'doc-hotel-1',
      documentType: 'hotel_booking',
      fileName: 'hotel_confirmation.pdf',
      text: `
        HOTEL BOOKING CONFIRMATION
        HOTEL NAME: TAJ MAHAL HOTEL NEW DELHI
        HOTEL ADDRESS: NUMBER 1 MANSINGH ROAD, NEW DELHI
        PHONE NUMBER: +91 11 6656 9772
        GUEST NAME: MD JUYEL RAHMAN
        CHECK-IN: 2025-12-01
        CHECK-OUT: 2025-12-10
      `,
    }
    const extractedC = extractApplicantDataFromDocuments([hotelDoc])
    const mappedProfileC = applyExtractionToApplicant(createEmptyProfile(), extractedC)

    if (mappedProfileC.reference?.name !== 'TAJ MAHAL HOTEL NEW DELHI') {
      failures.push(`Case C Failed: Expected reference.name 'TAJ MAHAL HOTEL NEW DELHI', got '${mappedProfileC.reference?.name}'`)
    }
    if (!mappedProfileC.reference?.addressLine1?.includes('1 MANSINGH ROAD')) {
      failures.push(`Case C Failed: Expected reference.addressLine1 to contain '1 MANSINGH ROAD', got '${mappedProfileC.reference?.addressLine1}'`)
    }
    if (mappedProfileC.reference?.phone !== '+91 11 6656 9772') {
      failures.push(`Case C Failed: Expected reference.phone '+91 11 6656 9772', got '${mappedProfileC.reference?.phone}'`)
    }
    if (mappedProfileC.previousVisa !== undefined) {
      failures.push('Case C Failed: previousVisa must remain undefined with only hotel doc.')
    }
    // Strict Invariant: Check-in/check-out must NOT be inferred as visa duration!
    if (mappedProfileC.travel?.duration !== undefined) {
      failures.push(`Case C Failed: Hotel stay must NOT be inferred as visa duration. Got: '${mappedProfileC.travel?.duration}'`)
    }

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const sponsorName = document.getElementById('nameofsponsor_ind') as HTMLInputElement
      const sponsorPhone = document.getElementById('phoneofsponsor_ind') as HTMLInputElement
      const durationInput = document.getElementById('duration') as HTMLInputElement

      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: mappedProfileC,
      })

      if (sponsorName.value !== 'TAJ MAHAL HOTEL NEW DELHI') {
        failures.push(`Case C Failed: Expected #nameofsponsor_ind to be 'TAJ MAHAL HOTEL NEW DELHI', got '${sponsorName.value}'`)
      }
      if (sponsorPhone.value !== '+91 11 6656 9772') {
        failures.push(`Case C Failed: Expected #phoneofsponsor_ind to be '+91 11 6656 9772', got '${sponsorPhone.value}'`)
      }
      if (durationInput.value !== '') {
        failures.push(`Case C Failed: #duration was unexpectedly filled: '${durationInput.value}'`)
      }
    }
  } catch (err: unknown) {
    failures.push(`Case C Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // FALLBACK CASE D: Previous visa sticker
  // -------------------------------------------------------------
  testCount++
  try {
    const visaStickerDoc = {
      id: 'doc-visa-1',
      documentType: 'previous_visa',
      fileName: 'old_indian_visa.pdf',
      text: `
        GOVERNMENT OF INDIA - VISA
        VISA NUMBER: V1234567
        TYPE OF VISA: TOURIST VISA
        PLACE OF ISSUE: DHAKA
        DATE OF ISSUE: 15/03/2023
        VALID UNTIL: 14/03/2024
        ENTRIES: MULTIPLE
        PREVIOUS VISITED ADDRESS: HOTEL HINDUSTAN INTERNATIONAL, 235/1 AJC BOSE ROAD, KOLKATA
      `,
    }
    const extractedD = extractApplicantDataFromDocuments([visaStickerDoc])
    const mappedProfileD = applyExtractionToApplicant(createEmptyProfile(), extractedD)

    if (mappedProfileD.previousVisa?.visaNumber !== 'V1234567') {
      failures.push(`Case D Failed: Expected previousVisa.visaNumber 'V1234567', got '${mappedProfileD.previousVisa?.visaNumber}'`)
    }
    if (mappedProfileD.previousVisa?.visaType !== 'TOURIST') {
      failures.push(`Case D Failed: Expected previousVisa.visaType 'TOURIST', got '${mappedProfileD.previousVisa?.visaType}'`)
    }
    if (mappedProfileD.previousVisa?.placeOfIssue !== 'DHAKA') {
      failures.push(`Case D Failed: Expected previousVisa.placeOfIssue 'DHAKA', got '${mappedProfileD.previousVisa?.placeOfIssue}'`)
    }
    if (mappedProfileD.previousVisa?.dateOfIssue !== '2023-03-15') {
      failures.push(`Case D Failed: Expected previousVisa.dateOfIssue '2023-03-15', got '${mappedProfileD.previousVisa?.dateOfIssue}'`)
    }
    if (!mappedProfileD.previousVisa?.visitedAddress1?.includes('HOTEL HINDUSTAN')) {
      failures.push(`Case D Failed: Expected previousVisa.visitedAddress1 to contain 'HOTEL HINDUSTAN', got '${mappedProfileD.previousVisa?.visitedAddress1}'`)
    }
    if (mappedProfileD.previousVisa?.hasPreviousVisa !== true) {
      failures.push(`Case D Failed: Expected previousVisa.hasPreviousVisa to be true, got ${mappedProfileD.previousVisa?.hasPreviousVisa}`)
    }

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const visaNoInput = document.getElementById('old_visa_no') as HTMLInputElement
      const visaTypeSelect = document.getElementById('old_visa_type_id') as HTMLSelectElement
      const issuePlaceInput = document.getElementById('oldvisaissueplace') as HTMLInputElement
      const issueDateInput = document.getElementById('oldvisaissuedate') as HTMLInputElement
      const prevAdd1Input = document.getElementById('prv_visit_add1') as HTMLInputElement
      const refuseFlagYes = document.getElementById('refuse_flag1') as HTMLInputElement
      const refuseFlagNo = document.getElementById('refuse_flag2') as HTMLInputElement

      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: mappedProfileD,
      })

      if (visaNoInput.value !== 'V1234567') {
        failures.push(`Case D Failed: Expected #old_visa_no 'V1234567', got '${visaNoInput.value}'`)
      }
      if (visaTypeSelect.value !== 'TOURIST') {
        failures.push(`Case D Failed: Expected #old_visa_type_id 'TOURIST', got '${visaTypeSelect.value}'`)
      }
      if (issuePlaceInput.value !== 'DHAKA') {
        failures.push(`Case D Failed: Expected #oldvisaissueplace 'DHAKA', got '${issuePlaceInput.value}'`)
      }
      if (issueDateInput.value !== '15/03/2023') {
        failures.push(`Case D Failed: Expected #oldvisaissuedate '15/03/2023', got '${issueDateInput.value}'`)
      }
      if (!prevAdd1Input.value.includes('HOTEL HINDUSTAN')) {
        failures.push(`Case D Failed: Expected #prv_visit_add1 to contain 'HOTEL HINDUSTAN', got '${prevAdd1Input.value}'`)
      }
      // Refusal radios must remain completely untouched!
      if (refuseFlagYes.checked || refuseFlagNo.checked) {
        failures.push('Case D Failed: Refusal flag radio buttons were touched during autofill.')
      }
    }
  } catch (err: unknown) {
    failures.push(`Case D Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // FALLBACK CASE E: Combined multi-document package
  // -------------------------------------------------------------
  testCount++
  try {
    const flightDoc = {
      id: 'doc-flight-e',
      documentType: 'flight_itinerary',
      fileName: 'itinerary.pdf',
      text: 'TRAVEL DATE: 10/12/2025\nPORT OF ARRIVAL: HARIDASPUR\nPORT OF EXIT: HARIDASPUR',
    }
    const hotelDoc = {
      id: 'doc-hotel-e',
      documentType: 'invitation_letter',
      fileName: 'invite.pdf',
      text: 'SPONSOR IN INDIA: DR ANISUR RAHMAN\nADDRESS: 14/B PARK STREET, KOLKATA, WEST BENGAL\nPHONE: 9830012345',
    }
    const visaDoc = {
      id: 'doc-visa-e',
      documentType: 'previous_visa',
      fileName: 'visa_sticker.pdf',
      text: 'VISA NUMBER: IN98765432\nVISA TYPE: MEDICAL\nPLACE OF ISSUE: CHITTAGONG\nDATE OF ISSUE: 2024-01-10\nPREVIOUS ADDRESS: APOLLO HOSPITALS, CHENNAI',
    }
    const homeRefDoc = {
      id: 'doc-home-ref-e',
      documentType: 'reference_doc',
      fileName: 'local_ref.pdf',
      text: 'REFERENCE IN BANGLADESH: PROFESSOR KHALED HASAN\nADDRESS: HOUSE 12, ROAD 5, DHANMONDI, DHAKA\nPHONE: 01711223344',
    }
    const countriesDoc = {
      id: 'doc-countries-e',
      documentType: 'passport_stamps',
      fileName: 'stamps.pdf',
      text: 'COUNTRIES VISITED: THAILAND, MALAYSIA, NEPAL, BHUTAN',
    }

    const extractedE = extractApplicantDataFromDocuments([flightDoc, hotelDoc, visaDoc, homeRefDoc, countriesDoc])
    const mappedProfileE = applyExtractionToApplicant(createEmptyProfile(), extractedE)

    // Verify all mapped fields
    if (mappedProfileE.travel?.intendedArrivalDate !== '2025-12-10') failures.push('Case E: intendedArrivalDate mismatch')
    if (mappedProfileE.travel?.entryPoint !== 'HARIDASPUR') failures.push('Case E: entryPoint mismatch')
    if (mappedProfileE.travel?.exitPoint !== 'HARIDASPUR') failures.push('Case E: exitPoint mismatch')
    if (mappedProfileE.reference?.name !== 'DR ANISUR RAHMAN') failures.push('Case E: reference.name mismatch')
    if (mappedProfileE.reference?.phone !== '9830012345') failures.push('Case E: reference.phone mismatch')
    if (mappedProfileE.previousVisa?.visaNumber !== 'IN98765432') failures.push('Case E: previousVisa.visaNumber mismatch')
    if (mappedProfileE.previousVisa?.visaType !== 'MEDICAL') failures.push('Case E: previousVisa.visaType mismatch')
    if (mappedProfileE.previousVisa?.placeOfIssue !== 'CHITTAGONG') failures.push('Case E: previousVisa.placeOfIssue mismatch')
    if (mappedProfileE.previousVisa?.dateOfIssue !== '2024-01-10') failures.push('Case E: previousVisa.dateOfIssue mismatch')
    if (mappedProfileE.sponsorMission?.name !== 'PROFESSOR KHALED HASAN') failures.push('Case E: sponsorMission.name mismatch')
    if (mappedProfileE.sponsorMission?.phone !== '01711223344') failures.push('Case E: sponsorMission.phone mismatch')
    if (!mappedProfileE.travel?.countriesVisited?.includes('THAILAND')) failures.push('Case E: countriesVisited mismatch')
    if (mappedProfileE.travel?.visitedSaarc !== true) failures.push('Case E: visitedSaarc should be true when Nepal/Bhutan visited')

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: mappedProfileE,
      })

      const journeyInput = document.getElementById('jouryney_id') as HTMLInputElement
      const sponsorName = document.getElementById('nameofsponsor_ind') as HTMLInputElement
      const msnName = document.getElementById('nameofsponsor_msn') as HTMLInputElement
      const msnPhone = document.getElementById('phoneofsponsor_msn') as HTMLInputElement
      const visaNo = document.getElementById('old_visa_no') as HTMLInputElement
      const saarcYes = document.getElementById('saarc_flag1') as HTMLInputElement

      if (journeyInput.value !== '10/12/2025') failures.push(`Case E DOM: #jouryney_id got '${journeyInput.value}'`)
      if (sponsorName.value !== 'DR ANISUR RAHMAN') failures.push(`Case E DOM: #nameofsponsor_ind got '${sponsorName.value}'`)
      if (msnName.value !== 'PROFESSOR KHALED HASAN') failures.push(`Case E DOM: #nameofsponsor_msn got '${msnName.value}'`)
      if (msnPhone.value !== '01711223344') failures.push(`Case E DOM: #phoneofsponsor_msn got '${msnPhone.value}'`)
      if (visaNo.value !== 'IN98765432') failures.push(`Case E DOM: #old_visa_no got '${visaNo.value}'`)
      if (!saarcYes.checked) failures.push('Case E DOM: #saarc_flag1 (Yes) was not checked for SAARC countries visited')
    }
  } catch (err: unknown) {
    failures.push(`Case E Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // STRICT NO-INFERENCE INVARIANT TESTS
  // -------------------------------------------------------------
  testCount++
  try {
    // 1. Duration must NOT be inferred from flight dates or hotel booking stay length
    const hotelWithDates = {
      id: 'doc-hotel-dates',
      documentType: 'hotel_booking',
      fileName: 'hotel.pdf',
      text: 'HOTEL STAY: CHECK-IN 2025-01-01 CHECK-OUT 2025-01-15 (14 DAYS)',
    }
    const extractedStay = extractApplicantDataFromDocuments([hotelWithDates])
    if (extractedStay.travel?.duration !== undefined) {
      failures.push(`No-Inference 1 Failed: Duration was inferred from hotel stay length: '${extractedStay.travel?.duration?.value}'`)
    }

    // 2. Visa entries must NOT be guessed from visa type
    const touristVisaDoc = {
      id: 'doc-tourist',
      documentType: 'invitation',
      fileName: 'tourist_plan.pdf',
      text: 'VISITING INDIA FOR TOURISM IN GOA',
    }
    const extractedTourist = extractApplicantDataFromDocuments([touristVisaDoc])
    if (extractedTourist.travel?.visaEntryType !== undefined) {
      failures.push(`No-Inference 2 Failed: Visa entry type was guessed: '${extractedTourist.travel?.visaEntryType?.value}'`)
    }

    // 3. Port of entry must NOT be inferred from sponsor/hotel city
    const hotelInDelhi = {
      id: 'doc-delhi-hotel',
      documentType: 'hotel_booking',
      fileName: 'delhi_hotel.pdf',
      text: 'HOTEL LE MERIDIEN, CONNAUGHT PLACE, NEW DELHI',
    }
    const extractedDelhi = extractApplicantDataFromDocuments([hotelInDelhi])
    if (extractedDelhi.travel?.entryPoint !== undefined) {
      failures.push(`No-Inference 3 Failed: Entry point was inferred from hotel city: '${extractedDelhi.travel?.entryPoint?.value}'`)
    }

    // 4. Absence of previous visa doc must NOT set hasPreviousVisa to false
    const docOnlyPassport = {
      id: 'doc-pass-only',
      documentType: 'passport',
      fileName: 'passport.pdf',
      text: 'P<BGDRAHMAN<<MD<JUYEL<<<<<<<<<<<<<<<<<<<<<<<\nA123456788BGD9005156M3005154<<<<<<<<<<<<<<02',
    }
    const noVisaDocExtracted = extractApplicantDataFromDocuments([docOnlyPassport])
    if (noVisaDocExtracted.previousVisa?.hasPreviousVisa !== undefined) {
      failures.push(`No-Inference 4 Failed: Absence of visa doc resulted in explicit hasPreviousVisa: ${noVisaDocExtracted.previousVisa?.hasPreviousVisa?.value}`)
    }

    // 5. Absence of refusal document must NEVER populate refusal fields
    if (noVisaDocExtracted.previousVisa?.hasRefusal !== undefined || noVisaDocExtracted.previousVisa?.refusalDetails !== undefined) {
      failures.push('No-Inference 5 Failed: Refusal fields populated without refusal document.')
    }

    // 6. Applicant present address must NOT be inferred as Bangladesh reference
    const docWithPresentAdd = {
      id: 'doc-add',
      documentType: 'utility_bill',
      fileName: 'electricity_bill.pdf',
      text: 'PRESENT ADDRESS: HOUSE 10, ROAD 2, DHAKA 1205',
    }
    const extractedAdd = extractApplicantDataFromDocuments([docWithPresentAdd])
    if (extractedAdd.sponsorMission !== undefined) {
      failures.push(`No-Inference 6 Failed: Present address was inferred as sponsorMission: ${JSON.stringify(extractedAdd.sponsorMission)}`)
    }

    // 7. Employer details must NOT be inferred as Indian sponsor
    const docWithEmployer = {
      id: 'doc-emp',
      documentType: 'employment_letter',
      fileName: 'noc.pdf',
      text: 'EMPLOYER NAME: ABC TEXTILES LTD, DHAKA, BANGLADESH. PHONE: 01800000000',
    }
    const extractedEmp = extractApplicantDataFromDocuments([docWithEmployer])
    if (extractedEmp.sponsorIndia !== undefined) {
      failures.push(`No-Inference 7 Failed: Employer was inferred as sponsorIndia: ${JSON.stringify(extractedEmp.sponsorIndia)}`)
    }

    // 8. Arbitrary non-SAARC stamps must NOT set SAARC flag
    const docNonSaarc = {
      id: 'doc-non-saarc',
      documentType: 'passport_stamps',
      fileName: 'stamps.pdf',
      text: 'COUNTRIES VISITED: USA, UK, FRANCE, SINGAPORE, MALAYSIA',
    }
    const extractedNonSaarc = extractApplicantDataFromDocuments([docNonSaarc])
    if (extractedNonSaarc.travel?.visitedSaarc?.value === true) {
      failures.push('No-Inference 8 Failed: Non-SAARC countries incorrectly triggered visitedSaarc = true.')
    }
  } catch (err: unknown) {
    failures.push(`No-Inference Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // DATE SAFETY & PORT OPTION NORMALIZATION
  // -------------------------------------------------------------
  testCount++
  try {
    // Ticket issue date vs Departure Date
    const trickyTicket = {
      id: 'doc-tricky',
      documentType: 'flight_itinerary',
      fileName: 'ticket.pdf',
      text: `
        AIRLINE TICKET
        DATE OF BOOKING: 01/01/2026
        DATE OF ISSUE: 02/01/2026
        DEPARTURE DATE: 15/04/2026
        RETURN DATE: 25/04/2026
        DESTINATION: GEDE RAILWAY STATION
      `,
    }
    const extractedTricky = extractApplicantDataFromDocuments([trickyTicket])
    if (extractedTricky.travel?.intendedArrivalDate?.value !== '2026-04-15') {
      failures.push(`Date Safety Failed: Expected departure date '2026-04-15', got '${extractedTricky.travel?.intendedArrivalDate?.value}'`)
    }
    if (extractedTricky.travel?.entryPoint?.value !== 'GEEDE') {
      failures.push(`Port Normalization Failed: Expected 'GEEDE', got '${extractedTricky.travel?.entryPoint?.value}'`)
    }
  } catch (err: unknown) {
    failures.push(`Date Safety Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // DOCUMENT PRIORITY & CONFLICT RESOLUTION
  // -------------------------------------------------------------
  testCount++
  try {
    const ticketDoc = {
      id: 'doc-t1',
      documentType: 'flight_itinerary',
      fileName: 'ticket.pdf',
      text: 'DEPARTURE DATE: 2026-06-01\nPORT OF ARRIVAL: KOLKATA AIRPORT',
    }
    const genericTextDoc = {
      id: 'doc-g1',
      documentType: 'generic_document',
      fileName: 'notes.pdf',
      text: 'INTENDED ARRIVAL DATE: 2026-06-10\nPORT OF ARRIVAL: DELHI AIRPORT',
    }

    const merged = extractApplicantDataFromDocuments([genericTextDoc, ticketDoc])
    // Flight itinerary (confidence 90) must beat generic document (confidence 50)
    if (merged.travel?.intendedArrivalDate?.value !== '2026-06-01') {
      failures.push(`Priority Failed: Expected flight ticket date '2026-06-01', got '${merged.travel?.intendedArrivalDate?.value}'`)
    }
    if (merged.travel?.entryPoint?.value !== 'KOLKATA') {
      failures.push(`Priority Failed: Expected flight ticket port 'KOLKATA', got '${merged.travel?.entryPoint?.value}'`)
    }
  } catch (err: unknown) {
    failures.push(`Priority Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // DOM SAFETY: Technical buttons (#continue, #exit)
  // -------------------------------------------------------------
  testCount++
  try {
    const continueMapping = BANGLADESH_VISA_DETAILS_MAPPINGS.find(
      (m) => m.id === 'bd_visa_continue' || m.targetField === 'continue'
    )
    const exitMapping = BANGLADESH_VISA_DETAILS_MAPPINGS.find(
      (m) => m.id === 'bd_visa_exit' || m.targetField === 'exit'
    )
    if (continueMapping !== undefined || exitMapping !== undefined) {
      failures.push('DOM Safety Failed: Technical buttons (#continue, #exit) must NOT be present in autofill mappings.')
    }
  } catch (err: unknown) {
    failures.push(`DOM Safety Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // REGRESSION 1: VISA DURATION SAFETY (Prompt Section 5)
  // -------------------------------------------------------------
  testCount++
  try {
    // Flight: Arrival = 10 Jan, Departure = 20 Jan, No explicit visa duration -> duration untouched
    const flightStayOnly = {
      id: 'doc-flight-stay',
      documentType: 'flight_itinerary',
      fileName: 'flight.pdf',
      text: 'ARRIVAL DATE: 10/01/2026\nDEPARTURE DATE: 20/01/2026\nPORT OF ARRIVAL: DELHI AIRPORT',
    }
    const extractedFlightStay = extractApplicantDataFromDocuments([flightStayOnly])
    if (extractedFlightStay.travel?.duration !== undefined) {
      failures.push(`Regression 1a Failed: Visa duration was inferred from flight arrival/departure dates: '${extractedFlightStay.travel?.duration?.value}'`)
    }

    // Hotel: Check-in = 10 Jan, Check-out = 20 Jan, No explicit visa duration -> duration untouched
    const hotelStayOnly = {
      id: 'doc-hotel-stay',
      documentType: 'hotel_booking',
      fileName: 'hotel.pdf',
      text: 'CHECK-IN: 10/01/2026\nCHECK-OUT: 20/01/2026\nHOTEL: TAJ MAHAL HOTEL\nHOTEL PHONE: +91 11 23026162',
    }
    const extractedHotelStay = extractApplicantDataFromDocuments([hotelStayOnly])
    if (extractedHotelStay.travel?.duration !== undefined) {
      failures.push(`Regression 1b Failed: Visa duration was inferred from hotel check-in/out dates: '${extractedHotelStay.travel?.duration?.value}'`)
    }

    // Explicit Document: "Visa Duration: 30 Days" -> duration extracted
    const explicitDurationDoc1 = {
      id: 'doc-explicit-dur-1',
      documentType: 'visa_application',
      fileName: 'visa_form.pdf',
      text: 'VISA DURATION: 30 DAYS\nENTRIES REQUESTED: SINGLE',
    }
    const extractedDur1 = extractApplicantDataFromDocuments([explicitDurationDoc1])
    if (extractedDur1.travel?.duration?.value !== '30 DAYS') {
      failures.push(`Regression 1c Failed: Expected '30 DAYS', got '${extractedDur1.travel?.duration?.value}'`)
    }

    // Explicit Document: "Requested duration: 6 months" -> duration extracted
    const explicitDurationDoc2 = {
      id: 'doc-explicit-dur-2',
      documentType: 'invitation_letter',
      fileName: 'invite.pdf',
      text: 'REQUESTED DURATION: 6 MONTHS\nPURPOSE OF VISIT: BUSINESS MEETING',
    }
    const extractedDur2 = extractApplicantDataFromDocuments([explicitDurationDoc2])
    if (extractedDur2.travel?.duration?.value !== '6 MONTHS') {
      failures.push(`Regression 1d Failed: Expected '6 MONTHS', got '${extractedDur2.travel?.duration?.value}'`)
    }

    // DOM Autofill: Pre-filled duration remains untouched when document has flight dates only
    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const durationInput = document.getElementById('duration') as HTMLInputElement
      durationInput.value = 'USER_DURATION'

      const mappedStayProfile = applyExtractionToApplicant(createEmptyProfile(), extractedFlightStay)
      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: mappedStayProfile,
      })

      if (durationInput.value !== 'USER_DURATION') {
        failures.push(`Regression 1e Failed: Pre-filled duration was mutated by flight dates. Got '${durationInput.value}'`)
      }
    }
  } catch (err: unknown) {
    failures.push(`Regression 1 Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // REGRESSION 2: NUMBER OF ENTRIES SAFETY (Prompt Section 6)
  // -------------------------------------------------------------
  testCount++
  try {
    const docWithExplicitEntries = {
      id: 'doc-entries-1',
      documentType: 'visa_application',
      fileName: 'application.pdf',
      text: 'NUMBER OF ENTRIES: MULTIPLE\nVISA DURATION: 1 YEAR',
    }
    const extractedEntries = extractApplicantDataFromDocuments([docWithExplicitEntries])
    if (extractedEntries.travel?.visaEntryType?.value !== 'Multiple') {
      failures.push(`Regression 2a Failed: Expected 'Multiple', got '${extractedEntries.travel?.visaEntryType?.value}'`)
    }

    // Travel itinerary without explicit entry type must NOT infer entry count
    const docNoEntries = {
      id: 'doc-no-entries',
      documentType: 'flight_itinerary',
      fileName: 'itinerary.pdf',
      text: 'TRIP: ROUND TRIP DHAKA TO DELHI\nDEPARTURE DATE: 2026-03-01\nRETURN DATE: 2026-03-15',
    }
    const extractedNoEntries = extractApplicantDataFromDocuments([docNoEntries])
    if (extractedNoEntries.travel?.visaEntryType !== undefined) {
      failures.push(`Regression 2b Failed: Entry type was inferred from round-trip itinerary: '${extractedNoEntries.travel?.visaEntryType?.value}'`)
    }
  } catch (err: unknown) {
    failures.push(`Regression 2 Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // REGRESSION 3: ENTRY / EXIT PORT SAFETY (Prompt Section 7)
  // -------------------------------------------------------------
  testCount++
  try {
    // "Destination: Delhi" without airport/port -> do NOT invent airport
    const docCityOnly = {
      id: 'doc-city-only',
      documentType: 'travel_plan',
      fileName: 'plan.pdf',
      text: 'DESTINATION: DELHI\nPURPOSE OF VISIT: TOURISM',
    }
    const extractedCityOnly = extractApplicantDataFromDocuments([docCityOnly])
    if (extractedCityOnly.travel?.entryPoint !== undefined) {
      failures.push(`Regression 3a Failed: Port of entry was derived from raw city 'DESTINATION: DELHI': '${extractedCityOnly.travel?.entryPoint?.value}'`)
    }

    // "Arrival Airport: Indira Gandhi International Airport" -> normalized to DELHI
    const docWithAirport = {
      id: 'doc-airport',
      documentType: 'flight_itinerary',
      fileName: 'ticket.pdf',
      text: 'ARRIVAL AIRPORT: INDIRA GANDHI INTERNATIONAL AIRPORT\nRETURN AIRPORT: INDIRA GANDHI INTERNATIONAL AIRPORT',
    }
    const extractedAirport = extractApplicantDataFromDocuments([docWithAirport])
    if (extractedAirport.travel?.entryPoint?.value !== 'DELHI') {
      failures.push(`Regression 3b Failed: Expected 'DELHI', got '${extractedAirport.travel?.entryPoint?.value}'`)
    }
    if (extractedAirport.travel?.exitPoint?.value !== 'DELHI') {
      failures.push(`Regression 3c Failed: Expected 'DELHI', got '${extractedAirport.travel?.exitPoint?.value}'`)
    }

    // Unknown port not in portal select options -> leaves untouched
    const docUnknownPort = {
      id: 'doc-unknown-port',
      documentType: 'flight_itinerary',
      fileName: 'ticket.pdf',
      text: 'PORT OF ARRIVAL: UNKNOWN REMOTE AIRSTRIP XYZ',
    }
    const extractedUnknown = extractApplicantDataFromDocuments([docUnknownPort])
    if (extractedUnknown.travel?.entryPoint !== undefined) {
      failures.push(`Regression 3d Failed: Unknown port was populated: '${extractedUnknown.travel?.entryPoint?.value}'`)
    }
  } catch (err: unknown) {
    failures.push(`Regression 3 Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // REGRESSION 4: PREVIOUS VISA SAFETY (Prompt Section 8)
  // -------------------------------------------------------------
  testCount++
  try {
    // Case 1: Previous visa document with number only (missing type/place/date)
    const docVisaNoOnly = {
      id: 'doc-visa-no-only',
      documentType: 'previous_visa',
      fileName: 'visa_no.pdf',
      text: 'PREVIOUS VISA NUMBER: V99887766',
    }
    const extractedVisaNoOnly = extractApplicantDataFromDocuments([docVisaNoOnly])
    const profileVisaNoOnly = applyExtractionToApplicant(createEmptyProfile(), extractedVisaNoOnly)

    if (profileVisaNoOnly.previousVisa?.visaNumber !== 'V99887766') {
      failures.push(`Regression 4a Failed: Expected visaNumber 'V99887766', got '${profileVisaNoOnly.previousVisa?.visaNumber}'`)
    }
    if (profileVisaNoOnly.previousVisa?.visaType !== undefined) {
      failures.push(`Regression 4b Failed: visaType should be undefined, got '${profileVisaNoOnly.previousVisa?.visaType}'`)
    }
    if (profileVisaNoOnly.previousVisa?.placeOfIssue !== undefined) {
      failures.push(`Regression 4c Failed: placeOfIssue should be undefined, got '${profileVisaNoOnly.previousVisa?.placeOfIssue}'`)
    }
    if (profileVisaNoOnly.previousVisa?.dateOfIssue !== undefined) {
      failures.push(`Regression 4d Failed: dateOfIssue should be undefined, got '${profileVisaNoOnly.previousVisa?.dateOfIssue}'`)
    }

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const visaNoInput = document.getElementById('old_visa_no') as HTMLInputElement
      const visaTypeSelect = document.getElementById('old_visa_type_id') as HTMLSelectElement
      const issuePlaceInput = document.getElementById('oldvisaissueplace') as HTMLInputElement
      const issueDateInput = document.getElementById('oldvisaissuedate') as HTMLInputElement

      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: profileVisaNoOnly,
      })

      if (visaNoInput.value !== 'V99887766') {
        failures.push(`Regression 4e Failed: #old_visa_no was not filled. Got '${visaNoInput.value}'`)
      }
      if (visaTypeSelect.value !== '') {
        failures.push(`Regression 4f Failed: #old_visa_type_id was unexpectedly filled: '${visaTypeSelect.value}'`)
      }
      if (issuePlaceInput.value !== '') {
        failures.push(`Regression 4g Failed: #oldvisaissueplace was unexpectedly filled: '${issuePlaceInput.value}'`)
      }
      if (issueDateInput.value !== '') {
        failures.push(`Regression 4h Failed: #oldvisaissuedate was unexpectedly filled: '${issueDateInput.value}'`)
      }
    }

    // Case 2: No previous visa document -> DO NOT select NO automatically
    const docNoVisa = {
      id: 'doc-no-visa',
      documentType: 'passport',
      fileName: 'passport.pdf',
      text: 'P<BGDRAHMAN<<MD<JUYEL<<<<<<<<<<<<<<<<<<<<<<<\nA123456788BGD9005156M3005154<<<<<<<<<<<<<<02',
    }
    const extractedNoVisa = extractApplicantDataFromDocuments([docNoVisa])
    const profileNoVisa = applyExtractionToApplicant(createEmptyProfile(), extractedNoVisa)

    if (profileNoVisa.previousVisa !== undefined) {
      failures.push('Regression 4i Failed: previousVisa must be undefined when no previous visa doc exists.')
    }

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const oldVisaYes = document.getElementById('old_visa_flag1') as HTMLInputElement
      const oldVisaNo = document.getElementById('old_visa_flag2') as HTMLInputElement

      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: profileNoVisa,
      })

      if (oldVisaYes.checked || oldVisaNo.checked) {
        failures.push('Regression 4j Failed: Old visa radio button was automatically checked when source data was absent.')
      }
    }

    // Case 3: Profile says previous visa exists, but confirmed document is empty -> DO NOT use profile
    const profileWithPreviousVisa: ApplicantProfile = {
      ...createEmptyProfile(),
      previousVisa: {
        hasPreviousVisa: true,
        visaNumber: 'PROFILE_OLD_VISA_123',
        visaType: 'TOURIST',
      },
    }
    const emptyDocExtracted = extractApplicantDataFromDocuments([docNoVisa])
    const mappedWithProfile = applyExtractionToApplicant(profileWithPreviousVisa, emptyDocExtracted)

    if (mappedWithProfile.previousVisa !== undefined) {
      failures.push('Regression 4k Failed: Confirmed extraction fallback leaked profile previousVisa data.')
    }

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const visaNoInput = document.getElementById('old_visa_no') as HTMLInputElement
      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: mappedWithProfile,
      })
      if (visaNoInput.value !== '') {
        failures.push(`Regression 4l Failed: Profile previous visa leaked into DOM: '${visaNoInput.value}'`)
      }
    }
  } catch (err: unknown) {
    failures.push(`Regression 4 Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // REGRESSION 5: SPONSOR / REFERENCE SAFETY (Prompt Section 9)
  // -------------------------------------------------------------
  testCount++
  try {
    // Invitation letter contains sponsor name only, no sponsor phone (has applicant phone elsewhere)
    const docSponsorNameOnly = {
      id: 'doc-sponsor-name-only',
      documentType: 'invitation_letter',
      fileName: 'invitation.pdf',
      text: `
        INVITATION LETTER
        SPONSOR IN INDIA: DR ANISUR RAHMAN
        SPONSOR ADDRESS LINE 1: 14/B PARK STREET, KOLKATA
        APPLICANT PHONE: +8801711223344
      `,
    }
    const extractedSponsor = extractApplicantDataFromDocuments([docSponsorNameOnly])
    if (extractedSponsor.sponsorIndia?.name?.value !== 'DR ANISUR RAHMAN') {
      failures.push(`Regression 5a Failed: Expected sponsorIndia.name 'DR ANISUR RAHMAN', got '${extractedSponsor.sponsorIndia?.name?.value}'`)
    }
    if (extractedSponsor.sponsorIndia?.phone !== undefined) {
      failures.push(`Regression 5b Failed: Applicant phone was mistakenly extracted as sponsorIndia.phone: '${extractedSponsor.sponsorIndia?.phone?.value}'`)
    }

    // Reference in Bangladesh contains name only, no phone
    const docMsnNameOnly = {
      id: 'doc-msn-name-only',
      documentType: 'reference_doc',
      fileName: 'reference.pdf',
      text: 'REFERENCE IN BANGLADESH: PROFESSOR KHALED HASAN\nADDRESS IN BANGLADESH: DHANMONDI, DHAKA',
    }
    const extractedMsn = extractApplicantDataFromDocuments([docMsnNameOnly])
    if (extractedMsn.sponsorMission?.name?.value !== 'PROFESSOR KHALED HASAN') {
      failures.push(`Regression 5c Failed: Expected sponsorMission.name 'PROFESSOR KHALED HASAN', got '${extractedMsn.sponsorMission?.name?.value}'`)
    }
    if (extractedMsn.sponsorMission?.phone !== undefined) {
      failures.push(`Regression 5d Failed: sponsorMission.phone should be undefined, got '${extractedMsn.sponsorMission?.phone?.value}'`)
    }

    // DOM Autofill: Sponsor phone remains untouched
    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const sponsorName = document.getElementById('nameofsponsor_ind') as HTMLInputElement
      const sponsorPhone = document.getElementById('phoneofsponsor_ind') as HTMLInputElement
      sponsorPhone.value = 'USER_PREFILLED_PHONE'

      const mappedSponsorProfile = applyExtractionToApplicant(createEmptyProfile(), extractedSponsor)
      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: mappedSponsorProfile,
      })

      if (sponsorName.value !== 'DR ANISUR RAHMAN') {
        failures.push(`Regression 5e Failed: #nameofsponsor_ind was not populated. Got '${sponsorName.value}'`)
      }
      if (sponsorPhone.value !== 'USER_PREFILLED_PHONE') {
        failures.push(`Regression 5f Failed: Pre-filled sponsor phone was mutated. Got '${sponsorPhone.value}'`)
      }
    }
  } catch (err: unknown) {
    failures.push(`Regression 5 Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // REGRESSION 6: REFUSAL CONTROLS ARE STRICTLY MANUAL (Prompt Section 10)
  // -------------------------------------------------------------
  testCount++
  try {
    const refuseFlagMapping = BANGLADESH_VISA_DETAILS_MAPPINGS.find((m) => m.targetField === 'refuse_flag')
    const refuseDetailsMapping = BANGLADESH_VISA_DETAILS_MAPPINGS.find((m) => m.targetField === 'refuse_details')

    if (!refuseFlagMapping || refuseFlagMapping.sourceType !== 'manual' || refuseFlagMapping.status !== 'manual-required') {
      failures.push("Regression 6a Failed: Refuse flag mapping must be sourceType: 'manual' and status: 'manual-required'.")
    }
    if (!refuseDetailsMapping || refuseDetailsMapping.sourceType !== 'manual' || refuseDetailsMapping.status !== 'manual-required') {
      failures.push("Regression 6b Failed: Refuse details mapping must be sourceType: 'manual' and status: 'manual-required'.")
    }

    if (typeof document !== 'undefined') {
      document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
      const refuseFlagYes = document.getElementById('refuse_flag1') as HTMLInputElement
      const refuseFlagNo = document.getElementById('refuse_flag2') as HTMLInputElement
      const refuseDetails = document.getElementById('refuse_details') as HTMLTextAreaElement

      const profileWithRefusal: ApplicantProfile = {
        ...createEmptyProfile(),
        previousVisa: {
          hasRefusal: true,
          refusalDetails: 'PREVIOUS REFUSAL REASON',
        },
      }

      await executeAutofill({
        mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
        applicant: profileWithRefusal,
      })

      if (refuseFlagYes.checked || refuseFlagNo.checked) {
        failures.push('Regression 6c Failed: Refuse flag radio was checked by autofill engine.')
      }
      if (refuseDetails.value !== '') {
        failures.push(`Regression 6d Failed: Refuse details was mutated by autofill engine: '${refuseDetails.value}'`)
      }
    }
  } catch (err: unknown) {
    failures.push(`Regression 6 Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // REGRESSION 7: APPLICANT PROFILE FALLBACK ZERO & CONFLICT RESOLUTION (Prompt Section 13)
  // -------------------------------------------------------------
  testCount++
  try {
    const originalProfileWithOldData: ApplicantProfile = {
      applicantId: 'test-profile-fallback',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      travel: {
        duration: 'OLD_PROFILE_DURATION',
        entryPoint: 'OLD_PROFILE_PORT',
      },
      reference: {
        name: 'OLD_PROFILE_SPONSOR',
        phone: '0000000000',
      },
    }

    // Document contains only travel entryPoint and new sponsor name
    const newDocData = {
      id: 'doc-new-data',
      documentType: 'flight_itinerary',
      fileName: 'flight.pdf',
      text: 'PORT OF ARRIVAL: HARIDASPUR\nSPONSOR IN INDIA: NEW CONFIRMED SPONSOR',
    }
    const extractedNew = extractApplicantDataFromDocuments([newDocData])
    const mapped = applyExtractionToApplicant(originalProfileWithOldData, extractedNew)

    // Conflict: Document value wins over profile
    if (mapped.travel?.entryPoint !== 'HARIDASPUR') {
      failures.push(`Regression 7a Failed: Expected document value 'HARIDASPUR', got '${mapped.travel?.entryPoint}'`)
    }
    if (mapped.reference?.name !== 'NEW CONFIRMED SPONSOR') {
      failures.push(`Regression 7b Failed: Expected document value 'NEW CONFIRMED SPONSOR', got '${mapped.reference?.name}'`)
    }

    // Missing from document: Must NOT fall back to profile data!
    if (mapped.travel?.duration !== undefined) {
      failures.push(`Regression 7c Failed: Document lacked duration, but profile duration leaked: '${mapped.travel?.duration}'`)
    }
    if (mapped.reference?.phone !== undefined) {
      failures.push(`Regression 7d Failed: Document lacked sponsor phone, but profile phone leaked: '${mapped.reference?.phone}'`)
    }
  } catch (err: unknown) {
    failures.push(`Regression 7 Exception: ${(err as Error).message}`)
  }

  // -------------------------------------------------------------
  // REGRESSION 8: DATE SAFETY - TICKET ISSUE DATE VS TRAVEL DATE (Prompt Section 14)
  // -------------------------------------------------------------
  testCount++
  try {
    const complexTicketDoc = {
      id: 'doc-complex-ticket',
      documentType: 'flight_itinerary',
      fileName: 'e-ticket.pdf',
      text: `
        AIRLINE ELECTRONIC TICKET
        DATE OF BOOKING: 05/01/2026
        TICKET ISSUE DATE: 06/01/2026
        DATE OF DEPARTURE: 28/05/2026
        FLIGHT: AI 230
        PORT OF ARRIVAL: KOLKATA AIRPORT
      `,
    }
    const extractedComplexTicket = extractApplicantDataFromDocuments([complexTicketDoc])
    if (extractedComplexTicket.travel?.intendedArrivalDate?.value !== '2026-05-28') {
      failures.push(`Regression 8 Failed: Expected departure date '2026-05-28', got '${extractedComplexTicket.travel?.intendedArrivalDate?.value}'`)
    }
  } catch (err: unknown) {
    failures.push(`Regression 8 Exception: ${(err as Error).message}`)
  } finally {
    if (typeof document !== 'undefined') {
      document.body.innerHTML = ''
    }
  }

  return {
    passed: failures.length === 0,
    testCount,
    failures,
  }
}
