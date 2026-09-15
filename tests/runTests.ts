import './setup.ts'

import { runPersonalPassportAutofillTests } from '../src/countries/india/__tests__/personalPassportAutofill.test'
import { runDomVerificationAutofillTests } from '../src/core/autofill/__tests__/domVerificationAutofill.test'
import { runIndiaCompatibilityTests } from '../src/countries/india/__tests__/compatibility.test'
import { runBangladeshSelectorTests } from '../src/countries/india/__tests__/bangladeshSelector.test'
import { runE2EIntegrationTestSuite } from '../src/core/__tests__/e2eIntegration.test'
import { runDocumentAutofillTests } from '../src/countries/india/__tests__/documentAutofill.test'
import { runWorkflowHardeningTests } from '../src/countries/india/__tests__/workflowHardening.test'
import { runRecoveryTests } from '../src/countries/india/__tests__/recovery.test'
import { runCandidateResolverTests } from '../src/countries/india/__tests__/candidateResolver.test'
import { runValidationTests } from '../src/countries/india/__tests__/validation.test'
import { runAddressFamilyExtractionTests } from '../src/countries/india/__tests__/addressFamilyExtraction.test'
import { runTravelDetailsExtractionTests } from '../src/countries/india/__tests__/travelDetailsExtraction.test'
import { runRuntimeAutofillRegressionTests } from '../src/core/autofill/__tests__/runtimeAutofillRegression.test'
import { runApplicationWorkspaceTests } from '../src/core/application/__tests__/applicationWorkspace.test'
import { runEndToEndWorkflowTests } from '../src/countries/india/__tests__/endToEndWorkflow.test'
import { runOgdFullFieldExtractionTests } from '../src/core/extraction/__tests__/ogdFullFieldExtraction.test'
import { runScannedPassportOcrTests } from '../src/core/extraction/__tests__/scannedPassportOcr.test'
import { runTask062RealPassportUploadWorkspaceTests } from '../src/core/__tests__/task062RealPassportUploadWorkspace.test'
import { runHighConfidenceReligionTests } from '../src/core/extraction/__tests__/highConfidenceReligionExtraction.test'
import { runBangladeshiNameNormalizationReligionSafetyTests } from '../src/core/extraction/__tests__/bangladeshiNameNormalizationReligionSafety.test'
import { runAddressContactExtractionTests } from '../src/core/extraction/__tests__/addressContactExtraction.test'
import { runTask077HardcodeAuditTests } from '../src/core/__tests__/task077HardcodeAudit.test'
import { runTask079DynamicExtractionTests } from '../src/core/__tests__/task079DynamicExtraction.test'
import { runTask081AddressSplittingTests } from '../src/core/__tests__/task081AddressSplitting.test'
import { runRegistrationAutofillTests } from '../src/countries/india/__tests__/registrationAutofill.test'
import { runContentScriptInjectionTests } from '../src/core/messaging/__tests__/contentScriptInjection.test'
import { runTask083PurposeOfVisitTests } from '../src/core/__tests__/task083PurposeOfVisit.test'
import { runTask084PurposeDebugTests } from '../src/core/__tests__/task084PurposeDebug.test'
import { runTask091AddressAutofillTests } from '../src/core/__tests__/task091AddressAutofill.test'
import { runTask090OtherPassportAutofillTests } from '../src/core/__tests__/task090OtherPassportAutofill.test'
import { runTask089ChangedNameAutofillTests } from '../src/core/__tests__/task089ChangedNameAutofill.test'
import { runTask088FullWorkspacePortalRedesignTests } from '../src/core/__tests__/task088FullWorkspacePortalRedesign.test'
import { runTask087RegistrationWorkspaceRedesignTests } from '../src/core/__tests__/task087RegistrationWorkspaceRedesign.test'
import { runTask086FirstClickRegistrationDefinitiveTests } from '../src/core/__tests__/task086FirstClickRegistrationDefinitive.test'
import { runTask085FirstClickRegistrationAutofillTests } from '../src/core/__tests__/task085FirstClickRegistrationAutofill.test'

