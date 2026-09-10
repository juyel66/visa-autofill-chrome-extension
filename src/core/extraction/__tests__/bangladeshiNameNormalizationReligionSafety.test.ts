import {
  BANGLADESHI_PREFIX_TITLE_VARIANTS,
  BANGLADESHI_SURNAME_VARIANTS,
  BANGLADESHI_MUSLIM_COMMON_NAME_TOKENS,
  isBangladeshiPrefixOrTitle,
  isBangladeshiSurname,
  normalizeNameString,
  splitBangladeshiFullName,
  correctNameOcrNoise,
} from '../../normalization/bangladeshiNameNormalizer'
import { extractFromPdfText } from '../data/applicantDataExtractor'
import { populateApplicationFromDocuments } from '../../application/applicationMerger'
import type { DocumentRecord } from '../../document/types'

export async function runBangladeshiNameNormalizationReligionSafetyTests(): Promise<{
  passed: boolean
  totalSubtests: number
  failures: string[]
}> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(`FAIL: [NameNormalizationSafety] ${message}`)
      console.error(`  ✗ FAIL: ${message}`)
    } else {
      console.log(`  ✓ PASS: ${message}`)
    }
  }

  console.log('\n--- 1. PREFIX & TITLE DETECTION ---')
  assert(
    BANGLADESHI_PREFIX_TITLE_VARIANTS.length > 0,
    'BANGLADESHI_PREFIX_TITLE_VARIANTS dictionary is populated'
  )
  for (const prefix of BANGLADESHI_PREFIX_TITLE_VARIANTS) {
    assert(
      isBangladeshiPrefixOrTitle(prefix),
      `Prefix/Title "${prefix}" from dictionary is recognized`
    )
  }

  const additionalPrefixes = [
    'Md', 'MD', 'Md.', 'Mohammad', 'Mohammed', 'Mohamed', 'Muhammad',
    'Muhammed', 'Muhammod', 'Mohd',
    'Mst', 'Mst.', 'Most', 'Most.', 'Mss', 'Mussamat', 'Mussamet',
    'Musammat', 'Mosammat', 'Sree', 'Shree', 'Sri', 'Shri', 'Begum',
  ]
  for (const prefix of additionalPrefixes) {
    assert(
      isBangladeshiPrefixOrTitle(prefix),
      `Prefix/Title variant "${prefix}" is recognized`
    )
  }

  console.log('\n--- 2. SURNAME & COMMON TOKEN DETECTION ---')
  assert(
    BANGLADESHI_SURNAME_VARIANTS.length > 0 && BANGLADESHI_MUSLIM_COMMON_NAME_TOKENS.length > 0,
    'Surname and Muslim-common name token dictionaries are populated'
  )
  for (const surname of BANGLADESHI_SURNAME_VARIANTS) {
    assert(
      isBangladeshiSurname(surname),
      `Surname "${surname}" from dictionary is recognized`
    )
  }
  for (const token of BANGLADESHI_MUSLIM_COMMON_NAME_TOKENS) {
    assert(
      isBangladeshiSurname(token),
      `Muslim-common name token "${token}" from dictionary is recognized`
    )
  }

  console.log('\n--- 3. NAME NORMALIZATION & OCR CORRECTION ---')
  assert(
    normalizeNameString('  MD.   TARIQUL   ISLAM  ') === 'MD TARIQUL ISLAM',
    'Normalizes prefix dot and collapsing spaces: "MD. TARIQUL ISLAM" -> "MD TARIQUL ISLAM"'
  )
  assert(
    normalizeNameString("PATRICK D COSTA") === "PATRICK D'COSTA",
    'Normalizes Portuguese/Bengali compound surname: "D COSTA" -> "D\'COSTA"'
  )
  assert(
    normalizeNameString("ANTONY D’SOUZA") === "ANTONY D'SOUZA",
    'Standardizes curly apostrophe in "D’SOUZA" to straight single quote'
  )
  assert(
    correctNameOcrNoise("SHR1 ANUP") === "SHRI ANUP",
    'Corrects digit substitution in OCR name token: "SHR1" -> "SHRI"'
  )

  console.log('\n--- 4. NAME SPLITTING & COMPOUND PRESERVATION ---')
  // Mandatory Test Case from prompt: "SHREE JOTIMOY RAY"
  const splitShree = splitBangladeshiFullName('SHREE JOTIMOY RAY')
  assert(
    splitShree.givenNames === 'SHREE JOTIMOY' && splitShree.surname === 'RAY' && splitShree.title === 'SHREE',
    'Passport "SHREE JOTIMOY RAY" -> Given Name = "SHREE JOTIMOY", Surname = "RAY"'
  )

  const splitMd = splitBangladeshiFullName('MD TARIQUL ISLAM')
  assert(
    splitMd.givenNames === 'MD TARIQUL' && splitMd.surname === 'ISLAM' && splitMd.title === 'MD',
    '"MD TARIQUL ISLAM" -> Given Name = "MD TARIQUL", Surname = "ISLAM"'
  )

  const splitMst = splitBangladeshiFullName('MST REHANA AKTER')
  assert(
    splitMst.givenNames === 'MST REHANA' && splitMst.surname === 'AKTER' && splitMst.title === 'MST',
    '"MST REHANA AKTER" -> Given Name = "MST REHANA", Surname = "AKTER"'
  )

  const splitCompound = splitBangladeshiFullName('KHOKON CHANDRA ROY')
  assert(
    splitCompound.givenNames === 'KHOKON' && splitCompound.surname === 'CHANDRA ROY',
    'Preserves compound surname: "KHOKON CHANDRA ROY" -> Surname = "CHANDRA ROY"'
  )

  const splitGomes = splitBangladeshiFullName('PATRICK GOMES')
  assert(
    splitGomes.givenNames === 'PATRICK' && splitGomes.surname === 'GOMES',
    '"PATRICK GOMES" -> Given Name = "PATRICK", Surname = "GOMES"'
  )

  console.log('\n--- 5. STRICT RELIGION SAFETY INVARIANTS ---')
  // None of the names or tokens can ever assign a religion
  const testNames = [
    'Md Tariqul Islam',
    'SHREE JOTIMOY RAY',
    'SHREE ANUP RAY',
    'BIJOY KUMAR DAS',
    'NILOY BISWAS',
    'PATRICK GOMES',
    'MARIA ROZARIO',
    'FRANCIS D\'COSTA',
    'ANISUR RAHMAN',
    'MST REHANA AKTER BEGUM',
    'MOHAMMAD ALI KHAN',
    'SHARMIN SULTANA KHATUN',
  ]

  for (const name of testNames) {
    const docText = `
      PEOPLE'S REPUBLIC OF BANGLADESH
      PASSPORT
      Name: ${name}
      Nationality: BANGLADESHI
      Date of Birth: 12 JAN 1990
      Passport No: A09876543
    `
    const extracted = extractFromPdfText(docText)
    assert(
      extracted.personal?.religion?.value === undefined,
      `Religion remains BLANK for name "${name}" (never derived from name tokens)`
    )

    // Also verify application merger leaves appl.religion empty
    const docRecord: DocumentRecord = {
      documentId: `doc_${name.replace(/\s+/g, '_')}`,
      applicantId: 'APPL_SAFETY_01',
      documentType: 'passport',
      fileName: 'Passport.pdf',
      fileSize: 100000,
      mimeType: 'application/pdf',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedData: extracted,
      extractedDataConfirmed: true,
    }

    const app = populateApplicationFromDocuments({
      applicantId: 'APPL_SAFETY_01',
      passportDoc: docRecord,
      ogdDoc: null,
      existingApp: null,
    })

    assert(
      app.fields['appl.religion']?.value === '' || app.fields['appl.religion']?.value === undefined,
      `Application Workspace appl.religion remains empty for "${name}"`
    )
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
