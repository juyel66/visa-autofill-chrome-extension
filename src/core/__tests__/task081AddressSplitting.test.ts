import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseStructuredAddress } from '../extraction/data/applicantDataExtractor'
import { populateApplicationFromDocuments } from '../application/applicationMerger'
import type { DocumentRecord } from '../../core/document/types'
import type { ExtractedApplicantData } from '../extraction/data/types'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('TASK 081: Dynamic Address Splitting & Extraction Tests', () => {
  // Test 1: Supplied reference document structure
  it('Test 1: Parses reference address structure (Address 1 = 1st component, Address 2 = secondary components, City = City, Postal = Postal)', () => {
    const raw = 'KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI - 5120, THAKURGAON'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, 'KASHIPUR')
    assert.strictEqual(res.addressLine2, 'RANISANKAIL, MUZAHIDABAD COLONI')
    assert.strictEqual(res.villageTownCity, 'THAKURGAON')
    assert.strictEqual(res.district, 'THAKURGAON')
    assert.strictEqual(res.postalCode, '5120')
    assert.strictEqual(res.country, 'BANGLADESH')
  })

  // Test 2: Completely different synthetic address
  it('Test 2: Parses synthetic 4-component address with postal code', () => {
    const raw = 'HOUSE 45, ROAD 7, SECTOR 3, UTTARA - 1230, DHAKA'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, 'HOUSE 45')
    assert.strictEqual(res.addressLine2, 'ROAD 7, SECTOR 3, UTTARA')
    assert.strictEqual(res.villageTownCity, 'DHAKA')
    assert.strictEqual(res.district, 'DHAKA')
    assert.strictEqual(res.postalCode, '1230')
  })

  // Test 3: Address with 2 components
  it('Test 3: Parses 2-component address', () => {
    const raw = 'VILLAGE CHARPARA, MUNSHIGANJ'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, 'VILLAGE CHARPARA')
    assert.strictEqual(res.addressLine2, undefined)
    assert.strictEqual(res.villageTownCity, 'MUNSHIGANJ')
    assert.strictEqual(res.district, 'MUNSHIGANJ')
  })

  // Test 4: Address with 4+ components
  it('Test 4: Parses 5+ component address', () => {
    const raw = 'FLAT 3A, HOLDING 89, WARD 4, KAZIPARA, MIRPUR - 1216, DHAKA'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, 'FLAT 3A')
    assert.strictEqual(res.addressLine2, 'HOLDING 89, WARD 4, KAZIPARA, MIRPUR')
    assert.strictEqual(res.villageTownCity, 'DHAKA')
    assert.strictEqual(res.district, 'DHAKA')
    assert.strictEqual(res.postalCode, '1216')
  })

  // Test 5: Address without postal code
  it('Test 5: Parses address without postal code', () => {
    const raw = 'HOUSE 10, ROAD 5, DHANMONDI, DHAKA'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, 'HOUSE 10')
    assert.strictEqual(res.addressLine2, 'ROAD 5, DHANMONDI')
    assert.strictEqual(res.villageTownCity, 'DHAKA')
    assert.strictEqual(res.district, 'DHAKA')
    assert.strictEqual(res.postalCode, undefined)
  })

  // Test 6: Address with single component / without explicit city
  it('Test 6: Parses single component address', () => {
    const raw = 'CHITTAGONG'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, 'CHITTAGONG')
    assert.strictEqual(res.addressLine2, undefined)
    assert.strictEqual(res.villageTownCity, 'CHITTAGONG')
    assert.strictEqual(res.district, 'CHITTAGONG')
  })

  // Test 7: OCR-fragmented address with noise tokens
  it('Test 7: Cleans and reconstructs OCR-fragmented address', () => {
    const raw = 'i. KASHIPUR, RANISANKAIL, MUZAHIDABAD COLON - 5120, ME, THAKURGAON —'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, 'KASHIPUR')
    assert.strictEqual(res.addressLine2, 'RANISANKAIL, MUZAHIDABAD COLONI')
    assert.strictEqual(res.villageTownCity, 'THAKURGAON')
    assert.strictEqual(res.district, 'THAKURGAON')
    assert.strictEqual(res.postalCode, '5120')
  })

  // Test 8: Address containing COLONY
  it('Test 8: Handles addresses containing COLONY / COLONI', () => {
    const raw = 'VILLAGE SHANTI, POST UTTAR, RAILWAY COLONY - 4000, CHITTAGONG'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, 'VILLAGE SHANTI')
    assert.strictEqual(res.addressLine2, 'POST UTTAR, RAILWAY COLONY')
    assert.strictEqual(res.villageTownCity, 'CHITTAGONG')
    assert.strictEqual(res.district, 'CHITTAGONG')
    assert.strictEqual(res.postalCode, '4000')
  })

  // Test 9: Address containing road/street/locality
  it('Test 9: Handles street and locality details properly', () => {
    const raw = '24 GREEN ROAD, FLAT B2, KALABAGAN, DHAKA'
    const res = parseStructuredAddress(raw)

    assert.strictEqual(res.addressLine1, '24 GREEN ROAD')
    assert.strictEqual(res.addressLine2, 'FLAT B2, KALABAGAN')
    assert.strictEqual(res.villageTownCity, 'DHAKA')
    assert.strictEqual(res.district, 'DHAKA')
  })

  // Test 10: Present Address fallback from Permanent Address
  it('Test 10: Populates Present Address from Permanent Address when Present Address is absent', () => {
    const extractedData: ExtractedApplicantData = {
      personal: {
        lastName: { value: 'RAHMAN', source: 'ai' },
        firstName: { value: 'ANISUR', source: 'ai' },
        nationality: { value: 'BANGLADESH', source: 'ai' },
      },
      passport: {
        passportNumber: { value: 'A12345678', source: 'ai' },
        issuingCountry: { value: 'BANGLADESH', source: 'ai' },
      },
      permanentAddress: {
        addressLine1: { value: 'KASHIPUR', source: 'ai' },
        addressLine2: { value: 'RANISANKAIL, MUZAHIDABAD COLONI', source: 'ai' },
        villageTownCity: { value: 'THAKURGAON', source: 'ai' },
        district: { value: 'THAKURGAON', source: 'ai' },
        postalCode: { value: '5120', source: 'ai' },
        country: { value: 'BANGLADESH', source: 'ai' },
      },
    }

    const doc: DocumentRecord = {
      documentId: 'doc_10',
      applicantId: 'appl_10',
      documentType: 'passport',
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedData,
      extractedDataConfirmed: true,
    }

    const savedApp = populateApplicationFromDocuments({
      applicantId: 'appl_10',
      passportDoc: doc,
    })

    assert.strictEqual(savedApp.fields['pres_addr1'].value, 'KASHIPUR')
    assert.strictEqual(savedApp.fields['pres_addr1'].source, 'derived')
    assert.strictEqual(savedApp.fields['pres_addr2'].value, 'RANISANKAIL, MUZAHIDABAD COLONI')
    assert.strictEqual(savedApp.fields['pres_addr2'].source, 'derived')
    assert.strictEqual(savedApp.fields['village_town_city'].value, 'THAKURGAON')
    assert.strictEqual(savedApp.fields['village_town_city'].source, 'derived')
    assert.strictEqual(savedApp.fields['district'].value, 'THAKURGAON')
    assert.strictEqual(savedApp.fields['district'].source, 'derived')
    assert.strictEqual(savedApp.fields['pincode'].value, '5120')
    assert.strictEqual(savedApp.fields['pincode'].source, 'derived')
  })

  // Test 11: Explicit Present Address overrides fallback
  it('Test 11: Preserves explicit Present Address when distinct from Permanent Address', () => {
    const extractedData: ExtractedApplicantData = {
      personal: {
        lastName: { value: 'RAHMAN', source: 'ai' },
        firstName: { value: 'ANISUR', source: 'ai' },
        nationality: { value: 'BANGLADESH', source: 'ai' },
      },
      passport: {
        passportNumber: { value: 'A12345678', source: 'ai' },
        issuingCountry: { value: 'BANGLADESH', source: 'ai' },
      },
      presentAddress: {
        addressLine1: { value: 'HOUSE 12, ROAD 4', source: 'ai' },
        addressLine2: { value: 'BANANI', source: 'ai' },
        villageTownCity: { value: 'DHAKA', source: 'ai' },
        district: { value: 'DHAKA', source: 'ai' },
        postalCode: { value: '1213', source: 'ai' },
      },
      permanentAddress: {
        addressLine1: { value: 'VILLAGE CHARPARA', source: 'ai' },
        villageTownCity: { value: 'MUNSHIGANJ', source: 'ai' },
        district: { value: 'MUNSHIGANJ', source: 'ai' },
        postalCode: { value: '1500', source: 'ai' },
      },
    }

    const doc: DocumentRecord = {
      documentId: 'doc_11',
      applicantId: 'appl_11',
      documentType: 'passport',
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedData,
      extractedDataConfirmed: true,
    }

    const savedApp = populateApplicationFromDocuments({
      applicantId: 'appl_11',
      passportDoc: doc,
    })

    assert.strictEqual(savedApp.fields['pres_addr1'].value, 'HOUSE 12, ROAD 4')
    assert.strictEqual(savedApp.fields['pres_addr1'].source, 'passport')
    assert.strictEqual(savedApp.fields['perm_add1'].value, 'VILLAGE CHARPARA')
    assert.strictEqual(savedApp.fields['perm_add1'].source, 'passport')
  })

  // Test 12: Manual user edits remain preserved
  it('Test 12: Preserves manual user edits when merging', () => {
    const extractedData: ExtractedApplicantData = {
      personal: {
        lastName: { value: 'RAHMAN', source: 'ai' },
        firstName: { value: 'ANISUR', source: 'ai' },
      },
      passport: {
        passportNumber: { value: 'A12345678', source: 'ai' },
      },
      presentAddress: {
        addressLine1: { value: 'DOC ADDRESS 1', source: 'ai' },
      },
    }

    const doc: DocumentRecord = {
      documentId: 'doc_12',
      applicantId: 'appl_12',
      documentType: 'passport',
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedData,
      extractedDataConfirmed: true,
    }

    const existingApp = populateApplicationFromDocuments({
      applicantId: 'appl_12',
      passportDoc: doc,
    })

    // User edits address line 1
    existingApp.fields['pres_addr1'] = {
      value: 'MANUALLY EDITED ADDRESS LINE 1',
      source: 'manual',
      isUserEdited: true,
    }
    existingApp.manualEdits['pres_addr1'] = true

    // Re-populate from document
    const updatedApp = populateApplicationFromDocuments({
      applicantId: 'appl_12',
      passportDoc: doc,
      existingApp,
    })

    assert.strictEqual(updatedApp.fields['pres_addr1'].value, 'MANUALLY EDITED ADDRESS LINE 1')
    assert.strictEqual(updatedApp.fields['pres_addr1'].source, 'manual')
    assert.strictEqual(updatedApp.fields['pres_addr1'].isUserEdited, true)
  })

  // Test 13: Process Applicant A then Applicant B (Zero contamination)
  it('Test 13: Isolates sequential applicants (Applicant A -> Applicant B)', () => {
    const docA: DocumentRecord = {
      documentId: 'doc_A',
      applicantId: 'appl_A',
      documentType: 'passport',
      fileName: 'applicantA.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      extractedData: {
        personal: { lastName: { value: 'KARIM', source: 'ai' }, firstName: { value: 'RAHIM', source: 'ai' } },
        passport: { passportNumber: { value: 'Z99999999', source: 'ai' } },
        permanentAddress: {
          addressLine1: { value: '12 DHANMONDI', source: 'ai' },
          villageTownCity: { value: 'DHAKA', source: 'ai' },
        },
      },
    }

    const appA = populateApplicationFromDocuments({ applicantId: 'appl_A', passportDoc: docA })
    assert.strictEqual(appA.fields['appl.surname'].value, 'KARIM')
    assert.strictEqual(appA.fields['appl.passport_number'].value, 'Z99999999')
    assert.strictEqual(appA.fields['perm_add1'].value, '12 DHANMONDI')

    const docB: DocumentRecord = {
      documentId: 'doc_B',
      applicantId: 'appl_B',
      documentType: 'passport',
      fileName: 'applicantB.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      extractedData: {
        personal: { lastName: { value: 'PERSON', source: 'ai' }, firstName: { value: 'TEST', source: 'ai' } },
        passport: { passportNumber: { value: 'X12345678', source: 'ai' } },
        permanentAddress: {
          addressLine1: { value: '45 AGRABAD', source: 'ai' },
          villageTownCity: { value: 'CHITTAGONG', source: 'ai' },
        },
      },
    }

    const appB = populateApplicationFromDocuments({
      applicantId: 'appl_B',
      passportDoc: docB,
      existingApp: appA,
    })

    assert.strictEqual(appB.fields['appl.surname'].value, 'PERSON')
    assert.strictEqual(appB.fields['appl.passport_number'].value, 'X12345678')
    assert.strictEqual(appB.fields['perm_add1'].value, '45 AGRABAD')
    assert.notStrictEqual(appB.fields['perm_add1'].value, '12 DHANMONDI')
  })

  // Test 14: Production hardcode scan
  it('Test 14: Confirms zero applicant-specific hardcoded values in production src/**', () => {
    const srcDir = process.cwd()
    const forbiddenLiterals = [
      'A21496961',
      'BK0965579',
      '8235626051',
      '+8801744777846',
      '1744777846',
    ]

    function scanDir(dir: string): string[] {
      const files: string[] = []
      const items = fs.readdirSync(dir, { withFileTypes: true })
      for (const item of items) {
        if (item.name === '__tests__' || item.name.endsWith('.test.ts') || item.name === 'node_modules' || item.name === 'dist') {
          continue
        }
        const fullPath = path.join(dir, item.name)
        if (item.isDirectory()) {
          files.push(...scanDir(fullPath))
        } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
          files.push(fullPath)
        }
      }
      return files
    }

    const prodFiles = scanDir(path.join(srcDir, 'src'))
    for (const file of prodFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      for (const literal of forbiddenLiterals) {
        assert(
          !content.includes(literal),
          `Production file ${file} MUST NOT contain sample literal "${literal}"`
        )
      }
    }
  })
})

