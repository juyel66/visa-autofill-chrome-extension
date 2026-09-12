<<<<<<< HEAD
VISA AUTOFILL — APPLICATION PURPOSE & COMPLETE ARCHITECTURE NOTE
=======
# VISA AUTOFILL — APPLICATION PURPOSE & COMPLETE ARCHITECTURE NOTE
>>>>>>> 93d0daf072a697f0309967255ba22ed42ac9eedd

1.  THIS APPLICATION’S MAIN PURPOSE

The main purpose of this application is to make the Bangladesh-to-India
visa application process faster and easier by extracting applicant
information from uploaded documents and then using that saved
information to autofill the appropriate fields on the official Indian
Visa website.

<<<<<<< HEAD
The complete workflow is:
=======
## The complete workflow is:
>>>>>>> 93d0daf072a697f0309967255ba22ed42ac9eedd

Passport / OGD Document ↓ Document Extraction ↓ Gemini AI + PDF Text +
OCR + MRZ ↓ Normalization & Validation ↓ ApplicantProfile ↓
SavedApplication ↓ Application Workspace ↓ User Reviews / Edits Missing
or Incorrect Data ↓ SAVE APPLICATION ↓ Open Indian Visa Website ↓ Detect
Current Visa Page ↓ Autofill Current Page ↓ Fill Supported Fields ↓ User
Manually Handles CAPTCHA / OTP / Required Security Decisions ↓ User
Manually Clicks Portal Continue / Save & Continue ↓ Next Page ↓ Autofill
Current Page Again

The application is NOT intended to automatically submit a visa
application. It is an applicant-data extraction, review, storage, and
page-by-page autofill assistant.

2.  CORE PRODUCT GOALS

The application must:

-   Accept Passport and OGD documents.
-   Extract as much reliable applicant information as possible.
-   Work dynamically with any applicant’s document.
-   Never depend on one specific applicant’s data.
-   Store the extracted information in an Application Workspace.
-   Allow the user to manually correct or complete fields.
-   Save the final application data.
-   Autofill supported Indian Visa website fields page-by-page.
-   Clearly identify fields that were filled, skipped, failed, or
    require manual entry.
-   Keep security-sensitive actions manual.

3.  ABSOLUTE DYNAMIC DATA RULE

All PDFs, passport scans, screenshots, and documents supplied during
development are ONLY reference/test documents.

They must NEVER become production data.

ZERO applicant-specific values may be hardcoded into runtime code.

This includes:

-   names
-   surnames
-   given names
-   passport numbers
-   previous passport numbers
-   phone numbers
-   mobile numbers
-   addresses
-   postal codes
-   dates
-   emails
-   family names
-   emergency contacts
-   districts
-   cities
-   religions
-   nationality values tied to a specific applicant
-   any other applicant information

The supplied documents may be used inside isolated automated test
fixtures to verify expected results.

They must NEVER leak into runtime extraction, normalization, application
merging, defaults, UI defaults, or autofill logic.

If a completely different person’s document is uploaded, the extension
must automatically extract that person’s information without any code
change.

If information is not present or cannot be reliably read:

→ leave the field blank/null → do not guess → do not use previous
applicant data → do not use test data → do not invent a value

4.  HIGH-LEVEL ARCHITECTURE

DOCUMENT ↓ DOCUMENT INGESTION ↓ PDF TEXT / GEMINI / OCR / MRZ ↓
EXTRACTION CANDIDATES ↓ NORMALIZATION + VALIDATION ↓ APPLICANT PROFILE ↓
SAVED APPLICATION ↓ APPLICATION WORKSPACE ↓ MANUAL USER REVIEW / EDIT ↓
SAVE APPLICATION ↓ INDIAN VISA WEBSITE ↓ PAGE DETECTION ↓ PAGE-SPECIFIC
MAPPING ↓ SELECTOR RESOLUTION ↓ VALUE RESOLUTION ↓ FIELD FILLING ↓ DOM
EVENT DISPATCH ↓ DOM VERIFICATION ↓ AUTOFILL RESULT

5.  SOURCE PRECEDENCE

When the same field is available from multiple sources, use:

Manual Edit > Current Passport Document > Current OGD Document >
Approved Generic Derived Rule > Blank

