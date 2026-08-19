export interface IndiaCountryConfig {
  countryCode: string
  countryName: string
  supportedDomains: string[]
  officialPortalUrl: string
}

export const INDIA_COUNTRY_CONFIG: IndiaCountryConfig = {
  countryCode: 'IND',
  countryName: 'India',
  supportedDomains: ['indianvisaonline.gov.in', 'indianvisa-bangladesh.nic.in'],
  officialPortalUrl: 'https://indianvisaonline.gov.in/',
}
