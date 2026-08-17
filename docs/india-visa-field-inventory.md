# Indian Visa Field Inventory, Page Mapping & Data Model Architecture

**Product Name:** Visa Autofill  
**Module:** Indian Visa Application (`src/countries/india/visa`)  
**Task:** 005.1 Field Inventory & Data Model Finalization  

---

## 1. Executive Summary & Data Model Separation

The Indian Visa application workflow consists of **10 distinct pages/steps**. To maintain a scalable, clean, and multi-country architecture, applicant data is separated into two primary domain models:

1. **Generic `ApplicantProfile` (`src/core/applicant/types.ts`)**:
   Contains reusable, country-agnostic personal details (e.g. personal details, passport details, addresses, contact details, family details, present/past employment, military history).
   
2. **India Visa Application `IndiaVisaApplication` (`src/countries/india/visa/types.ts`)**:
   Contains application-specific and workflow details exclusive to the Indian Visa process (e.g., registration office selection, expected arrival date, visa duration, port of entry/exit, previous Indian visa history, local Indian stay addresses, Indian/home reference contacts, and document metadata).

```
                            ApplicantProfile
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
      IndiaVisaApplication                FutureCountryApplication
   (India-specific workflow)              (e.g., US / UK / Schengen)
```

---

## 2. Page Identifier System

Each workflow page is identified by a strongly-typed string union `IndiaVisaPage`:

| Page ID | Step | Page Title | Description |
| :--- | :---: | :--- | :--- |
| `registration` | 1 | Registration | Application setup, Mission selection, CAPTCHA verification |
| `basic-details` | 2 | Basic Details | Personal identification, nationality, passport details, address |
| `family-details` | 3 | Family Details | Father, Mother, Spouse details, Pakistan relation inquiry |
| `visa-details` | 4 | Visa Details | Visa category, validity, ports of entry/exit, purpose |
| `previous-visit` | 5 | Previous Visit Details | Past travel to India, previous visa history, refusal/deportation flags |
| `profession` | 6 | Profession / Occupation | Current/past occupation, employer details, military service |
| `accommodation` | 7 | Accommodation / Place of Stay | Hotel / place of stay details in India |
| `references` | 8 | References | Reference details in India & home country (e.g., Bangladesh) |
| `documents` | 9 | Documents | File upload metadata (Passport, Photo, Supporting docs) |
| `declaration` | 10 | Declaration / Final Application | Declaration confirmation and completion timestamp |
| `unknown` | - | Unknown Page | Unrecognized or unmapped page step |

---

## 3. Data Source Classification

Every form field is classified into one of 5 data source categories:

1. **Applicant Profile (`applicant_profile`)**: Permanent applicant data stored in generic `ApplicantProfile`.
2. **India Visa Application (`india_visa_application`)**: Application-specific data stored in `IndiaVisaApplication`.
3. **Derived (`derived`)**: Values computed/duplicated automatically from another field (e.g. `reg_reenter_email`).
4. **User Input (`user_input`)**: Dynamic runtime input selected by user per session.
5. **Manual / CAPTCHA (`manual_captcha`)**: Manual interactive step completed directly by the user.

> [!IMPORTANT]
> **CAPTCHA Handling Policy**: CAPTCHA must **NEVER** be automated, bypassed, intercepted, or solved programmatically. It is strictly designated as `manual_captcha` requiring direct user completion.

---

## 4. Comprehensive Page-by-Page Field Inventory

### Page 1: Registration Page (`registration`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Registration | `reg_applying_from_country` | Country/Region applying visa from | `select` | Required | `india_visa_application` | Country selection |
| Registration | `reg_indian_mission` | Indian Mission/Office | `select` | Required | `india_visa_application` | Embassy/Consulate office |
| Registration | `reg_nationality` | Nationality/Region | `select` | Required | `applicant_profile` | Applicant citizenship |
| Registration | `reg_date_of_birth` | Date of Birth | `date` | Required | `applicant_profile` | Formatted YYYY-MM-DD |
| Registration | `reg_email` | Email ID | `text` | Required | `applicant_profile` | Main email address |
| Registration | `reg_reenter_email` | Re-enter Email ID | `text` | Required | `derived` | Email confirmation field |
| Registration | `reg_expected_arrival_date` | Expected Date of Arrival | `date` | Required | `india_visa_application` | Formatted YYYY-MM-DD |
| Registration | `reg_captcha` | CAPTCHA | `manual` | Required | `manual_captcha` | **Manual user completion only** |

