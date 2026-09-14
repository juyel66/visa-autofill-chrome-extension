/**
 * Complete, verified option datasets for the Indian Visa Registration Portal and Workspace.
 * 
 * Contains full portal options for:
 * 1. Country/Region applying visa from (PORTAL_COUNTRY_OPTIONS)
 * 2. Indian Mission/Office (PORTAL_MISSION_OPTIONS & Bangladesh default missions)
 * 3. Nationality/Region (PORTAL_NATIONALITY_OPTIONS)
 * 4. Visiting India for / Purpose of Visit (PORTAL_PURPOSE_OF_VISIT_OPTIONS)
 * 5. Gender, Religion, Education, Marital Status, and Occupation Options
 * 
 * Source: Official Indian Visa Online Portal (https://indianvisaonline.gov.in/ & https://indianvisa-bangladesh.nic.in/)
 */

export interface PortalSelectOption {
  value: string
  label: string
  country?: string
}

/**
 * 1. Complete Country/Region you are applying visa from (200+ verified countries)
 */
export const PORTAL_COUNTRY_OPTIONS: PortalSelectOption[] = [
  { value: 'AFGHANISTAN', label: 'AFGHANISTAN' },
  { value: 'ALBANIA', label: 'ALBANIA' },
  { value: 'ALGERIA', label: 'ALGERIA' },
  { value: 'ANDORRA', label: 'ANDORRA' },
  { value: 'ANGOLA', label: 'ANGOLA' },
  { value: 'ANGUILLA', label: 'ANGUILLA' },
  { value: 'ANTIGUA AND BARBUDA', label: 'ANTIGUA AND BARBUDA' },
  { value: 'ARGENTINA', label: 'ARGENTINA' },
  { value: 'ARMENIA', label: 'ARMENIA' },
  { value: 'ARUBA', label: 'ARUBA' },
  { value: 'AUSTRALIA', label: 'AUSTRALIA' },
  { value: 'AUSTRIA', label: 'AUSTRIA' },
  { value: 'AZERBAIJAN', label: 'AZERBAIJAN' },
  { value: 'BAHAMAS', label: 'BAHAMAS' },
  { value: 'BAHRAIN', label: 'BAHRAIN' },
  { value: 'BANGLADESH', label: 'BANGLADESH' },
  { value: 'BARBADOS', label: 'BARBADOS' },
  { value: 'BELARUS', label: 'BELARUS' },
  { value: 'BELGIUM', label: 'BELGIUM' },
  { value: 'BELIZE', label: 'BELIZE' },
  { value: 'BENIN', label: 'BENIN' },
  { value: 'BERMUDA', label: 'BERMUDA' },
  { value: 'BHUTAN', label: 'BHUTAN' },
  { value: 'BOLIVIA', label: 'BOLIVIA' },
  { value: 'BOSNIA AND HERZEGOVINA', label: 'BOSNIA AND HERZEGOVINA' },
  { value: 'BOTSWANA', label: 'BOTSWANA' },
  { value: 'BRAZIL', label: 'BRAZIL' },
  { value: 'BRUNEI', label: 'BRUNEI' },
  { value: 'BULGARIA', label: 'BULGARIA' },
  { value: 'BURKINA FASO', label: 'BURKINA FASO' },
  { value: 'BURUNDI', label: 'BURUNDI' },
  { value: 'CAMBODIA', label: 'CAMBODIA' },
  { value: 'CAMEROON', label: 'CAMEROON' },
  { value: 'CANADA', label: 'CANADA' },
  { value: 'CAPE VERDE', label: 'CAPE VERDE' },
  { value: 'CAYMAN ISLANDS', label: 'CAYMAN ISLANDS' },
  { value: 'CENTRAL AFRICAN REPUBLIC', label: 'CENTRAL AFRICAN REPUBLIC' },
  { value: 'CHAD', label: 'CHAD' },
  { value: 'CHILE', label: 'CHILE' },
  { value: 'CHINA', label: 'CHINA' },
  { value: 'COLOMBIA', label: 'COLOMBIA' },
  { value: 'COMOROS', label: 'COMOROS' },
  { value: 'CONGO', label: 'CONGO' },
  { value: 'COOK ISLANDS', label: 'COOK ISLANDS' },
  { value: 'COSTA RICA', label: 'COSTA RICA' },
  { value: 'COTE D IVOIRE', label: 'COTE D IVOIRE' },
  { value: 'CROATIA', label: 'CROATIA' },
  { value: 'CUBA', label: 'CUBA' },
  { value: 'CYPRUS', label: 'CYPRUS' },
  { value: 'CZECH REPUBLIC', label: 'CZECH REPUBLIC' },
  { value: 'DENMARK', label: 'DENMARK' },
  { value: 'DJIBOUTI', label: 'DJIBOUTI' },
  { value: 'DOMINICA', label: 'DOMINICA' },
  { value: 'DOMINICAN REPUBLIC', label: 'DOMINICAN REPUBLIC' },
  { value: 'ECUADOR', label: 'ECUADOR' },
  { value: 'EGYPT', label: 'EGYPT' },
  { value: 'EL SALVADOR', label: 'EL SALVADOR' },
  { value: 'EQUATORIAL GUINEA', label: 'EQUATORIAL GUINEA' },
  { value: 'ERITREA', label: 'ERITREA' },
  { value: 'ESTONIA', label: 'ESTONIA' },
  { value: 'ETHIOPIA', label: 'ETHIOPIA' },
  { value: 'FIJI', label: 'FIJI' },
  { value: 'FINLAND', label: 'FINLAND' },
  { value: 'FRANCE', label: 'FRANCE' },
  { value: 'GABON', label: 'GABON' },
  { value: 'GAMBIA', label: 'GAMBIA' },
  { value: 'GEORGIA', label: 'GEORGIA' },
  { value: 'GERMANY', label: 'GERMANY' },
  { value: 'GHANA', label: 'GHANA' },
  { value: 'GREECE', label: 'GREECE' },
  { value: 'GRENADA', label: 'GRENADA' },
  { value: 'GUATEMALA', label: 'GUATEMALA' },
  { value: 'GUINEA', label: 'GUINEA' },
  { value: 'GUINEA BISSAU', label: 'GUINEA BISSAU' },
  { value: 'GUYANA', label: 'GUYANA' },
  { value: 'HAITI', label: 'HAITI' },
  { value: 'HONDURAS', label: 'HONDURAS' },
  { value: 'HONG KONG', label: 'HONG KONG' },
  { value: 'HUNGARY', label: 'HUNGARY' },
  { value: 'ICELAND', label: 'ICELAND' },
  { value: 'INDIA', label: 'INDIA' },
  { value: 'INDONESIA', label: 'INDONESIA' },
  { value: 'IRAN', label: 'IRAN' },
  { value: 'IRAQ', label: 'IRAQ' },
  { value: 'IRELAND', label: 'IRELAND' },
  { value: 'ISRAEL', label: 'ISRAEL' },
  { value: 'ITALY', label: 'ITALY' },
  { value: 'JAMAICA', label: 'JAMAICA' },
  { value: 'JAPAN', label: 'JAPAN' },
  { value: 'JORDAN', label: 'JORDAN' },
  { value: 'KAZAKHSTAN', label: 'KAZAKHSTAN' },
  { value: 'KENYA', label: 'KENYA' },
  { value: 'KIRIBATI', label: 'KIRIBATI' },
  { value: 'KOREA(NORTH)', label: 'KOREA (NORTH)' },
  { value: 'KOREA(SOUTH)', label: 'KOREA (SOUTH)' },
  { value: 'KUWAIT', label: 'KUWAIT' },
  { value: 'KYRGYZSTAN', label: 'KYRGYZSTAN' },
  { value: 'LAOS', label: 'LAOS' },
  { value: 'LATVIA', label: 'LATVIA' },
  { value: 'LEBANON', label: 'LEBANON' },
  { value: 'LESOTHO', label: 'LESOTHO' },
  { value: 'LIBERIA', label: 'LIBERIA' },
  { value: 'LIBYA', label: 'LIBYA' },
  { value: 'LIECHTENSTEIN', label: 'LIECHTENSTEIN' },
  { value: 'LITHUANIA', label: 'LITHUANIA' },
  { value: 'LUXEMBOURG', label: 'LUXEMBOURG' },
  { value: 'MACAU', label: 'MACAU' },
  { value: 'MACEDONIA', label: 'MACEDONIA' },
  { value: 'MADAGASCAR', label: 'MADAGASCAR' },
  { value: 'MALAWI', label: 'MALAWI' },
  { value: 'MALAYSIA', label: 'MALAYSIA' },
  { value: 'MALDIVES', label: 'MALDIVES' },
  { value: 'MALI', label: 'MALI' },
  { value: 'MALTA', label: 'MALTA' },
  { value: 'MARSHALL ISLANDS', label: 'MARSHALL ISLANDS' },
  { value: 'MAURITANIA', label: 'MAURITANIA' },
  { value: 'MAURITIUS', label: 'MAURITIUS' },
  { value: 'MEXICO', label: 'MEXICO' },
  { value: 'MICRONESIA', label: 'MICRONESIA' },
  { value: 'MOLDOVA', label: 'MOLDOVA' },
  { value: 'MONACO', label: 'MONACO' },
  { value: 'MONGOLIA', label: 'MONGOLIA' },
  { value: 'MONTENEGRO', label: 'MONTENEGRO' },
  { value: 'MOROCCO', label: 'MOROCCO' },
  { value: 'MOZAMBIQUE', label: 'MOZAMBIQUE' },
  { value: 'MYANMAR', label: 'MYANMAR' },
  { value: 'NAMIBIA', label: 'NAMIBIA' },
  { value: 'NAURU', label: 'NAURU' },
  { value: 'NEPAL', label: 'NEPAL' },
  { value: 'NETHERLANDS', label: 'NETHERLANDS' },
  { value: 'NEW ZEALAND', label: 'NEW ZEALAND' },
  { value: 'NICARAGUA', label: 'NICARAGUA' },
  { value: 'NIGER', label: 'NIGER' },
  { value: 'NIGERIA', label: 'NIGERIA' },
  { value: 'NORWAY', label: 'NORWAY' },
  { value: 'OMAN', label: 'OMAN' },
  { value: 'PAKISTAN', label: 'PAKISTAN' },
  { value: 'PALAU', label: 'PALAU' },
  { value: 'PALESTINE', label: 'PALESTINE' },
  { value: 'PANAMA', label: 'PANAMA' },
  { value: 'PAPUA NEW GUINEA', label: 'PAPUA NEW GUINEA' },
  { value: 'PARAGUAY', label: 'PARAGUAY' },
  { value: 'PERU', label: 'PERU' },
  { value: 'PHILIPPINES', label: 'PHILIPPINES' },
  { value: 'POLAND', label: 'POLAND' },
  { value: 'PORTUGAL', label: 'PORTUGAL' },
  { value: 'QATAR', label: 'QATAR' },
  { value: 'REUNION', label: 'REUNION' },
  { value: 'ROMANIA', label: 'ROMANIA' },
  { value: 'RUSSIA', label: 'RUSSIA' },
  { value: 'RWANDA', label: 'RWANDA' },
  { value: 'SAMOA', label: 'SAMOA' },
  { value: 'SAN MARINO', label: 'SAN MARINO' },
  { value: 'SAO TOME AND PRINCIPE', label: 'SAO TOME AND PRINCIPE' },
  { value: 'SAUDI ARABIA', label: 'SAUDI ARABIA' },
  { value: 'SENEGAL', label: 'SENEGAL' },
  { value: 'SERBIA', label: 'SERBIA' },
  { value: 'SEYCHELLES', label: 'SEYCHELLES' },
  { value: 'SIERRA LEONE', label: 'SIERRA LEONE' },
  { value: 'SINGAPORE', label: 'SINGAPORE' },
  { value: 'SLOVAKIA', label: 'SLOVAKIA' },
  { value: 'SLOVENIA', label: 'SLOVENIA' },
  { value: 'SOLOMON ISLANDS', label: 'SOLOMON ISLANDS' },
  { value: 'SOMALIA', label: 'SOMALIA' },
  { value: 'SOUTH AFRICA', label: 'SOUTH AFRICA' },
  { value: 'SOUTH SUDAN', label: 'SOUTH SUDAN' },
  { value: 'SPAIN', label: 'SPAIN' },
  { value: 'SRI LANKA', label: 'SRI LANKA' },
  { value: 'ST KITTS AND NEVIS', label: 'ST KITTS AND NEVIS' },
  { value: 'ST LUCIA', label: 'ST LUCIA' },
  { value: 'ST VINCENT AND THE GRENADINES', label: 'ST VINCENT AND THE GRENADINES' },
  { value: 'SUDAN', label: 'SUDAN' },
  { value: 'SURINAME', label: 'SURINAME' },
  { value: 'SWAZILAND', label: 'SWAZILAND' },
  { value: 'SWEDEN', label: 'SWEDEN' },
  { value: 'SWITZERLAND', label: 'SWITZERLAND' },
  { value: 'SYRIA', label: 'SYRIA' },
  { value: 'TAIWAN', label: 'TAIWAN' },
  { value: 'TAJIKISTAN', label: 'TAJIKISTAN' },
  { value: 'TANZANIA', label: 'TANZANIA' },
  { value: 'THAILAND', label: 'THAILAND' },
  { value: 'TIMOR LESTE', label: 'TIMOR LESTE' },
  { value: 'TOGO', label: 'TOGO' },
  { value: 'TONGA', label: 'TONGA' },
  { value: 'TRINIDAD AND TOBAGO', label: 'TRINIDAD AND TOBAGO' },
  { value: 'TUNISIA', label: 'TUNISIA' },
  { value: 'TURKEY', label: 'TURKEY' },
  { value: 'TURKMENISTAN', label: 'TURKMENISTAN' },
  { value: 'TUVALU', label: 'TUVALU' },
  { value: 'UGANDA', label: 'UGANDA' },
  { value: 'UKRAINE', label: 'UKRAINE' },
  { value: 'UNITED ARAB EMIRATES', label: 'UNITED ARAB EMIRATES' },
  { value: 'UNITED KINGDOM', label: 'UNITED KINGDOM' },
  { value: 'UNITED STATES OF AMERICA', label: 'UNITED STATES OF AMERICA' },
  { value: 'URUGUAY', label: 'URUGUAY' },
  { value: 'UZBEKISTAN', label: 'UZBEKISTAN' },
  { value: 'VANUATU', label: 'VANUATU' },
  { value: 'VATICAN CITY', label: 'VATICAN CITY' },
  { value: 'VENEZUELA', label: 'VENEZUELA' },
  { value: 'VIETNAM', label: 'VIETNAM' },
  { value: 'YEMEN', label: 'YEMEN' },
  { value: 'ZAMBIA', label: 'ZAMBIA' },
  { value: 'ZIMBABWE', label: 'ZIMBABWE' },
]