Passport is the current identity authority.

OGD is supplementary/historical information.

OGD must not overwrite stronger current Passport identity information.

6.  APPLICANT PROFILE

ApplicantProfile is the reusable applicant data model.

It can contain:

-   personal information
-   passport information
-   present address
-   permanent address
-   contact information
-   family information
-   employment
-   military history
-   other reusable applicant information

ApplicantProfile should remain generic and country-agnostic.

7.  SAVED APPLICATION

SavedApplication is the final editable application representation used
by the Indian Visa workflow.

It is the source of truth for website autofill after extraction and user
review.

The website autofill layer must read from SavedApplication rather than
directly reading:

-   raw OCR
-   raw Gemini responses
-   previous documents
-   old profiles
-   test fixtures

Workflow:

SavedApplication ↓ Field Resolver ↓ Website Adapter ↓ Portal Form

8.  DOCUMENT SOURCES

PASSPORT

Passport is the primary current identity source.

Possible passport information:

-   surname
-   given name
-   nationality
-   date of birth
-   gender
-   place of birth
-   passport number
-   passport issue date
-   passport expiry date
-   passport issue place
-   previous passport information
-   permanent address
-   emergency contact
-   emergency contact phone
-   MRZ

OGD / PREVIOUS APPLICATION

OGD is supplementary/historical.

It may provide:

-   previous visa information
-   historical application information
-   family information
-   employment
-   references
-   previous travel information
-   historical address
-   other fields not available in the Passport

9.  EXTRACTION ARCHITECTURE

The extraction system combines multiple possible sources:

PDF text + Gemini AI + OCR + MRZ + document-specific extraction

These produce extraction candidates.

Candidates are then:

1.  normalized
2.  validated
3.  merged
4.  converted into the application model

Important: No raw extraction result should directly become final
application data without normalization/validation.

10. GEMINI EXTRACTION

Gemini is used for document understanding and structured extraction.

Gemini must:

-   inspect the current uploaded document
-   extract only document-supported information
-   return structured data
-   return null when unavailable
-   never invent missing values
-   never use previous applicant information
-   never use test data
-   never infer sensitive information from names

Preferred structured address:

address: addressLine1 addressLine2 villageTownCity district
stateProvince country postalCode

Preferred contact:

contact: phone mobile email

11. OCR AND MRZ

OCR is a supporting/fallback extraction mechanism.

MRZ is especially useful for:

-   passport number
-   nationality
-   date of birth
-   sex
-   expiry date
-   surname
-   given names

OCR output must be normalized.

OCR garbage must never become applicant information.

Examples of OCR problems that must be cleaned:

-   random isolated characters
-   broken words
-   duplicated fragments
-   incorrect punctuation
-   broken address lines
-   unrelated text
-   fragments such as “COLON” when it is OCR noise

12. ADDRESS ARCHITECTURE

Present Address fields:

-   Present Address Line 1
-   Present Address Line 2
-   Present Village/Town/City
-   Present District
-   Present State/Province
-   Present Country
-   Present Postal/Pincode
-   Present Phone
-   Present Mobile
-   Present Email

Permanent Address fields:

-   Permanent Address Line 1
-   Permanent Address Line 2
-   Permanent Village/Town/City
-   Permanent District
-   Permanent State/Province
-   Permanent Country
-   Permanent Postal/Pincode

13. ADDRESS PARSING RULE

The complete address should first be reconstructed from the document.

Then it should be semantically separated.

Generic pattern:

FIRST COMPONENT, SECOND COMPONENT, THIRD COMPONENT - POSTAL CODE, CITY

should generally become:

Address Line 1 = FIRST COMPONENT

Address Line 2 = SECOND COMPONENT, THIRD COMPONENT

Village/Town/City = CITY

Postal/Pincode = POSTAL CODE

This is a generic parsing rule.

Do NOT hardcode the current test applicant’s address.

The parser must work for completely different addresses.

14. ADDRESS REFERENCE EXAMPLE

One supplied reference/test document contains an address equivalent to:

KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI - 5120, THAKURGAON

Expected structure for that test is:

Present Address Line 1: KASHIPUR

Present Address Line 2: RANISANKAIL, MUZAHIDABAD COLONI