export async function runTask081AddressSplittingTests(): Promise<{ passed: boolean; totalSubtests: number; failures: string[] }> {
  const failures: string[] = []
  let totalSubtests = 0

  const subtests: { name: string; fn: () => void | Promise<void> }[] = [
    {
      name: 'Test 1: Reference address structure (KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI - 5120, THAKURGAON)',
      fn: () => {
        const raw = 'KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI - 5120, THAKURGAON'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, 'KASHIPUR')
        assert.strictEqual(res.addressLine2, 'RANISANKAIL, MUZAHIDABAD COLONI')
        assert.strictEqual(res.villageTownCity, 'THAKURGAON')
        assert.strictEqual(res.district, 'THAKURGAON')
        assert.strictEqual(res.postalCode, '5120')
        assert.strictEqual(res.country, 'BANGLADESH')
      },
    },
    {
      name: 'Test 2: Synthetic 4-component address with postal code',
      fn: () => {
        const raw = 'HOUSE 45, ROAD 7, SECTOR 3, UTTARA - 1230, DHAKA'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, 'HOUSE 45')
        assert.strictEqual(res.addressLine2, 'ROAD 7, SECTOR 3, UTTARA')
        assert.strictEqual(res.villageTownCity, 'DHAKA')
        assert.strictEqual(res.district, 'DHAKA')
        assert.strictEqual(res.postalCode, '1230')
      },
    },
    {
      name: 'Test 3: 2-component address',
      fn: () => {
        const raw = 'VILLAGE CHARPARA, MUNSHIGANJ'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, 'VILLAGE CHARPARA')
        assert.strictEqual(res.addressLine2, undefined)
        assert.strictEqual(res.villageTownCity, 'MUNSHIGANJ')
        assert.strictEqual(res.district, 'MUNSHIGANJ')
      },
    },
    {
      name: 'Test 4: 5+ component address',
      fn: () => {
        const raw = 'FLAT 3A, HOLDING 89, WARD 4, KAZIPARA, MIRPUR - 1216, DHAKA'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, 'FLAT 3A')
        assert.strictEqual(res.addressLine2, 'HOLDING 89, WARD 4, KAZIPARA, MIRPUR')
        assert.strictEqual(res.villageTownCity, 'DHAKA')
        assert.strictEqual(res.district, 'DHAKA')
        assert.strictEqual(res.postalCode, '1216')
      },
    },
    {
      name: 'Test 5: Address without postal code',
      fn: () => {
        const raw = 'HOUSE 10, ROAD 5, DHANMONDI, DHAKA'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, 'HOUSE 10')
        assert.strictEqual(res.addressLine2, 'ROAD 5, DHANMONDI')
        assert.strictEqual(res.villageTownCity, 'DHAKA')
        assert.strictEqual(res.district, 'DHAKA')
        assert.strictEqual(res.postalCode, undefined)
      },
    },
    {
      name: 'Test 6: Single component address',
      fn: () => {
        const raw = 'CHITTAGONG'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, 'CHITTAGONG')
        assert.strictEqual(res.addressLine2, undefined)
        assert.strictEqual(res.villageTownCity, 'CHITTAGONG')
        assert.strictEqual(res.district, 'CHITTAGONG')
      },
    },
    {
      name: 'Test 7: OCR-fragmented address with noise tokens',
      fn: () => {
        const raw = 'i. KASHIPUR, RANISANKAIL, MUZAHIDABAD COLON - 5120, ME, THAKURGAON —'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, 'KASHIPUR')
        assert.strictEqual(res.addressLine2, 'RANISANKAIL, MUZAHIDABAD COLONI')
        assert.strictEqual(res.villageTownCity, 'THAKURGAON')
        assert.strictEqual(res.district, 'THAKURGAON')
        assert.strictEqual(res.postalCode, '5120')
      },
    },
    {
      name: 'Test 8: Addresses containing COLONY / COLONI',
      fn: () => {
        const raw = 'VILLAGE SHANTI, POST UTTAR, RAILWAY COLONY - 4000, CHITTAGONG'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, 'VILLAGE SHANTI')
        assert.strictEqual(res.addressLine2, 'POST UTTAR, RAILWAY COLONY')
        assert.strictEqual(res.villageTownCity, 'CHITTAGONG')
        assert.strictEqual(res.district, 'CHITTAGONG')
        assert.strictEqual(res.postalCode, '4000')
      },
    },
    {
      name: 'Test 9: Street and locality details',
      fn: () => {
        const raw = '24 GREEN ROAD, FLAT B2, KALABAGAN, DHAKA'
        const res = parseStructuredAddress(raw)
        assert.strictEqual(res.addressLine1, '24 GREEN ROAD')
        assert.strictEqual(res.addressLine2, 'FLAT B2, KALABAGAN')
        assert.strictEqual(res.villageTownCity, 'DHAKA')
        assert.strictEqual(res.district, 'DHAKA')
      },
    },
    {
      name: 'Test 10: Present Address fallback from Permanent Address',
      fn: () => {
        const extractedData: ExtractedApplicantData = {
          personal: {
            lastName: { value: 'RAHMAN', source: 'ai' },
            firstName: { value: 'ANISUR', source: 'ai' },
            nationality: { value: 'BANGLADESH', source: 'ai' },
          },
          passport: {
            passportNumber: { value: 'A12345678', source: 'ai' },
            issuingCountry: { value: 'BANGLADESH', source: 'ai' },
          },
          permanentAddress: {
            addressLine1: { value: 'KASHIPUR', source: 'ai' },
            addressLine2: { value: 'RANISANKAIL, MUZAHIDABAD COLONI', source: 'ai' },
            villageTownCity: { value: 'THAKURGAON', source: 'ai' },
            district: { value: 'THAKURGAON', source: 'ai' },
            postalCode: { value: '5120', source: 'ai' },
            country: { value: 'BANGLADESH', source: 'ai' },
          },
        }

        const doc: DocumentRecord = {
          documentId: 'doc_10',
          applicantId: 'appl_10',
          documentType: 'passport',
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          fileSize: 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'processed',
          source: 'user-upload',
          extractedData,
          extractedDataConfirmed: true,
        }

        const savedApp = populateApplicationFromDocuments({
          applicantId: 'appl_10',
          passportDoc: doc,
        })

        assert.strictEqual(savedApp.fields['pres_addr1'].value, 'KASHIPUR')
        assert.strictEqual(savedApp.fields['pres_addr1'].source, 'derived')
        assert.strictEqual(savedApp.fields['pres_addr2'].value, 'RANISANKAIL, MUZAHIDABAD COLONI')
        assert.strictEqual(savedApp.fields['pres_addr2'].source, 'derived')
        assert.strictEqual(savedApp.fields['village_town_city'].value, 'THAKURGAON')
        assert.strictEqual(savedApp.fields['village_town_city'].source, 'derived')
        assert.strictEqual(savedApp.fields['district'].value, 'THAKURGAON')
        assert.strictEqual(savedApp.fields['district'].source, 'derived')
        assert.strictEqual(savedApp.fields['pincode'].value, '5120')
        assert.strictEqual(savedApp.fields['pincode'].source, 'derived')
      },
    },
    {
      name: 'Test 11: Explicit Present Address overrides fallback',
      fn: () => {
        const extractedData: ExtractedApplicantData = {
          personal: {
            lastName: { value: 'RAHMAN', source: 'ai' },
            firstName: { value: 'ANISUR', source: 'ai' },
            nationality: { value: 'BANGLADESH', source: 'ai' },
          },
          passport: {
            passportNumber: { value: 'A12345678', source: 'ai' },
            issuingCountry: { value: 'BANGLADESH', source: 'ai' },
          },
          presentAddress: {
            addressLine1: { value: 'HOUSE 12, ROAD 4', source: 'ai' },
            addressLine2: { value: 'BANANI', source: 'ai' },
            villageTownCity: { value: 'DHAKA', source: 'ai' },
            district: { value: 'DHAKA', source: 'ai' },
            postalCode: { value: '1213', source: 'ai' },
          },
          permanentAddress: {
            addressLine1: { value: 'VILLAGE CHARPARA', source: 'ai' },
            villageTownCity: { value: 'MUNSHIGANJ', source: 'ai' },
            district: { value: 'MUNSHIGANJ', source: 'ai' },
            postalCode: { value: '1500', source: 'ai' },
          },
        }

        const doc: DocumentRecord = {
          documentId: 'doc_11',
          applicantId: 'appl_11',
          documentType: 'passport',
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          fileSize: 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'processed',
          source: 'user-upload',
          extractedData,
          extractedDataConfirmed: true,
        }

        const savedApp = populateApplicationFromDocuments({
          applicantId: 'appl_11',
          passportDoc: doc,
        })

        assert.strictEqual(savedApp.fields['pres_addr1'].value, 'HOUSE 12, ROAD 4')
        assert.strictEqual(savedApp.fields['pres_addr1'].source, 'passport')
        assert.strictEqual(savedApp.fields['perm_add1'].value, 'VILLAGE CHARPARA')
        assert.strictEqual(savedApp.fields['perm_add1'].source, 'passport')
      },
    },
    {
      name: 'Test 12: Preserves manual user edits when merging',
      fn: () => {
        const extractedData: ExtractedApplicantData = {
          personal: {
            lastName: { value: 'RAHMAN', source: 'ai' },
            firstName: { value: 'ANISUR', source: 'ai' },
          },
          passport: {
            passportNumber: { value: 'A12345678', source: 'ai' },
          },
          presentAddress: {
            addressLine1: { value: 'DOC ADDRESS 1', source: 'ai' },
          },
        }

        const doc: DocumentRecord = {
          documentId: 'doc_12',
          applicantId: 'appl_12',
          documentType: 'passport',
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          fileSize: 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'processed',
          source: 'user-upload',
          extractedData,
          extractedDataConfirmed: true,
        }

        const existingApp = populateApplicationFromDocuments({
          applicantId: 'appl_12',
          passportDoc: doc,
        })

        existingApp.fields['pres_addr1'] = {
          value: 'MANUALLY EDITED ADDRESS LINE 1',
          source: 'manual',
          isUserEdited: true,
        }
        existingApp.manualEdits['pres_addr1'] = true

        const updatedApp = populateApplicationFromDocuments({
          applicantId: 'appl_12',
          passportDoc: doc,
          existingApp,
        })

        assert.strictEqual(updatedApp.fields['pres_addr1'].value, 'MANUALLY EDITED ADDRESS LINE 1')
        assert.strictEqual(updatedApp.fields['pres_addr1'].source, 'manual')
        assert.strictEqual(updatedApp.fields['pres_addr1'].isUserEdited, true)
      },
    },
    {
      name: 'Test 13: Isolates sequential applicants (Applicant A -> Applicant B)',
      fn: () => {
        const docA: DocumentRecord = {
          documentId: 'doc_A',
          applicantId: 'appl_A',
          documentType: 'passport',
          fileName: 'applicantA.pdf',
          mimeType: 'application/pdf',
          fileSize: 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'processed',
          source: 'user-upload',
          extractedDataConfirmed: true,
          extractedData: {
            personal: { lastName: { value: 'KARIM', source: 'ai' }, firstName: { value: 'RAHIM', source: 'ai' } },
            passport: { passportNumber: { value: 'Z99999999', source: 'ai' } },
            permanentAddress: {
              addressLine1: { value: '12 DHANMONDI', source: 'ai' },
              villageTownCity: { value: 'DHAKA', source: 'ai' },
            },
          },
        }

        const appA = populateApplicationFromDocuments({ applicantId: 'appl_A', passportDoc: docA })
        assert.strictEqual(appA.fields['appl.surname'].value, 'KARIM')
        assert.strictEqual(appA.fields['appl.passport_number'].value, 'Z99999999')
        assert.strictEqual(appA.fields['perm_add1'].value, '12 DHANMONDI')

        const docB: DocumentRecord = {
          documentId: 'doc_B',
          applicantId: 'appl_B',
          documentType: 'passport',
          fileName: 'applicantB.pdf',
          mimeType: 'application/pdf',
          fileSize: 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'processed',
          source: 'user-upload',
          extractedDataConfirmed: true,
          extractedData: {
            personal: { lastName: { value: 'PERSON', source: 'ai' }, firstName: { value: 'TEST', source: 'ai' } },
            passport: { passportNumber: { value: 'X12345678', source: 'ai' } },
            permanentAddress: {
              addressLine1: { value: '45 AGRABAD', source: 'ai' },
              villageTownCity: { value: 'CHITTAGONG', source: 'ai' },
            },
          },
        }

        const appB = populateApplicationFromDocuments({
          applicantId: 'appl_B',
          passportDoc: docB,
          existingApp: appA,
        })

        assert.strictEqual(appB.fields['appl.surname'].value, 'PERSON')
        assert.strictEqual(appB.fields['appl.passport_number'].value, 'X12345678')
        assert.strictEqual(appB.fields['perm_add1'].value, '45 AGRABAD')
        assert.notStrictEqual(appB.fields['perm_add1'].value, '12 DHANMONDI')
      },
    },
    {
      name: 'Test 14: Confirms zero applicant-specific hardcoded values in production src/**',
      fn: () => {
        const srcDir = process.cwd()
        const forbiddenLiterals = [
          'A21496961',
          'BK0965579',
          '8235626051',
          '+8801744777846',
          '1744777846',
        ]

        function scanDir(dir: string): string[] {
          const files: string[] = []
          const items = fs.readdirSync(dir, { withFileTypes: true })
          for (const item of items) {
            if (item.name === '__tests__' || item.name.endsWith('.test.ts') || item.name === 'node_modules' || item.name === 'dist') {
              continue
            }
            const fullPath = path.join(dir, item.name)
            if (item.isDirectory()) {
              files.push(...scanDir(fullPath))
            } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
              files.push(fullPath)
            }
          }
          return files
        }

        const prodFiles = scanDir(path.join(srcDir, 'src'))
        for (const file of prodFiles) {
          const content = fs.readFileSync(file, 'utf-8')
          for (const literal of forbiddenLiterals) {
            assert(
              !content.includes(literal),
              `Production file ${file} MUST NOT contain sample literal "${literal}"`
            )
          }
        }
      },
    },
  ]

  for (const st of subtests) {
    totalSubtests++
    try {
      await st.fn()
    } catch (err: unknown) {
      failures.push(`${st.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