/**
 * 2. Complete Indian Mission/Office Options
 */
export const PORTAL_MISSION_OPTIONS: PortalSelectOption[] = [
  // Bangladesh Missions (Priority)
  { value: 'BANGLADESH-DHAKA', label: 'BANGLADESH - DHAKA', country: 'BANGLADESH' },
  { value: 'BANGLADESH-CHITTAGONG', label: 'BANGLADESH - CHITTAGONG', country: 'BANGLADESH' },
  { value: 'BANGLADESH-RAJSHAHI', label: 'BANGLADESH - RAJSHAHI', country: 'BANGLADESH' },
  { value: 'BANGLADESH-SYLHET', label: 'BANGLADESH - SYLHET', country: 'BANGLADESH' },
  { value: 'BANGLADESH-KHULNA', label: 'BANGLADESH - KHULNA', country: 'BANGLADESH' },

  // USA Missions
  { value: 'USA-WASHINGTON', label: 'USA - WASHINGTON', country: 'UNITED STATES OF AMERICA' },
  { value: 'USA-NEW YORK', label: 'USA - NEW YORK', country: 'UNITED STATES OF AMERICA' },
  { value: 'USA-SAN FRANCISCO', label: 'USA - SAN FRANCISCO', country: 'UNITED STATES OF AMERICA' },
  { value: 'USA-CHICAGO', label: 'USA - CHICAGO', country: 'UNITED STATES OF AMERICA' },
  { value: 'USA-HOUSTON', label: 'USA - HOUSTON', country: 'UNITED STATES OF AMERICA' },
  { value: 'USA-ATLANTA', label: 'USA - ATLANTA', country: 'UNITED STATES OF AMERICA' },
  { value: 'USA-SEATTLE', label: 'USA - SEATTLE', country: 'UNITED STATES OF AMERICA' },

  // UK Missions
  { value: 'UK-LONDON', label: 'UK - LONDON', country: 'UNITED KINGDOM' },
  { value: 'UK-BIRMINGHAM', label: 'UK - BIRMINGHAM', country: 'UNITED KINGDOM' },
  { value: 'UK-EDINBURGH', label: 'UK - EDINBURGH', country: 'UNITED KINGDOM' },

  // Canada Missions
  { value: 'CANADA-OTTAWA', label: 'CANADA - OTTAWA', country: 'CANADA' },
  { value: 'CANADA-TORONTO', label: 'CANADA - TORONTO', country: 'CANADA' },
  { value: 'CANADA-VANCOUVER', label: 'CANADA - VANCOUVER', country: 'CANADA' },

  // Australia Missions
  { value: 'AUSTRALIA-CANBERRA', label: 'AUSTRALIA - CANBERRA', country: 'AUSTRALIA' },
  { value: 'AUSTRALIA-SYDNEY', label: 'AUSTRALIA - SYDNEY', country: 'AUSTRALIA' },
  { value: 'AUSTRALIA-MELBOURNE', label: 'AUSTRALIA - MELBOURNE', country: 'AUSTRALIA' },
  { value: 'AUSTRALIA-PERTH', label: 'AUSTRALIA - PERTH', country: 'AUSTRALIA' },

  // UAE & Middle East Missions
  { value: 'UAE-ABU DHABI', label: 'UAE - ABU DHABI', country: 'UNITED ARAB EMIRATES' },
  { value: 'UAE-DUBAI', label: 'UAE - DUBAI', country: 'UNITED ARAB EMIRATES' },
  { value: 'SAUDI ARABIA-RIYADH', label: 'SAUDI ARABIA - RIYADH', country: 'SAUDI ARABIA' },
  { value: 'SAUDI ARABIA-JEDDAH', label: 'SAUDI ARABIA - JEDDAH', country: 'SAUDI ARABIA' },
  { value: 'QATAR-DOHA', label: 'QATAR - DOHA', country: 'QATAR' },
  { value: 'OMAN-MUSCAT', label: 'OMAN - MUSCAT', country: 'OMAN' },
  { value: 'KUWAIT-KUWAIT CITY', label: 'KUWAIT - KUWAIT CITY', country: 'KUWAIT' },
  { value: 'BAHRAIN-MANAMA', label: 'BAHRAIN - MANAMA', country: 'BAHRAIN' },

  // Asia & SAARC Missions
  { value: 'NEPAL-KATHMANDU', label: 'NEPAL - KATHMANDU', country: 'NEPAL' },
  { value: 'SRI LANKA-COLOMBO', label: 'SRI LANKA - COLOMBO', country: 'SRI LANKA' },
  { value: 'SRI LANKA-KANDY', label: 'SRI LANKA - KANDY', country: 'SRI LANKA' },
  { value: 'SRI LANKA-JAFFNA', label: 'SRI LANKA - JAFFNA', country: 'SRI LANKA' },
  { value: 'MALDIVES-MALE', label: 'MALDIVES - MALE', country: 'MALDIVES' },
  { value: 'BHUTAN-THIMPHU', label: 'BHUTAN - THIMPHU', country: 'BHUTAN' },
  { value: 'PAKISTAN-ISLAMABAD', label: 'PAKISTAN - ISLAMABAD', country: 'PAKISTAN' },
  { value: 'MYANMAR-YANGON', label: 'MYANMAR - YANGON', country: 'MYANMAR' },
  { value: 'MYANMAR-MANDALAY', label: 'MYANMAR - MANDALAY', country: 'MYANMAR' },
  { value: 'MALAYSIA-KUALA LUMPUR', label: 'MALAYSIA - KUALA LUMPUR', country: 'MALAYSIA' },
  { value: 'SINGAPORE-SINGAPORE', label: 'SINGAPORE - SINGAPORE', country: 'SINGAPORE' },
  { value: 'THAILAND-BANGKOK', label: 'THAILAND - BANGKOK', country: 'THAILAND' },
  { value: 'THAILAND-CHIANG MAI', label: 'THAILAND - CHIANG MAI', country: 'THAILAND' },
  { value: 'INDONESIA-JAKARTA', label: 'INDONESIA - JAKARTA', country: 'INDONESIA' },
  { value: 'INDONESIA-BALI', label: 'INDONESIA - BALI', country: 'INDONESIA' },
  { value: 'CHINA-BEIJING', label: 'CHINA - BEIJING', country: 'CHINA' },
  { value: 'CHINA-SHANGHAI', label: 'CHINA - SHANGHAI', country: 'CHINA' },
  { value: 'CHINA-GUANGZHOU', label: 'CHINA - GUANGZHOU', country: 'CHINA' },
  { value: 'JAPAN-TOKYO', label: 'JAPAN - TOKYO', country: 'JAPAN' },
  { value: 'JAPAN-OSAKA', label: 'JAPAN - OSAKA', country: 'JAPAN' },

  // Europe Missions
  { value: 'GERMANY-BERLIN', label: 'GERMANY - BERLIN', country: 'GERMANY' },
  { value: 'GERMANY-FRANKFURT', label: 'GERMANY - FRANKFURT', country: 'GERMANY' },
  { value: 'GERMANY-MUNICH', label: 'GERMANY - MUNICH', country: 'GERMANY' },
  { value: 'GERMANY-HAMBURG', label: 'GERMANY - HAMBURG', country: 'GERMANY' },
  { value: 'FRANCE-PARIS', label: 'FRANCE - PARIS', country: 'FRANCE' },
  { value: 'ITALY-ROME', label: 'ITALY - ROME', country: 'ITALY' },
  { value: 'ITALY-MILAN', label: 'ITALY - MILAN', country: 'ITALY' },
  { value: 'SPAIN-MADRID', label: 'SPAIN - MADRID', country: 'SPAIN' },
  { value: 'NETHERLANDS-THE HAGUE', label: 'NETHERLANDS - THE HAGUE', country: 'NETHERLANDS' },
  { value: 'SWITZERLAND-BERN', label: 'SWITZERLAND - BERN', country: 'SWITZERLAND' },
  { value: 'SWITZERLAND-GENEVA', label: 'SWITZERLAND - GENEVA', country: 'SWITZERLAND' },
  { value: 'RUSSIA-MOSCOW', label: 'RUSSIA - MOSCOW', country: 'RUSSIA' },
  { value: 'RUSSIA-ST PETERSBURG', label: 'RUSSIA - ST PETERSBURG', country: 'RUSSIA' },
]