---

### Page 2: Basic Details Page (`basic-details`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Basic Details | `surname` | Surname / Family Name | `text` | Required | `applicant_profile` | As in passport |
| Basic Details | `given_names` | Given Name(s) | `text` | Required | `applicant_profile` | As in passport |
| Basic Details | `has_changed_name` | Have you ever changed your name? | `checkbox` | Required | `applicant_profile` | Boolean flag |
| Basic Details | `previous_name` | Previous / Other Name | `text` | Conditional | `applicant_profile` | Shown if `has_changed_name` = true |
| Basic Details | `gender` | Gender | `radio` | Required | `applicant_profile` | Male / Female / Other |
| Basic Details | `date_of_birth` | Date of Birth | `date` | Required | `applicant_profile` | Formatted YYYY-MM-DD |
| Basic Details | `town_city_of_birth` | Town/City of Birth | `text` | Required | `applicant_profile` | Birth city |
| Basic Details | `country_of_birth` | Country/Region of Birth | `select` | Required | `applicant_profile` | Birth country |
| Basic Details | `national_id_number` | Citizenship / National ID Number | `text` | Optional | `applicant_profile` | NID or SSN where applicable |
| Basic Details | `religion` | Religion | `select` | Required | `applicant_profile` | Controlled list |
| Basic Details | `visible_identification_marks` | Visible Identification Marks | `text` | Optional | `applicant_profile` | Scars/tattoos or 'NONE' |
| Basic Details | `educational_qualification` | Educational Qualification | `select` | Required | `applicant_profile` | Highest education level |
| Basic Details | `nationality` | Nationality | `select` | Required | `applicant_profile` | Current nationality |
| Basic Details | `nationality_acquired_by` | Nationality acquired by birth or naturalization? | `radio` | Required | `applicant_profile` | `birth` or `naturalization` |
| Basic Details | `previous_nationality` | Previous Nationality | `select` | Conditional | `applicant_profile` | Shown if `naturalization` |
| Basic Details | `passport_number` | Passport Number | `text` | Required | `applicant_profile` | Primary passport |
| Basic Details | `passport_place_of_issue` | Place of Issue | `text` | Required | `applicant_profile` | Issuing authority/city |
| Basic Details | `passport_issue_date` | Date of Issue | `date` | Required | `applicant_profile` | Formatted YYYY-MM-DD |
| Basic Details | `passport_expiry_date` | Date of Expiry | `date` | Required | `applicant_profile` | Formatted YYYY-MM-DD |
| Basic Details | `holds_other_passport` | Hold another valid Passport/Identity Cert? | `checkbox` | Required | `applicant_profile` | Boolean flag |
| Basic Details | `other_passport_number` | Other Passport Number | `text` | Conditional | `applicant_profile` | Shown if `holds_other_passport` = true |
| Basic Details | `other_passport_country_of_issue` | Other Passport Country of Issue | `select` | Conditional | `applicant_profile` | Shown if `holds_other_passport` = true |
| Basic Details | `other_passport_issue_date` | Other Passport Date of Issue | `date` | Conditional | `applicant_profile` | Shown if `holds_other_passport` = true |
| Basic Details | `other_passport_place_of_issue` | Other Passport Place of Issue | `text` | Conditional | `applicant_profile` | Shown if `holds_other_passport` = true |
| Basic Details | `other_passport_nationality` | Other Passport Nationality | `select` | Conditional | `applicant_profile` | Shown if `holds_other_passport` = true |
| Basic Details | `present_address_line1` | Present Address Line 1 | `text` | Required | `applicant_profile` | Street address |
| Basic Details | `present_address_line2` | Present Address Line 2 | `text` | Optional | `applicant_profile` | Apartment/Suite |
| Basic Details | `present_village_town_city` | Present Village/Town/City | `text` | Required | `applicant_profile` | City |
| Basic Details | `present_district` | Present District | `text` | Optional | `applicant_profile` | District |
| Basic Details | `present_state_province` | Present State/Province | `text` | Required | `applicant_profile` | State/Province |
| Basic Details | `present_country` | Present Country | `select` | Required | `applicant_profile` | Country |
| Basic Details | `present_postal_code` | Present Postal/ZIP Code | `text` | Required | `applicant_profile` | Postal code |
| Basic Details | `present_phone` | Present Phone | `text` | Optional | `applicant_profile` | Landline phone |
| Basic Details | `present_mobile` | Present Mobile | `text` | Required | `applicant_profile` | Mobile phone |
| Basic Details | `present_email` | Present Email | `text` | Required | `applicant_profile` | Contact email |
| Basic Details | `same_as_present_address` | Permanent Address same as Present Address? | `checkbox` | Required | `applicant_profile` | Boolean flag |
| Basic Details | `permanent_address_line1` | Permanent Address Line 1 | `text` | Conditional | `applicant_profile` | Shown if `same_as_present_address` = false |
| Basic Details | `permanent_address_line2` | Permanent Address Line 2 | `text` | Optional | `applicant_profile` | Apartment/Suite |
| Basic Details | `permanent_village_town_city` | Permanent Village/Town/City | `text` | Conditional | `applicant_profile` | Shown if `same_as_present_address` = false |
| Basic Details | `permanent_district` | Permanent District | `text` | Optional | `applicant_profile` | District |
| Basic Details | `permanent_state_province` | Permanent State/Province | `text` | Conditional | `applicant_profile` | Shown if `same_as_present_address` = false |
| Basic Details | `permanent_country` | Permanent Country | `select` | Conditional | `applicant_profile` | Shown if `same_as_present_address` = false |
| Basic Details | `permanent_postal_code` | Permanent Postal/ZIP Code | `text` | Conditional | `applicant_profile` | Shown if `same_as_present_address` = false |