Present Village/Town/City: THAKURGAON

District: THAKURGAON

Postal/Pincode: 5120

These values are ONLY a reference/test example.

They must never be hardcoded into production.

15. PRESENT ADDRESS FALLBACK

Existing business rule:

If explicit Present Address exists: use Present Address

Else if Permanent Address exists: clone structured Permanent Address
into Present Address

Else: leave Present Address blank

If Present and Permanent addresses are both available and different:
keep them separate.

Manual user edits always override extracted/derived values.

Do not copy phone/mobile/email merely because the address itself was
copied.

16. CONTACT EXTRACTION

Supported applicant contact information:

-   phone
-   mobile
-   email
-   ISD code

Rules:

-   Applicant phone may populate Present Phone.
-   Applicant mobile may populate Mobile.
-   +880… / 880… may be normalized into mobile + ISD.
-   Applicant email may populate Email.
-   Emergency contact telephone may be used as an applicant phone
    fallback only when the existing approved rule allows it.
-   Employer phone must not become applicant phone.
-   Sponsor phone must not become applicant phone.
-   Hotel phone must not become applicant phone.
-   Family phone must not become applicant phone.

17. RELIGION SAFETY

Religion is sensitive personal information.

Do NOT infer religion from:

-   name
-   surname
-   title
-   family name
-   location
-   community association

Religion may only be populated from:

-   explicit document evidence
-   explicit OGD evidence
-   manual user entry

18. BANGLADESH FAMILY NATIONALITY RULE

The approved generic business rule remains:

If the applicant’s nationality is Bangladesh and a father/mother record
exists, Father/Mother nationality may be populated as Bangladesh
according to the existing application rule.

This is a generic business rule, not applicant-specific hardcoding.

Users can manually correct rare exceptions.

Do NOT remove this rule unless explicitly requested.

19. APPLICATION WORKSPACE

The Application Workspace is the central review/edit page.

Its purpose is to:

-   show extracted information
-   show source badges
-   show missing information
-   allow manual editing
-   allow the user to save
-   keep all supported fields available
-   prepare SavedApplication for autofill

The Workspace is not the Indian Visa website.

20. WORKSPACE VIEW

The UI can use a curated view for practical use.

Hidden fields must remain:

-   stored
-   mapped
-   available for autofill

Hiding a field in the UI must not remove its underlying
application/autofill capability.

A Show All Fields option may expose the full inventory.

21. SOURCE BADGES

Possible source labels:

-   Passport PDF
-   OGD
-   Derived Rule
-   Manual Entry

Source badges must be truthful.

A derived value must not be labeled as directly extracted from the
Passport.

22. SAVE APPLICATION

The user should have one primary SAVE APPLICATION action.

Manual edits must persist to SavedApplication.

After saving:

Workspace ↓ SavedApplication ↓ Autofill

23. INDIAN VISA PORTAL

Target:

https://indianvisa-bangladesh.nic.in/

Current supported workflow pages:

-   Registration
-   Basic Details
-   Family Details
-   Visa Details
-   Additional Questions
-   Photo Upload

Other portal states may exist, but unsupported/security-sensitive states
must remain outside automated autofill.

24. PAGE DETECTION

Use the existing India Visa page detection architecture.

Registration:

/visa/Registration

Basic Details:

/visa/BasicDetails

Family Details:

/visa/FamilyDetails

Visa Details:

/visa/VisaDetails

Additional Questions:

/visa/AdditionalQuestions

Photo:

/visa/PhotoUpload

Do not create multiple competing page-detection systems.

25. REGISTRATION PAGE

Target:

/visa/Registration

Supported fields:

Country/Region: Selector: #countryname_id Source: appl.countryname

Indian Mission: Selector: #missioncode_id Source: appl.missioncode

Nationality/Region: Selector: #nationality_id Source: appl.nationality

Date of Birth: Selector: #dob_id Source: appl.birthdate

Email: Selector: #email_id Source: appl.email

Re-enter Email: Selector: #email_re_id Source: appl.email_re

Expected Date of Arrival: Selector: #jouryney_id Source:
appl.journeydate

CAPTCHA: Selector: #captcha Status: MANUAL