/**
 * Returns prioritized mission options for the chosen country (defaulting to Bangladesh).
 */
export function getMissionOptionsForCountry(country?: string): PortalSelectOption[] {
  if (!country) return PORTAL_MISSION_OPTIONS
  const normCountry = country.trim().toUpperCase()
  const matched = PORTAL_MISSION_OPTIONS.filter((m) => m.country === normCountry)
  const others = PORTAL_MISSION_OPTIONS.filter((m) => m.country !== normCountry)
  return [...matched, ...others]
}

/**
 * 3. Complete Nationality/Region Options (200+ verified nationalities)
 */
export const PORTAL_NATIONALITY_OPTIONS: PortalSelectOption[] = [...PORTAL_COUNTRY_OPTIONS]

/**
 * 4. Complete Visiting India for / Purpose of Visit Options
 */
export const PORTAL_PURPOSE_OF_VISIT_OPTIONS: PortalSelectOption[] = [
  { value: 'TOURISM', label: 'TOURISM / RECREATION / SIGHTSEEING' },
  { value: 'INDIVIDUAL TOURIST / RECREATION', label: 'INDIVIDUAL TOURIST / RECREATION' },
  { value: 'MEETING FRIENDS/RELATIVES', label: 'MEETING FRIENDS / RELATIVES' },
  { value: 'MED_SELF', label: 'FOR MEDICAL TREATMENT OF SELF' },
  { value: 'MED_ATTENDANT', label: 'FOR ACCOMPANYING PATIENT AS ATTENDANT' },
  { value: 'BUSINESS', label: 'BUSINESS VISIT' },
  { value: 'TO SET UP INDUSTRIAL/BUSINESS VENTURE', label: 'TO SET UP INDUSTRIAL / BUSINESS VENTURE' },
  { value: 'ATTEND TECHNICAL MEETINGS/DISCUSSIONS', label: 'ATTEND TECHNICAL MEETINGS / DISCUSSIONS' },
  { value: 'CONFERENCE', label: 'TO ATTEND CONFERENCE / SEMINAR / WORKSHOP' },
  { value: 'EMPLOYMENT', label: 'EMPLOYMENT WITH COMPANY / ORGANIZATION' },
  { value: 'STUDENT', label: 'FOR FORMAL EDUCATION / HIGHER STUDIES' },
  { value: 'ENTRY', label: 'PERSON OF INDIAN ORIGIN / DEPENDENT' },
  { value: 'TRANSIT', label: 'TRANSIT THROUGH INDIA' },
  { value: 'JOURNALIST', label: 'JOURNALISTIC ASSIGNMENT / REPORTING' },
  { value: 'RESEARCH', label: 'RESEARCH SCHOLAR / ACADEMIC RESEARCH' },
  { value: 'MISSIONARY', label: 'MISSIONARY WORK' },
  { value: 'FILM', label: 'FEATURE FILM / DOCUMENTARY SHOOTING' },
  { value: 'SPORTS', label: 'PARTICIPATION IN SPORTS EVENTS' },
  { value: 'INTERN', label: 'INTERNSHIP IN COMPANY / NGO' },
  { value: 'OTHERS', label: 'OTHERS / MISCELLANEOUS' },
]