---

### Page 3: Family Details Page (`family-details`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Family Details | `father_name` | Father's Name | `text` | Required | `applicant_profile` | Full name |
| Family Details | `father_nationality` | Father's Nationality | `select` | Required | `applicant_profile` | Current nationality |
| Family Details | `father_previous_nationality` | Father's Previous Nationality | `select` | Optional | `applicant_profile` | If applicable |
| Family Details | `father_place_of_birth` | Father's Place of Birth | `text` | Required | `applicant_profile` | City of birth |
| Family Details | `father_country_of_birth` | Father's Country of Birth | `select` | Required | `applicant_profile` | Country of birth |
| Family Details | `mother_name` | Mother's Name | `text` | Required | `applicant_profile` | Full name |
| Family Details | `mother_nationality` | Mother's Nationality | `select` | Required | `applicant_profile` | Current nationality |
| Family Details | `mother_previous_nationality` | Mother's Previous Nationality | `select` | Optional | `applicant_profile` | If applicable |
| Family Details | `mother_place_of_birth` | Mother's Place of Birth | `text` | Required | `applicant_profile` | City of birth |
| Family Details | `mother_country_of_birth` | Mother's Country of Birth | `select` | Required | `applicant_profile` | Country of birth |
| Family Details | `spouse_name` | Spouse's Name | `text` | Optional | `applicant_profile` | Required if married |
| Family Details | `spouse_nationality` | Spouse's Nationality | `select` | Optional | `applicant_profile` | Current nationality |
| Family Details | `spouse_previous_nationality` | Spouse's Previous Nationality | `select` | Optional | `applicant_profile` | If applicable |
| Family Details | `spouse_place_of_birth` | Spouse's Place of Birth | `text` | Optional | `applicant_profile` | City of birth |
| Family Details | `spouse_country_of_birth` | Spouse's Country of Birth | `select` | Optional | `applicant_profile` | Country of birth |
| Family Details | `has_pakistan_relation` | Parents/Grandparents Pakistan relation inquiry | `radio` | Required | `applicant_profile` | Yes/No flag |
| Family Details | `pakistan_relation_details` | Pakistan Relation Details | `textarea` | Conditional | `applicant_profile` | Shown if `has_pakistan_relation` = true |