26. REGISTRATION DROPDOWN HANDLING

Country, Mission and Nationality are portal dropdowns.

Do not assume the SavedApplication value equals the HTML option value.

Resolution should inspect actual DOM options.

Preferred resolution:

Exact normalized option value > Exact normalized option text > Approved
generic alias > Unresolved

If unresolved: FAILED

Do not guess.

Mission may depend on Country.

Sequence:

Country ↓ dispatch change ↓ wait for Mission options ↓ resolve Mission ↓
select Mission ↓ verify

27. DATE HANDLING

SavedApplication should keep normalized dates.

Website adapters may convert dates into the portal’s required format.

Example:

SavedApplication: 1993-09-18

Portal: 18/09/1993

Do not mutate the underlying application data just to satisfy the
website.

28. AUTOFILL CURRENT PAGE

When the user clicks:

AUTOFILL CURRENT PAGE

the extension should:

1.  detect the current supported page
2.  load SavedApplication
3.  resolve fields
4.  fill reliable values
5.  leave missing values blank
6.  verify actual DOM values
7.  report the result

It must not require re-uploading the document for every page.

29. FIELD RESULT STATES

FILLED: Reliable value existed and the final DOM value was successfully
verified.

SKIPPED: No reliable source value exists.

FAILED: Reliable source value exists but the portal field could not be
resolved, written, or verified.

MANUAL: The field is intentionally excluded from automation.

Example:

Country = FILLED Mission = FAILED Email = SKIPPED CAPTCHA = MANUAL

30. DOM VERIFICATION

After filling a field, verify the actual website DOM.

For text fields:

element.value must match the expected normalized website value.

For selects:

the selected option must match the resolved expected option.

Do not report FILLED merely because an assignment operation executed.

If the portal resets the value: report FAILED.

31. DOM EVENTS

When required by the portal, dispatch:

-   input
-   change
-   blur

For dependent fields, allow the portal to update before selecting the
dependent field.

Example:

Country ↓ change ↓ Mission options update ↓ Mission selection

32. CONTENT SCRIPT ARCHITECTURE

The website side uses:

Manifest V3 ↓ Content Script ↓ India Visa Page Detection ↓ Message
Receiver ↓ Autofill Engine ↓ Page Adapter ↓ Portal DOM

The background/service worker routes the autofill request to the active
supported portal tab.

33. AUTOFILL MESSAGE FLOW

Application Workspace / Extension UI ↓ AUTOFILL CURRENT PAGE ↓
Background / Service Worker ↓ Current Active Tab ↓ Content Script ↓ Page
Adapter ↓ Autofill Engine ↓ Portal Fields

A readiness/ping mechanism may be used so the background can confirm the
content script is available.

34. BASIC DETAILS PAGE

Target:

/visa/BasicDetails

Important fields include:

-   surname
-   given name
-   changed surname
-   gender
-   place of birth
-   country of birth
-   national ID number
-   religion
-   visible identification marks
-   education
-   nationality by
-   passport number
-   passport issue place
-   passport issue date
-   passport expiry date
-   other passport information

Existing verified selectors include:

#surname #givenName #changedSurnameCheck #gender #birth_place
#country_birth #nic_number #religion #identity_marks #education
#nationality_by #passport_no #passport_issue_place #passport_issue_date
#passport_expiry_date #other_ppt_1 #other_ppt_2 #other_ppt_no
#other_ppt_issue_place #other_ppt_country_issue #other_ppt_nat

35. FAMILY DETAILS PAGE

Important fields:

Present Address: #pres_add1 #pres_add2 #pres_add3 / appl.state_name
#pincode #pres_phone #mobile #sameAddress_id

Permanent Address: #perm_address1 #perm_address2 #perm_address3

Father: #fthrname #father_place_of_birth #father_country_of_birth
#father_nationality

Mother: #mother_name #mother_place_of_birth #mother_country_of_birth
#mother_nationality

Other: #marital_status #grandparent_flag1 #grandparent_flag2
#grandparent_details

Same Address checkbox: MANUAL ONLY

36. EMPLOYMENT

Important fields:

#occupation #empname #empdesignation #empaddress #empphone
#previous_occupation #prev_org1 #prev_org2 #previous_organization
#previous_designation #previous_rank #previous_posting