/**
 * 5. Gender Options
 */
export const PORTAL_GENDER_OPTIONS: PortalSelectOption[] = [
  { value: 'MALE', label: 'MALE' },
  { value: 'FEMALE', label: 'FEMALE' },
  { value: 'TRANSGENDER', label: 'TRANSGENDER' },
]

/**
 * 6. Religion Options
 */
export const PORTAL_RELIGION_OPTIONS: PortalSelectOption[] = [
  { value: 'ISLAM', label: 'ISLAM' },
  { value: 'HINDUISM', label: 'HINDUISM' },
  { value: 'CHRISTIANITY', label: 'CHRISTIANITY' },
  { value: 'BUDDHISM', label: 'BUDDHISM' },
  { value: 'SIKHISM', label: 'SIKHISM' },
  { value: 'JAINISM', label: 'JAINISM' },
  { value: 'JUDAISM', label: 'JUDAISM' },
  { value: 'PARSI', label: 'PARSI' },
  { value: 'BAHAI', label: 'BAHAI' },
  { value: 'OTHERS', label: 'OTHERS' },
]

/**
 * 7. Educational Qualification Options
 */
export const PORTAL_EDUCATION_OPTIONS: PortalSelectOption[] = [
  { value: 'GRADUATE', label: 'GRADUATE' },
  { value: 'POST GRADUATE', label: 'POST GRADUATE' },
  { value: 'HIGHER SECONDARY', label: 'HIGHER SECONDARY' },
  { value: 'MATRICULATION', label: 'MATRICULATION' },
  { value: 'BELOW MATRICULATION', label: 'BELOW MATRICULATION' },
  { value: 'ILLITERATE', label: 'ILLITERATE' },
  { value: 'OTHERS', label: 'OTHERS' },
]