---

### Page 4: Visa Details Page (`visa-details`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Visa Details | `visa_type` | Type of Visa Required | `select` | Required | `india_visa_application` | e.g. Tourist, Business, Medical |
| Visa Details | `number_of_entries` | Number of Entries | `select` | Required | `india_visa_application` | Single / Double / Multiple |
| Visa Details | `period_of_visa` | Period of Visa (months) | `number` | Required | `india_visa_application` | Duration in months |
| Visa Details | `expected_date_of_journey` | Expected Date of Journey | `date` | Required | `india_visa_application` | Formatted YYYY-MM-DD |
| Visa Details | `port_of_arrival` | Port of Arrival | `select` | Required | `india_visa_application` | Indian immigration port |
| Visa Details | `port_of_exit` | Port of Exit | `select` | Optional | `india_visa_application` | Departure port |
| Visa Details | `places_to_be_visited` | Places to be Visited | `text` | Required | `india_visa_application` | Cities/destinations |
| Visa Details | `purpose_of_visit` | Purpose of Visit | `select` | Required | `india_visa_application` | Specific purpose |

---

### Page 5: Previous Visit Details Page (`previous-visit`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Previous Visit | `has_visited_india` | Have you ever visited India before? | `radio` | Required | `india_visa_application` | Yes/No flag |
| Previous Visit | `stay_address_in_india` | Address where stayed in India | `textarea` | Conditional | `india_visa_application` | Shown if `has_visited_india` = true |
| Previous Visit | `cities_visited_in_india` | Cities in India Visited | `text` | Conditional | `india_visa_application` | Shown if `has_visited_india` = true |
| Previous Visit | `previous_visa_type` | Previous Indian Visa Type | `select` | Conditional | `india_visa_application` | Shown if `has_visited_india` = true |
| Previous Visit | `previous_visa_number` | Previous Visa Number | `text` | Conditional | `india_visa_application` | Shown if `has_visited_india` = true |
| Previous Visit | `previous_visa_issued_place` | Previous Visa Issued Place | `text` | Conditional | `india_visa_application` | Shown if `has_visited_india` = true |
| Previous Visit | `previous_visa_date_of_issue` | Previous Visa Date of Issue | `date` | Conditional | `india_visa_application` | Formatted YYYY-MM-DD |
| Previous Visit | `countries_visited_last_10_years` | Countries Visited during Last 10 Years | `text` | Optional | `india_visa_application` | List of countries |
| Previous Visit | `has_been_refused_visa` | Has Indian Visa ever been refused? | `radio` | Required | `india_visa_application` | Yes/No flag |
| Previous Visit | `visa_refusal_details` | Visa Refusal Details | `textarea` | Conditional | `india_visa_application` | Shown if `has_been_refused_visa` = true |
| Previous Visit | `has_been_deported` | Have you ever been deported from India? | `radio` | Required | `india_visa_application` | Yes/No flag |
| Previous Visit | `deportation_details` | Deportation Details | `textarea` | Conditional | `india_visa_application` | Shown if `has_been_deported` = true |

---

