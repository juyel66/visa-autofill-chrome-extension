import { ensureContentScriptReady } from '../../../background'
import { detectIndiaVisaPage } from '../../../countries/india/detector'
import { BANGLADESH_REGISTRATION_MAPPINGS } from '../../../countries/india/mappings/bangladesh/registration'
import { executeAutofill } from '../../autofill/autofillEngine'
import { resolveCandidateData } from '../../autofill/candidateResolver'
import type { SavedApplication } from '../../application/types'
import { JSDOM } from 'jsdom'

export interface ContentScriptInjectionTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runContentScriptInjectionTests(): Promise<ContentScriptInjectionTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
    }
  }

  // =========================================================================
  // 1. MANIFEST CONFIGURATION AUDIT
  // =========================================================================
  try {
    const isNode = typeof globalThis !== 'undefined' && 'process' in globalThis
    if (isNode) {
      interface NodeFsModule {
        readFileSync: (p: string, enc: string) => string
      }
      interface NodePathModule {
        resolve: (...paths: string[]) => string
      }
      const dynamicImport = new Function('m', 'return import(m)') as (
        m: string
      ) => Promise<{ default: unknown }>
      const fsMod = (await dynamicImport('fs')).default as NodeFsModule
      const pathMod = (await dynamicImport('path')).default as NodePathModule

      const manifestPath = pathMod.resolve('.', 'public/manifest.json')
      const manifest = JSON.parse(fsMod.readFileSync(manifestPath, 'utf8'))

      const contentScripts = manifest.content_scripts || []
      const matches = contentScripts[0]?.matches || []
      const permissions = manifest.permissions || []
      const hostPermissions = manifest.host_permissions || []

      assert(
        matches.includes('https://indianvisa-bangladesh.nic.in/visa/*'),
        'Manifest content_scripts must explicitly match "https://indianvisa-bangladesh.nic.in/visa/*"'
      )
      assert(
        permissions.includes('scripting'),
        'Manifest permissions must include "scripting" for programmatic injection fallback'
      )
      assert(
        permissions.includes('activeTab'),
        'Manifest permissions must include "activeTab"'
      )
      assert(
        permissions.includes('storage'),
        'Manifest permissions must include "storage"'
      )
      assert(
        hostPermissions.includes('https://indianvisa-bangladesh.nic.in/*'),
        'Manifest host_permissions must include "https://indianvisa-bangladesh.nic.in/*"'
      )
    }
  } catch (err) {
    failures.push(`Manifest audit failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // =========================================================================
  // 2. PAGE DETECTOR VALIDATION FOR REGISTRATION URL
  // =========================================================================
  {
    const det = detectIndiaVisaPage({
      href: 'https://indianvisa-bangladesh.nic.in/visa/Registration',
      hostname: 'indianvisa-bangladesh.nic.in',
      pathname: '/visa/Registration',
    })

    assert(det.matched === true, 'Registration URL must match Indian Visa detector')
    assert(det.country === 'india', 'Detected country must be "india"')
    assert(det.countryCode === 'IND', 'Detected countryCode must be "IND"')
    assert(det.page === 'REGISTRATION', `Detected page must be "REGISTRATION", got "${det.page}"`)
    assert(det.flow === 'regular', `Detected flow must be "regular", got "${det.flow}"`)
  }

  // =========================================================================
  // 3. TAB SAFETY & NON-WEB URL REJECTION
  // =========================================================================
  {
    const internalUrlResult = await ensureContentScriptReady(1, 'chrome://extensions')
    assert(
      internalUrlResult.ready === false,
      'ensureContentScriptReady must reject internal chrome:// URLs'
    )
    assert(
      Boolean(internalUrlResult.error && internalUrlResult.error.includes('navigate')),
      'Should return instructional error for non-web tabs'
    )

    const devtoolsResult = await ensureContentScriptReady(2, 'devtools://devtools/bundled/inspector.html')
    assert(
      devtoolsResult.ready === false,
      'ensureContentScriptReady must reject devtools:// URLs'
    )

    const extensionUrlResult = await ensureContentScriptReady(3, 'chrome-extension://xyz/popup.html')
    assert(
      extensionUrlResult.ready === false,
      'ensureContentScriptReady must reject chrome-extension:// URLs'
    )
  }

  // =========================================================================
  // 4. READINESS PING & PROGRAMMATIC INJECTION SIMULATION
  // =========================================================================
  {
    const origChrome = (globalThis as Record<string, unknown>).chrome

    // Test case A: Content script is already responding to PING
    ;(globalThis as Record<string, unknown>).chrome = {
      tabs: {
        sendMessage: (
          _tabId: number,
          msg: { type: string },
          callback: (res: { status: string; data: { type: string; message: string } }) => void
        ) => {
          if (msg.type === 'PING_CONTENT') {
            callback({
              status: 'success',
              data: { type: 'CONTENT_PONG', message: 'Content script is working' },
            })
          }
        },
      },
      runtime: {
        lastError: null,
      },
    }

    const readyRes = await ensureContentScriptReady(101, 'https://indianvisa-bangladesh.nic.in/visa/Registration')
    assert(readyRes.ready === true, 'ensureContentScriptReady must report ready when PING_CONTENT succeeds')

    // Test case B: Content script initially missing, injected via chrome.scripting.executeScript
    const state = { injected: false, pingCount: 0 }

    ;(globalThis as Record<string, unknown>).chrome = {
      tabs: {
        sendMessage: (
          _tabId: number,
          msg: { type: string },
          callback: (res?: { status: string; data: { type: string; message: string } }) => void
        ) => {
          if (msg.type === 'PING_CONTENT') {
            state.pingCount++
            if (!state.injected) {
              ;(globalThis as Record<string, unknown>).chrome = {
                ...(globalThis as Record<string, unknown>).chrome as object,
                runtime: { lastError: { message: 'Could not establish connection. Receiving end does not exist.' } },
              }
              callback(undefined)
            } else {
              ;(globalThis as Record<string, unknown>).chrome = {
                ...(globalThis as Record<string, unknown>).chrome as object,
                runtime: { lastError: null },
              }
              callback({
                status: 'success',
                data: { type: 'CONTENT_PONG', message: 'Content script is working' },
              })
            }
          }
        },
      },
      scripting: {
        executeScript: async (params: { target: { tabId: number }; files: string[] }) => {
          if (params.files.includes('content.js')) {
            state.injected = true
          }
        },
      },
      runtime: {
        lastError: null,
      },
    }

    const fallbackRes = await ensureContentScriptReady(102, 'https://indianvisa-bangladesh.nic.in/visa/Registration')
    assert(state.injected === true, 'Script injection should be triggered when initial ping fails')
    assert(state.pingCount >= 2, 'Ping should be sent before and after injection')
    assert(fallbackRes.ready === true, 'Fallback injection should result in ready state after verification ping')

    // Restore original chrome
    ;(globalThis as Record<string, unknown>).chrome = origChrome
  }

  // =========================================================================
  // 5. REGISTRATION ADAPTER END-TO-END EXECUTION ON SIMULATED PORTAL DOM
  // =========================================================================
  {
    const dom = new JSDOM(
      `<!DOCTYPE html>
      <html>
        <head><title>Online Visa Application</title></head>
        <body>
          <form id="visa_registration_form">
            <select name="appl.countryname" id="countryname_id">
              <option value="">Select Country</option>
              <option value="BGD">BANGLADESH</option>
            </select>
            <select name="appl.missioncode" id="missioncode_id">
              <option value="">Select Mission</option>
              <option value="01">BANGLADESH - DHAKA</option>
            </select>
            <select name="appl.nationality" id="nationality_id">
              <option value="">Select Nationality</option>
              <option value="BGD">BANGLADESH</option>
            </select>
            <input type="text" name="appl.birthdate" id="dob_id" value="" />
            <input type="text" name="appl.email" id="email_id" value="" />
            <input type="text" name="appl.email_re" id="email_re_id" value="" />
            <input type="text" name="appl.journeydate" id="jouryney_id" value="" />
            <input type="text" name="captcha" id="captcha" value="" />
            <button type="button" id="btn_save_continue">Save and Continue</button>
          </form>
        </body>
      </html>`,
      { url: 'https://indianvisa-bangladesh.nic.in/visa/Registration' }
    )

    const prevDoc = globalThis.document
    const prevWin = globalThis.window
    const prevNode = (globalThis as Record<string, unknown>).Node
    const prevElem = (globalThis as Record<string, unknown>).Element
    const prevHtmlElem = (globalThis as Record<string, unknown>).HTMLElement
    const prevHtmlInput = (globalThis as Record<string, unknown>).HTMLInputElement
    const prevHtmlSelect = (globalThis as Record<string, unknown>).HTMLSelectElement

    try {
      globalThis.document = dom.window.document
      globalThis.window = dom.window as unknown as Window & typeof globalThis
      ;(globalThis as Record<string, unknown>).Node = dom.window.Node
      ;(globalThis as Record<string, unknown>).Element = dom.window.Element
      ;(globalThis as Record<string, unknown>).HTMLElement = dom.window.HTMLElement
      ;(globalThis as Record<string, unknown>).HTMLInputElement = dom.window.HTMLInputElement
      ;(globalThis as Record<string, unknown>).HTMLSelectElement = dom.window.HTMLSelectElement

      let submitClicked = false
      dom.window.document.getElementById('btn_save_continue')?.addEventListener('click', () => {
        submitClicked = true
      })

      // Dynamic SavedApplication
      const savedApp: SavedApplication = {
        applicationId: 'app_dynamic_001',
        applicantId: 'APPL_DYN_001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'ready_for_autofill',
        fields: {
          'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
          'appl.missioncode': { value: 'BANGLADESH - DHAKA', source: 'manual', isUserEdited: true },
          'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
          'appl.birthdate': { value: '15 JAN 1992', source: 'passport', isUserEdited: false },
          'appl.email': { value: 'dynamic.user@example.com', source: 'passport', isUserEdited: false },
          'appl.email_re': { value: 'dynamic.user@example.com', source: 'passport', isUserEdited: false },
          'appl.journeydate': { value: '20/12/2026', source: 'manual', isUserEdited: true },
        },
        manualEdits: {},
        provenance: { lastSavedAt: new Date().toISOString() },
        sourceDocuments: {},
      }

      const candRes = resolveCandidateData({
        profileId: 'APPL_DYN_001',
        documents: [],
        savedApplication: savedApp,
      })

      assert(candRes.status === 'READY', 'Candidate resolution must be READY')
      assert(Boolean(candRes.applicant), 'Applicant profile must be resolved')

      const autofillResult = await executeAutofill({
        mappings: BANGLADESH_REGISTRATION_MAPPINGS,
        applicant: candRes.applicant!,
        options: { policy: 'fill-empty' },
      })

      assert(autofillResult.filledFields === 7, `Expected 7 filled fields, got ${autofillResult.filledFields}`)
      assert(autofillResult.failedFields === 1, `Expected 1 manual field (CAPTCHA), got ${autofillResult.failedFields}`)

      // Verify DOM values
      const countryEl = dom.window.document.getElementById('countryname_id') as HTMLSelectElement
      assert(countryEl.value === 'BGD', `Country value should be "BGD", got "${countryEl.value}"`)

      const missionEl = dom.window.document.getElementById('missioncode_id') as HTMLSelectElement
      assert(missionEl.value === '01', `Mission value should be "01", got "${missionEl.value}"`)

      const nationalityEl = dom.window.document.getElementById('nationality_id') as HTMLSelectElement
      assert(nationalityEl.value === 'BGD', `Nationality value should be "BGD", got "${nationalityEl.value}"`)

      const dobEl = dom.window.document.getElementById('dob_id') as HTMLInputElement
      assert(dobEl.value === '15/01/1992', `DOB value should be "15/01/1992", got "${dobEl.value}"`)

      const emailEl = dom.window.document.getElementById('email_id') as HTMLInputElement
      assert(emailEl.value === 'dynamic.user@example.com', `Email value should be "dynamic.user@example.com", got "${emailEl.value}"`)

      const journeyEl = dom.window.document.getElementById('jouryney_id') as HTMLInputElement
      assert(journeyEl.value === '20/12/2026', `Journey date should be "20/12/2026", got "${journeyEl.value}"`)

      const captchaEl = dom.window.document.getElementById('captcha') as HTMLInputElement
      assert(captchaEl.value === '', 'CAPTCHA must remain empty and untouched')

      assert(submitClicked === false, 'Save and Continue button must never be clicked by extension')
    } finally {
      globalThis.document = prevDoc
      globalThis.window = prevWin
      ;(globalThis as Record<string, unknown>).Node = prevNode
      ;(globalThis as Record<string, unknown>).Element = prevElem
      ;(globalThis as Record<string, unknown>).HTMLElement = prevHtmlElem
      ;(globalThis as Record<string, unknown>).HTMLInputElement = prevHtmlInput
      ;(globalThis as Record<string, unknown>).HTMLSelectElement = prevHtmlSelect
    }
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