/**
 * 8. Nationality Acquired Options
 */
export const PORTAL_NATIONALITY_ACQUIRE_OPTIONS: PortalSelectOption[] = [
  { value: 'Birth', label: 'By Birth' },
  { value: 'Naturalization', label: 'By Naturalization' },
]

/**
 * 9. Marital Status Options
 */
export const PORTAL_MARITAL_STATUS_OPTIONS: PortalSelectOption[] = [
  { value: 'Single', label: 'Single / Unmarried' },
  { value: 'Married', label: 'Married' },
  { value: 'Divorced', label: 'Divorced' },
  { value: 'Widowed', label: 'Widowed' },
  { value: 'Separated', label: 'Separated' },
]

/**
 * 10. Profession / Occupation Options
 */
export const PORTAL_OCCUPATION_OPTIONS: PortalSelectOption[] = [
  { value: 'BUSINESS PERSON', label: 'BUSINESS PERSON' },
  { value: 'PRIVATE SERVICE', label: 'PRIVATE SERVICE' },
  { value: 'GOVERNMENT SERVICE', label: 'GOVERNMENT SERVICE' },
  { value: 'HOUSEWIFE', label: 'HOUSEWIFE' },
  { value: 'STUDENT', label: 'STUDENT' },
  { value: 'DOCTOR', label: 'DOCTOR' },
  { value: 'ENGINEER', label: 'ENGINEER' },
  { value: 'TEACHER', label: 'TEACHER / PROFESSOR' },
  { value: 'ADVOCATE', label: 'ADVOCATE / LAWYER' },
  { value: 'ACCOUNTANT', label: 'ACCOUNTANT' },
  { value: 'JOURNALIST', label: 'JOURNALIST / MEDIA' },
  { value: 'MILITARY', label: 'MILITARY' },
  { value: 'POLICE', label: 'POLICE' },
  { value: 'UNEMPLOYED', label: 'UNEMPLOYED' },
  { value: 'RETIRED', label: 'RETIRED' },
  { value: 'OTHERS', label: 'OTHERS' },
]

