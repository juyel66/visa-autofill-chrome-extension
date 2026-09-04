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

async function execute() {
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

  console.log('--- RUNNING E2E INTEGRATION TEST SUITE ---')
  const e2eRes = await runE2EIntegrationTestSuite()
  console.log(`Passed: ${e2eRes.overallPassed}, Count: ${e2eRes.passedCount}/${e2eRes.totalStages}`)
  if (!e2eRes.overallPassed) {
    console.error('Stages:', e2eRes.stageResults)
  }
  
  if (
    domVerifyRes.passed &&
    candResolverRes.passed &&
    compatRes.passed &&
    bdSelectorRes.passed &&
    autofillRes.passed &&
    docRes.passed &&
    workflowRes.passed &&
    recoveryRes.passed &&
    validationRes.passed &&
    e2eRes.overallPassed
  ) {
    console.log('✅ ALL TEST SUITES PASSED SUCCESSFULLY!')
    process.exit(0)
  } else {
    console.error('❌ SOME TEST SUITES FAILED!')
    process.exit(1)
  }
}

execute().catch(err => {
  console.error(err)
  process.exit(1)
})