### Page 6: Profession / Occupation Page (`profession`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Profession | `present_occupation` | Present Occupation | `select` | Required | `applicant_profile` | Occupation category |
| Profession | `designation_rank` | Designation / Rank | `text` | Required | `applicant_profile` | Job title |
| Profession | `employer_name` | Employer Name / Business | `text` | Required | `applicant_profile` | Company/Org name |
| Profession | `employer_address` | Employer Address | `text` | Required | `applicant_profile` | Address |
| Profession | `employer_phone` | Employer Phone Number | `text` | Required | `applicant_profile` | Office phone |
| Profession | `past_occupation` | Past Occupation | `select` | Optional | `applicant_profile` | Previous work |
| Profession | `has_military_service` | Worked with Armed Forces/Police/Para-Military? | `radio` | Required | `applicant_profile` | Yes/No flag |
| Profession | `military_organization` | Military Organization Name | `text` | Conditional | `applicant_profile` | Shown if `has_military_service` = true |
| Profession | `military_designation` | Military Designation | `text` | Conditional | `applicant_profile` | Shown if `has_military_service` = true |
| Profession | `military_place_of_posting` | Military Place of Posting | `text` | Conditional | `applicant_profile` | Shown if `has_military_service` = true |
| Profession | `military_rank` | Military Rank | `text` | Conditional | `applicant_profile` | Shown if `has_military_service` = true |

---

### Page 7: Accommodation / Place of Stay Page (`accommodation`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Accommodation | `acc_hotel_name` | Place / Hotel Name | `text` | Required | `india_visa_application` | First stay location |
| Accommodation | `acc_address` | Accommodation Address | `text` | Required | `india_visa_application` | Hotel/stay street address |
| Accommodation | `acc_state` | Accommodation State | `select` | Required | `india_visa_application` | Indian state |
| Accommodation | `acc_phone` | Accommodation Phone Number | `text` | Required | `india_visa_application` | Hotel contact phone |

---

### Page 8: References Page (`references`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| References | `ref_india_name` | India Reference Name | `text` | Required | `india_visa_application` | Contact person/hotel in India |
| References | `ref_india_address` | India Reference Address | `text` | Required | `india_visa_application` | Address in India |
| References | `ref_india_phone` | India Reference Phone | `text` | Required | `india_visa_application` | Indian phone number |
| References | `ref_bangladesh_name` | Home Country Reference Name | `text` | Required | `india_visa_application` | Home country reference |
| References | `ref_bangladesh_address` | Home Country Reference Address | `text` | Required | `india_visa_application` | Home country address |
| References | `ref_bangladesh_phone` | Home Country Reference Phone | `text` | Required | `india_visa_application` | Home country phone number |

---

### Page 9: Documents Page (`documents`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Documents | `doc_passport` | Passport Document Metadata | `text` | Required | `india_visa_application` | `documentId`, `fileName`, `uploadedAt` |
| Documents | `doc_photo` | Applicant Photo Metadata | `text` | Required | `india_visa_application` | `documentId`, `fileName`, `uploadedAt` |
| Documents | `doc_supporting` | Supporting Documents Metadata | `text` | Optional | `india_visa_application` | Optional attachments |

---

### Page 10: Declaration Page (`declaration`)

| Page | Field Identifier | Label / Question | Field Type | Requirement | Data Source | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Declaration | `dec_agreed` | Declaration Agreement | `checkbox` | Required | `india_visa_application` | Terms acceptance flag |
| Declaration | `dec_date` | Declaration Date | `date` | Required | `india_visa_application` | Formatted YYYY-MM-DD |

---

## 5. Field Mapping Architecture Specification

The mapping architecture decouples domain models from DOM execution logic. Each mapping rule is defined by `IndiaVisaFieldMapping`:

```typescript
export interface IndiaVisaFieldMapping {
  page: IndiaVisaPage
  fieldId: IndiaVisaFieldId
  label: string
  sourcePath: string
  dataSource: FieldDataSource
  fieldType: FieldType
  requirement: FieldRequirementStatus
  conditionallyDisplayed?: boolean
  conditionDescription?: string
  notes?: string
}
```

The mapping registry (`INDIA_VISA_FIELD_MAPPINGS` in `src/countries/india/visa/field-mapping.ts`) provides a complete field-by-field specification for all 10 pages without binding to fragile CSS or DOM selectors.