Employer information must not be confused with applicant contact
information.

37. VISA DETAILS

Important fields include:

#duration #visa_entry_id #journeydate / #jouryney_id #entrypoint
#exitpointprc

Previous visa:

#old_visa_flag1 #old_visa_flag2 #prv_visit_add1 #prv_visit_add2
#prv_visit_add3 #visited_city #old_visa_no #old_visa_type_id
#oldvisaissueplace #oldvisaissuedate

Refusal:

#refuse_flag1 #refuse_flag2 #refuse_details

SAARC history:

#saarc_flag1 #saarc_flag2 #saarcCountry1 … #saarcCountry8 #saarcYear1 …
#saarcYear8 #saarcVisitNo1 … #saarcVisitNo8

India sponsor:

#nameofsponsor_ind #add1ofsponsor_ind #add2ofsponsor_ind
#stateofsponsor_ind #districtofsponsor_ind #phoneofsponsor_ind

Bangladesh reference:

#nameofsponsor_msn #add1ofsponsor_msn #add2ofsponsor_msn
#phoneofsponsor_msn

38. ADDITIONAL QUESTIONS

Current question fields:

#question_yes_1 … #question_yes_6 #question_no_1 … #question_no_6
#answer_1 … #answer_6

Declaration:

#verifyQuestions

Declaration/verification must remain manual.

The extension must not invent answers to security/compliance questions.

39. PHOTO PAGE

Photo file selection remains manual.

The extension must NOT:

-   open the browser file chooser
-   select the portal photo
-   click Upload
-   click Continue
-   click Exit

The photo section may provide status/guidance only.

40. SECURITY / MANUAL BOUNDARIES

The extension must NEVER automate:

-   CAPTCHA
-   OTP
-   payment
-   final submission
-   declaration checkbox
-   same-address checkbox
-   refusal/criminal disclosures
-   security/compliance decisions
-   portal photo file chooser
-   portal Upload
-   portal Continue
-   portal Save & Continue
-   portal Exit

The user remains in control of these actions.

41. PAGE-BY-PAGE USER WORKFLOW

42. Upload Passport / OGD.

43. Extraction runs automatically.

44. Application Workspace opens.

45. User reviews extracted information.

46. User manually corrects/enters missing values.

47. User clicks SAVE APPLICATION.

48. User opens Indian Visa website.

49. User clicks AUTOFILL CURRENT PAGE.

50. Extension fills supported fields.

51. User manually completes CAPTCHA if present.

52. User manually clicks portal Continue / Save & Continue.

53. Next page loads.

54. User clicks AUTOFILL CURRENT PAGE again.

55. Repeat until all supported pages are completed.

56. HIDDEN FIELD POLICY

The application internally supports the complete field inventory.

The UI may hide less frequently used fields.

Hidden fields must remain:

-   stored
-   mapped
-   available to autofill
-   editable through Show All Fields when needed

43. COUNTRY-SPECIFIC ARCHITECTURE

Generic reusable logic belongs under:

src/core/

India-specific logic belongs under:

src/countries/india/

Bangladesh-specific Indian Visa mappings belong under:

src/countries/india/mappings/bangladesh/

Bangladesh-specific Indian Visa selectors belong under:

src/countries/india/selectors/bangladesh/

This separation allows future country support without rebuilding the
core system.

44. SELECTOR ARCHITECTURE

Selectors and mappings should remain separate.

Selectors define:

WHERE the portal field is.

Mappings define:

WHAT application data goes there and HOW it is transformed.

45. WEBSITE ADAPTER PRINCIPLE

Website-specific transformations belong in the website adapter layer.

Examples:

-   normalized date → DD/MM/YYYY
-   saved country → portal option
-   saved nationality → portal option
-   saved mission → portal option

Do not mutate core applicant data simply because the website requires
another representation.

46. ERROR HANDLING

The system must not silently fail.

Examples:

Element not found Saved value missing Select option unresolved Portal
reset value Content script unavailable Unsupported page

must result in clear status information.

47. LOGGING POLICY

Development logs should be concise and should not expose unnecessary
personal data.

Safe example:

