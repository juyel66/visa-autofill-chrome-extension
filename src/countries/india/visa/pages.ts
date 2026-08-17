export type IndiaVisaPage =
  | 'registration'
  | 'basic-details'
  | 'family-details'
  | 'visa-details'
  | 'previous-visit'
  | 'profession'
  | 'accommodation'
  | 'references'
  | 'documents'
  | 'declaration'
  | 'unknown'

export interface IndiaVisaPageMeta {
  id: IndiaVisaPage
  stepNumber: number
  title: string
  description: string
}

export const INDIA_VISA_PAGES: IndiaVisaPageMeta[] = [
  {
    id: 'registration',
    stepNumber: 1,
    title: 'Registration',
    description: 'Initial application setup, mission selection, and CAPTCHA verification',
  },
  {
    id: 'basic-details',
    stepNumber: 2,
    title: 'Basic Details',
    description: 'Personal details, citizenship, and passport information',
  },
  {
    id: 'family-details',
    stepNumber: 3,
    title: 'Family Details',
    description: 'Father, Mother, Spouse, and Pakistan relation information',
  },
  {
    id: 'visa-details',
    stepNumber: 4,
    title: 'Visa Details',
    description: 'Type of visa, duration, ports of entry/exit, and purpose of visit',
  },
  {
    id: 'previous-visit',
    stepNumber: 5,
    title: 'Previous Visit Details',
    description: 'History of previous visits to India, travel history, and visa refusals',
  },
  {
    id: 'profession',
    stepNumber: 6,
    title: 'Profession / Occupation',
    description: 'Current occupation, employer details, and military/security background',
  },
  {
    id: 'accommodation',
    stepNumber: 7,
    title: 'Accommodation / Place of Stay',
    description: 'Hotels or place of stay details in India',
  },
  {
    id: 'references',
    stepNumber: 8,
    title: 'References',
    description: 'Reference contacts in India and home country',
  },
  {
    id: 'documents',
    stepNumber: 9,
    title: 'Documents',
    description: 'Upload metadata for passport, photo, and supporting documents',
  },
  {
    id: 'declaration',
    stepNumber: 10,
    title: 'Declaration / Final Application',
    description: 'Final verification, terms declaration, and application completion',
  },
]