async function execute() {
  console.log('--- RUNNING TASK 091: ADDRESS SPLITTING & FAMILY DETAILS AUTOFILL TESTS ---')
  const task091Res = await runTask091AddressAutofillTests()
  console.log(`Passed: ${task091Res.passed}, Count: ${task091Res.totalSubtests}`)
  if (!task091Res.passed) {
    console.error('Failures:', task091Res.failures)
  }

  console.log('--- RUNNING TASK 090: OTHER PASSPORT (IC) AUTOFILL & DATE FORMATTING TESTS ---')
  const task090Res = await runTask090OtherPassportAutofillTests()
  console.log(`Passed: ${task090Res.passed}, Count: ${task090Res.totalSubtests}`)
  if (!task090Res.passed) {
    console.error('Failures:', task090Res.failures)
  }

  console.log('--- RUNNING TASK 089: CHANGED NAME CHECKBOX & PREVIOUS SURNAME/NAME AUTOFILL TESTS ---')
  const task089Res = await runTask089ChangedNameAutofillTests()
  console.log(`Passed: ${task089Res.passed}, Count: ${task089Res.totalSubtests}`)
  if (!task089Res.passed) {
    console.error('Failures:', task089Res.failures)
  }

  console.log('--- RUNNING TASK 088: ALL 4 PORTAL PAGES WORKSPACE REDESIGN TESTS ---')
  const task088Res = await runTask088FullWorkspacePortalRedesignTests()
  console.log(`Passed: ${task088Res.passed}, Count: ${task088Res.totalSubtests}`)
  if (!task088Res.passed) {
    console.error('Failures:', task088Res.failures)
  }

  console.log('--- RUNNING TASK 087: APPLICATION WORKSPACE REGISTRATION PAGE REDESIGN TESTS ---')
  const task087Res = await runTask087RegistrationWorkspaceRedesignTests()
  console.log(`Passed: ${task087Res.passed}, Count: ${task087Res.totalSubtests}`)
  if (!task087Res.passed) {
    console.error('Failures:', task087Res.failures)
  }

  console.log('--- RUNNING TASK 086: DEFINITIVE FIRST-CLICK REGISTRATION AUTOFILL TESTS ---')
  const task086Res = await runTask086FirstClickRegistrationDefinitiveTests()
  const task086Passed = task086Res.failedTests === 0
  console.log(`Passed: ${task086Passed}, Count: ${task086Res.totalTests}`)
  if (!task086Passed) {
    console.error('Failures:', task086Res.errors)
  }

  console.log('--- RUNNING TASK 085: FIRST-CLICK REGISTRATION AUTOFILL & ASYNC PURPOSE TESTS ---')
  const task085Res = await runTask085FirstClickRegistrationAutofillTests()

  console.log(`Passed: ${task085Res.passed}, Count: ${task085Res.totalSubtests}`)
  if (!task085Res.passed) {
    console.error('Failures:', task085Res.failures)
  }

  console.log('--- RUNNING TASK 084: PURPOSE OF VISIT END-TO-END DEBUG TESTS ---')
  const task084Res = await runTask084PurposeDebugTests()
  console.log(`Passed: ${task084Res.passed}, Count: ${task084Res.totalSubtests}`)
  if (!task084Res.passed) {
    console.error('Failures:', task084Res.failures)
  }

  console.log('--- RUNNING TASK 083: PURPOSE OF VISIT & REGISTRATION AUTOFILL TESTS ---')
  const task083Res = await runTask083PurposeOfVisitTests()
  console.log(`Passed: ${task083Res.passed}, Count: ${task083Res.totalSubtests}`)
  if (!task083Res.passed) {
    console.error('Failures:', task083Res.failures)
  }

  console.log('--- RUNNING TASK 082-FIX: CONTENT SCRIPT INJECTION & READINESS TESTS ---')
  const task082FixRes = await runContentScriptInjectionTests()
  console.log(`Passed: ${task082FixRes.passed}, Count: ${task082FixRes.totalSubtests}`)
  if (!task082FixRes.passed) {
    console.error('Failures:', task082FixRes.failures)
  }

  console.log('--- RUNNING TASK 082: INDIAN VISA REGISTRATION PAGE AUTOFILL TESTS ---')
  const task082Res = await runRegistrationAutofillTests()
  console.log(`Passed: ${task082Res.passed}, Count: ${task082Res.totalSubtests}`)
  if (!task082Res.passed) {
    console.error('Failures:', task082Res.failures)
  }

  console.log('--- RUNNING TASK 081: DYNAMIC ADDRESS SPLITTING & EXTRACTION TESTS ---')
  const task081Res = await runTask081AddressSplittingTests()
  console.log(`Passed: ${task081Res.passed}, Count: ${task081Res.totalSubtests}`)
  if (!task081Res.passed) {
    console.error('Failures:', task081Res.failures)
  }

  console.log('--- RUNNING TASK 079: DYNAMIC GEMINI EXTRACTION & ISOLATION TESTS ---')
  const task079Res = await runTask079DynamicExtractionTests()
  console.log(`Passed: ${task079Res.passed}, Count: ${task079Res.totalSubtests}`)
  if (!task079Res.passed) {
    console.error('Failures:', task079Res.failures)
  }

  console.log('--- RUNNING TASK 077: STATIC PRODUCTION HARDCODE AUDIT & APPLICANT ISOLATION TESTS ---')
  const task077Res = await runTask077HardcodeAuditTests()
  console.log(`Passed: ${task077Res.passed}, Count: ${task077Res.totalSubtests}`)
  if (!task077Res.passed) {
    console.error('Failures:', task077Res.failures)
  }

  console.log('--- RUNNING TASK 062: REAL PASSPORT UPLOAD → WORKSPACE VERIFICATION ---')
  const task062Res = await runTask062RealPassportUploadWorkspaceTests()
  console.log(`Passed: ${task062Res.passed}, Count: ${task062Res.totalSubtests}`)
  if (!task062Res.passed) {
    console.error('Failures:', task062Res.failures)
  }

  console.log('--- RUNNING SCANNED PASSPORT OCR TESTS (TASK 058) ---')
  const passOcrRes = await runScannedPassportOcrTests()
  console.log(`Passed: ${passOcrRes.passed}, Count: ${passOcrRes.totalSubtests}`)
  if (!passOcrRes.passed) {
    console.error('Failures:', passOcrRes.failures)
  }

  console.log('--- RUNNING OGD FULL-FIELD EXTRACTION TESTS (TASK 057) ---')
  const ogdRes = await runOgdFullFieldExtractionTests()
  console.log(`Passed: ${ogdRes.passed}, Count: ${ogdRes.totalSubtests}`)
  if (!ogdRes.passed) {
    console.error('Failures:', ogdRes.failures)
  }

  console.log('--- RUNNING COMPLETE END-TO-END WORKFLOW TESTS (TASK 056) ---')
  const e2eWorkflowRes = await runEndToEndWorkflowTests()
  console.log(`Passed: ${e2eWorkflowRes.passed}, Count: ${e2eWorkflowRes.totalSubtests}`)
  if (!e2eWorkflowRes.passed) {
    console.error('Failures:', e2eWorkflowRes.failures)
  }

  console.log('--- RUNNING APPLICATION WORKSPACE & SAVED APPLICATION TESTS (TASK 054) ---')
  const appWorkspaceRes = await runApplicationWorkspaceTests()
  console.log(`Passed: ${appWorkspaceRes.passed}, Count: ${appWorkspaceRes.totalSubtests}`)
  if (!appWorkspaceRes.passed) {
    console.error('Failures:', appWorkspaceRes.failures)
  }
  console.log('--- RUNNING DOM VERIFICATION & AUTOFILL HARDENING TESTS ---')
  const domVerifyRes = await runDomVerificationAutofillTests()
  console.log(`Passed: ${domVerifyRes.passed}, Count: ${domVerifyRes.totalSubtests}`)
  if (!domVerifyRes.passed) {
    console.error('Failures:', domVerifyRes.failures)
  }
  console.log('--- RUNNING CANDIDATE DATA RESOLVER TESTS ---')
  const candResolverRes = runCandidateResolverTests()
  console.log(`Passed: ${candResolverRes.passed}, Count: ${candResolverRes.totalSubtests}`)
  if (!candResolverRes.passed) {
    console.error('Failures:', candResolverRes.failures)
  }

  console.log('--- RUNNING INDIA COMPATIBILITY TESTS ---')
  const compatRes = runIndiaCompatibilityTests()
  console.log(`Passed: ${compatRes.passed}, Count: ${compatRes.testCount}`)
  if (!compatRes.passed) {
    console.error('Failures:', compatRes.failures)
  }

  console.log('--- RUNNING BANGLADESH SELECTOR & CANONICAL MAPPING TESTS ---')
  const bdSelectorRes = await runBangladeshSelectorTests()
  console.log(`Passed: ${bdSelectorRes.passed}, Count: ${bdSelectorRes.testCount}`)
  if (!bdSelectorRes.passed) {
    console.error('Failures:', bdSelectorRes.failures)
  }

  console.log('--- RUNNING ADDRESS & FAMILY DETAILS EXTRACTION TESTS ---')
  const addrFamRes = await runAddressFamilyExtractionTests()
  console.log(`Passed: ${addrFamRes.passed}, Count: ${addrFamRes.totalSubtests}`)
  if (!addrFamRes.passed) {
    console.error('Failures:', addrFamRes.failures)
  }

  console.log('--- RUNNING TRAVEL & VISA DETAILS EXTRACTION TESTS (TASK 051) ---')
  const travelRes = await runTravelDetailsExtractionTests()
  console.log(`Passed: ${travelRes.passed}, Count: ${travelRes.testCount}`)
  if (!travelRes.passed) {
    console.error('Failures:', travelRes.failures)
  }

  console.log('--- RUNNING PERSONAL & PASSPORT & ADDITIONAL SECTIONS AUTOFILL TESTS ---')
  const autofillRes = await runPersonalPassportAutofillTests()
  console.log(`Passed: ${autofillRes.passed}, Count: ${autofillRes.totalSubtests}`)
  if (!autofillRes.passed) {
    console.error('Failures:', autofillRes.failures)
  }

  console.log('--- RUNNING DOCUMENT AUTOFILL TESTS ---')
  const docRes = await runDocumentAutofillTests()
  console.log(`Passed: ${docRes.passed}, Count: ${docRes.totalSubtests}`)
  if (!docRes.passed) {
    console.error('Failures:', docRes.failures)
  }

  console.log('--- RUNNING WORKFLOW HARDENING TESTS ---')
  const workflowRes = await runWorkflowHardeningTests()
  console.log(`Passed: ${workflowRes.passed}, Count: ${workflowRes.totalSubtests}`)
  if (!workflowRes.passed) {
    console.error('Failures:', workflowRes.failures)
  }

  console.log('--- RUNNING AUTOFILL FAILURE RECOVERY TESTS ---')
  const recoveryRes = await runRecoveryTests()
  console.log(`Passed: ${recoveryRes.passed}, Count: ${recoveryRes.totalSubtests}`)
  if (!recoveryRes.passed) {
    console.error('Failures:', recoveryRes.failures)
  }

  console.log('--- RUNNING AUTOFILL FIELD VALIDATION & SAFETY TESTS ---')
  const validationRes = await runValidationTests()
  console.log(`Passed: ${validationRes.passed}, Count: ${validationRes.totalSubtests}`)
  if (!validationRes.passed) {
    console.error('Failures:', validationRes.failures)
  }

  console.log('--- RUNNING RUNTIME AUTOFILL REGRESSION TESTS (TASK 053) ---')
  const runtimeRegRes = await runRuntimeAutofillRegressionTests()
  console.log(`Passed: ${runtimeRegRes.passed}, Count: ${runtimeRegRes.totalSubtests}`)
  if (!runtimeRegRes.passed) {
    console.error('Failures:', runtimeRegRes.failures)
  }

  console.log('--- RUNNING E2E INTEGRATION TEST SUITE ---')
  const e2eRes = await runE2EIntegrationTestSuite()
  console.log(`Passed: ${e2eRes.overallPassed}, Count: ${e2eRes.passedCount}/${e2eRes.totalStages}`)
  if (!e2eRes.overallPassed) {
    console.error('Stages:', e2eRes.stageResults)
  }
  
  console.log('--- RUNNING HIGH-CONFIDENCE RELIGION EXTRACTION TESTS (TASK 068) ---')
  const religionRes = await runHighConfidenceReligionTests()
  console.log(`Passed: ${religionRes.passed}, Count: ${religionRes.totalSubtests}`)
  if (!religionRes.passed) {
    console.error('Failures:', religionRes.failures)
  }

  console.log('--- RUNNING BANGLADESHI NAME NORMALIZATION & RELIGION SAFETY TESTS (TASK 069) ---')
  const nameSafetyRes = await runBangladeshiNameNormalizationReligionSafetyTests()
  console.log(`Passed: ${nameSafetyRes.passed}, Count: ${nameSafetyRes.totalSubtests}`)
  if (!nameSafetyRes.passed) {
    console.error('Failures:', nameSafetyRes.failures)
  }

  console.log('--- RUNNING ADDRESS & CONTACT STRUCTURE EXTRACTION TESTS (TASK 070) ---')
  const addrContactRes = await runAddressContactExtractionTests()
  console.log(`Passed: ${addrContactRes.passed}, Count: ${addrContactRes.totalSubtests}`)
  if (!addrContactRes.passed) {
    console.error('Failures:', addrContactRes.failures)
  }

  const results = {
    task091: task091Res.passed,
    task090: task090Res.passed,
    task089: task089Res.passed,
    task088: task088Res.passed,
    task087: task087Res.passed,
    task086: task086Passed,
    task085: task085Res.passed,
    task084: task084Res.passed,

    task083: task083Res.passed,
    task082Fix: task082FixRes.passed,
    task082: task082Res.passed,
    task081: task081Res.passed,
    task079: task079Res.passed,
    task077: task077Res.passed,
    addrContact: addrContactRes.passed,
    nameSafety: nameSafetyRes.passed,
    religion: religionRes.passed,
    task062: task062Res.passed,
    passOcr: passOcrRes.passed,
    ogd: ogdRes.passed,
    e2eWorkflow: e2eWorkflowRes.passed,
    appWorkspace: appWorkspaceRes.passed,
    domVerify: domVerifyRes.passed,
    candResolver: candResolverRes.passed,
    compat: compatRes.passed,
    bdSelector: bdSelectorRes.passed,
    addrFam: addrFamRes.passed,
    travel: travelRes.passed,
    autofill: autofillRes.passed,
    doc: docRes.passed,
    workflow: workflowRes.passed,
    recovery: recoveryRes.passed,
    validation: validationRes.passed,
    runtimeReg: runtimeRegRes.passed,
    e2e: e2eRes.overallPassed,
  }
  console.log('Suite results breakdown:', results)

  const allPassed = Object.values(results).every(Boolean)
  if (allPassed) {
    console.log('✅ ALL TEST SUITES PASSED SUCCESSFULLY!')
    process.exit(0)
  } else {
    console.error('❌ SOME TEST SUITES FAILED!', Object.entries(results).filter(([, v]) => !v))
    process.exit(1)
  }
}

execute().catch(err => {
  console.error(err)
  process.exit(1)
})