Page: REGISTRATION Adapter: ready Fields processed: 7 Filled: 5 Skipped:
1 Failed: 1 Manual: 1

Avoid logging:

-   passport numbers
-   phone numbers
-   email addresses
-   full addresses
-   personal names

48. APPLICANT ISOLATION

Applicant A:

Applicant A document ↓ SavedApplication A

Applicant B:

Applicant B document ↓ SavedApplication B

No values from Applicant A may appear in Applicant B.

Whenever a new document is processed, the current application must be
isolated from previous applicant data.

49. DOCUMENT REPROCESSING

New document:

New Document ↓ New Extraction ↓ New Candidates ↓ Normalization ↓ Merge ↓
Current Application

Previous applicant data must not be used as an automatic fallback.

50. HARDcoding POLICY

PROHIBITED:

if passportNumber === known value if filename.includes(known applicant
name) if name === known applicant if address.includes(known locality) if
phone === known phone if nationalId === known number

Also prohibited:

-   known applicant defaults
-   known passport defaults
-   known address defaults
-   known phone defaults
-   known email defaults
-   known emergency contact defaults

Generic normalization rules are allowed.

Applicant-specific rules are not.

51. APPROVED GENERIC DERIVED RULES

Examples:

Present Address fallback: Permanent Address → Present Address when
Present Address is absent.

Father/Mother Bangladesh nationality: Approved generic Bangladesh
business rule.

Email confirmation: Mirror the current validated application email when
the existing application rule permits it.

These rules must remain generic and documented.

52. TEST STRATEGY

Tests should cover:

-   document extraction
-   OCR
-   MRZ
-   Gemini extraction
-   address parsing
-   contact extraction
-   applicant isolation
-   hardcode audit
-   workspace
-   manual edit persistence
-   application saving
-   page detection
-   selector resolution
-   value resolution
-   DOM autofill
-   DOM verification
-   error handling
-   end-to-end workflow

53. REGISTRATION AUTOFILL TESTS

Required tests:

-   Registration URL detection
-   Content script readiness
-   Country selection
-   Mission selection
-   Nationality selection
-   DOB filling
-   Email filling
-   Confirm Email filling
-   Journey Date filling
-   Missing value behavior
-   Select option resolution
-   Dependent Mission dropdown
-   DOM event dispatch
-   DOM verification
-   CAPTCHA untouched
-   Continue button untouched
-   Save & Continue untouched
-   Applicant isolation

54. DYNAMIC EXTRACTION TESTS

Test at least two different applicants.

Applicant A: Document A ↓ Data A

Applicant B: Document B ↓ Data B

Verify:

-   A values do not appear in B.
-   B values are taken from B’s document.
-   No applicant-specific production hardcode exists.

55. HARDcode AUDIT

Production source must be scanned for applicant-specific values.

Runtime source areas include:

-   src/core/
-   src/countries/
-   src/application/
-   src/background/
-   src/content/
-   src/components/
-   src/popup/

Test fixtures may contain reference values.

Runtime production code may not.

56. BUILD AND QUALITY REQUIREMENTS

Before declaring a feature complete:

-   unit tests
-   integration tests where applicable
-   hardcode audit
-   lint
-   production build
-   real Chrome test
-   actual portal DOM verification

A passing unit test alone is not enough for website autofill.

57. REAL CHROME VALIDATION

For every portal autofill page:

1.  Build extension.

2.  Reload unpacked extension.

3.  Open actual Indian Visa page.

4.  Confirm page detection.

5.  Click Autofill Current Page.

6.  Observe actual portal fields.

7.  Verify filled values.

8.  Verify manual/security fields remain untouched.

9.  Verify no portal button was automatically clicked.

10. REGISTRATION SUCCESS CRITERIA

Registration should result in:

Country: FILLED when reliable data exists.

Indian Mission: FILLED when reliable data exists and portal option
resolves.

Nationality: FILLED when reliable data exists and portal option
resolves.

DOB: FILLED when reliable data exists.

Email: FILLED when reliable data exists.

Confirm Email: FILLED when reliable data exists.

Journey Date: FILLED when reliable data exists.

CAPTCHA: MANUAL.

If data is missing: SKIPPED.

If reliable data exists but the portal field cannot be resolved: FAILED.