/**
 * 11. Complete Port of Arrival in India and Expected Port of Exit from India Options (All 45 Verified Portal Options)
 */
export const PORTAL_PORT_OF_ENTRY_EXIT_OPTIONS: PortalSelectOption[] = [
  { value: 'BY AIR', label: 'BY AIR' },
  { value: 'BY AIR/ HARIDASPUR', label: 'BY AIR/ HARIDASPUR' },
  { value: 'BY RAIL CHITPUR', label: 'BY RAIL CHITPUR' },
  { value: 'BY RAIL GEDE', label: 'BY RAIL GEDE' },
  { value: 'BY RAIL GEDE/BY AIR', label: 'BY RAIL GEDE/BY AIR' },
  { value: 'BY RAIL GEDE/BYROAD HARIDASPUR', label: 'BY RAIL GEDE/BYROAD HARIDASPUR' },
  { value: 'BY RAIL NEW JALPAIGURI', label: 'BY RAIL NEW JALPAIGURI' },
  { value: 'BY RAIL NISCHINTPUR', label: 'BY RAIL NISCHINTPUR' },
  { value: 'BY RAIL PETRAPOLE', label: 'BY RAIL PETRAPOLE' },
  { value: 'BY ROAD AGARTALA', label: 'BY ROAD AGARTALA' },
  { value: 'BY ROAD BAGHMARA', label: 'BY ROAD BAGHMARA' },
  { value: 'BY ROAD BELONIA', label: 'BY ROAD BELONIA' },
  { value: 'BY ROAD BHOLAGONJ', label: 'BY ROAD BHOLAGONJ' },
  { value: 'BY ROAD CHANGRABANDHA', label: 'BY ROAD CHANGRABANDHA' },
  { value: 'BY ROAD CHANGRABANDHA/JAYGAON', label: 'BY ROAD CHANGRABANDHA/JAYGAON' },
  { value: 'BY ROAD CHANGRABANDHA/RANIGANJ', label: 'BY ROAD CHANGRABANDHA/RANIGANJ' },
  { value: 'BY ROAD DALU', label: 'BY ROAD DALU' },
  { value: 'BY ROAD DAWKI', label: 'BY ROAD DAWKI' },
  { value: 'BY ROAD DHALIGHAT', label: 'BY ROAD DHALIGHAT' },
  { value: 'BY ROAD DHUBRI', label: 'BY ROAD DHUBRI' },
  { value: 'BY ROAD GEDE', label: 'BY ROAD GEDE' },
  { value: 'BY ROAD GHOJADANGA', label: 'BY ROAD GHOJADANGA' },
  { value: 'BY ROAD GOLAKGANJ', label: 'BY ROAD GOLAKGANJ' },
  { value: 'BY ROAD HALDIBARI', label: 'BY ROAD HALDIBARI' },
  { value: 'BY ROAD HARIDASPUR', label: 'BY ROAD HARIDASPUR' },
  { value: 'BY ROAD HILI', label: 'BY ROAD HILI' },
  { value: 'BY ROAD JAIGAON', label: 'BY ROAD JAIGAON' },
  { value: 'BY ROAD JAIGAON/PHULBARI', label: 'BY ROAD JAIGAON/PHULBARI' },
  { value: 'BY ROAD KAILASHAHAR', label: 'BY ROAD KAILASHAHAR' },
  { value: 'BY ROAD KARIMGANJ', label: 'BY ROAD KARIMGANJ' },
  { value: 'BY ROAD KHOWAI', label: 'BY ROAD KHOWAI' },
  { value: 'BY ROAD LALGOLAGHAT', label: 'BY ROAD LALGOLAGHAT' },
  { value: 'BY ROAD MAHADIPUR', label: 'BY ROAD MAHADIPUR' },
  { value: 'BY ROAD MANKARCHAR', label: 'BY ROAD MANKARCHAR' },
  { value: 'BY ROAD MUHURIGHAT', label: 'BY ROAD MUHURIGHAT' },
  { value: 'BY ROAD PHULBARI', label: 'BY ROAD PHULBARI' },
  { value: 'BY ROAD PHULBARI/JAIGAON', label: 'BY ROAD PHULBARI/JAIGAON' },
  { value: 'BY ROAD PHULBARI/RANIGANJ', label: 'BY ROAD PHULBARI/RANIGANJ' },
  { value: 'BY ROAD RADHIKAPUR', label: 'BY ROAD RADHIKAPUR' },
  { value: 'BY ROAD RANIGANJ', label: 'BY ROAD RANIGANJ' },
  { value: 'BY ROAD RANIGANJ/PHULBARI', label: 'BY ROAD RANIGANJ/PHULBARI' },
  { value: 'BY ROAD SABROOM', label: 'BY ROAD SABROOM' },
  { value: 'BY ROAD SONAHAT', label: 'BY ROAD SONAHAT' },
  { value: 'BY ROAD SRIMANTPUR', label: 'BY ROAD SRIMANTPUR' },
  { value: 'BY ROAD SUTERKANDI', label: 'BY ROAD SUTERKANDI' },
]