59. NO FALSE COMPLETION

Never report FILLED unless the final DOM value has been verified.

Never report SKIPPED when a reliable value exists but filling failed.

Use FAILED in that situation.

60. CURRENT DEVELOPMENT STATUS

Completed / working areas:

-   document upload
-   PDF extraction
-   scanned passport support
-   OCR/MRZ support
-   Gemini extraction
-   dynamic applicant extraction
-   applicant hardcode removal
-   Application Workspace
-   SavedApplication
-   manual editing
-   Save Application
-   Present Address fallback
-   structured address parsing
-   contact extraction
-   applicant isolation
-   religion safety
-   Bangladesh family nationality rule
-   India Visa page detection
-   content-script communication
-   Registration page detection
-   Registration Autofill execution

Current Registration work:

-   Country autofill
-   Mission dropdown resolution
-   Nationality dropdown resolution
-   Email autofill
-   Confirm Email autofill
-   Journey Date autofill
-   DOM verification

Next development stages:

-   Basic Details Autofill
-   Family Details Autofill
-   Visa / Travel Details Autofill
-   Additional Questions safe autofill
-   Photo page boundary verification
-   Full end-to-end autofill audit

61. FUTURE IMPROVEMENTS

Possible future improvements:

-   stronger document classification
-   better OCR preprocessing
-   better multilingual OCR
-   improved portal select resolution
-   improved date adapters
-   better field-level confidence/provenance
-   stronger extraction conflict resolution
-   automated regression fixtures
-   secure backend Gemini API architecture for production
-   additional country support

Future improvements must not break the existing workflow.

62. ABSOLUTE RULES

63. No applicant-specific hardcoded production data.

64. Every uploaded document must be processed dynamically.

65. Previous applicant data must never leak.

66. Passport is current identity authority.

67. OGD is supplementary/historical.

68. Manual edits override extraction.

69. SavedApplication is the autofill source of truth.

70. Present Address may fall back from Permanent Address when Present is
    absent.

71. Address must remain structurally separated.

72. Missing values remain blank.

73. Unsupported values must not be guessed.

74. Religion must not be inferred from names.

75. Father/Mother Bangladesh nationality generic business rule remains
    allowed.

76. CAPTCHA remains manual.

77. OTP remains manual.

78. Payment remains manual.

79. Declaration remains manual.

80. Same-address checkbox remains manual.

81. Refusal/criminal/security questions remain manual unless safely
    supported by an approved existing rule.

82. Portal Continue/Save & Continue/Submit/Exit remain manual.

83. Portal photo file chooser remains manual.

84. Website autofill must verify the actual DOM.

85. Hidden UI fields remain internally available for autofill.

86. Country-specific logic belongs under countries//.

87. Portal selectors and mappings remain separate.

88. Real Chrome testing is required before declaring portal autofill
    complete.

89. FINAL ARCHITECTURE SUMMARY

DOCUMENTS ↓ PDF TEXT + GEMINI + OCR + MRZ ↓ EXTRACTION CANDIDATES ↓
NORMALIZATION / VALIDATION ↓ APPLICANT PROFILE ↓ SAVED APPLICATION ↓
APPLICATION WORKSPACE ↓ MANUAL REVIEW / EDIT ↓ SAVE APPLICATION ↓ INDIAN
VISA PORTAL ↓ PAGE DETECTOR ↓ CANONICAL PAGE ↓ COUNTRY/PAGE MAPPING ↓
SELECTOR RESOLVER ↓ VALUE RESOLVER ↓ FIELD FILLER ↓ DOM EVENTS ↓ DOM
VERIFICATION ↓ FILLED / SKIPPED / FAILED / MANUAL

The core objective remains:

EXTRACT THE CURRENT APPLICANT’S REAL DATA FROM THE CURRENT DOCUMENT, LET
THE USER REVIEW AND CORRECT IT, THEN AUTOFILL ONLY THE SUPPORTED INDIAN
VISA FIELDS, WITHOUT APPLICANT-SPECIFIC HARDCODING AND WITHOUT
AUTOMATING CAPTCHA, OTP, PAYMENT, FINAL SUBMISSION, OR OTHER MANUAL
SECURITY ACTIONS.
