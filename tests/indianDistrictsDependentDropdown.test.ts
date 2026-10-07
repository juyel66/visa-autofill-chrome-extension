import {
  PORTAL_INDIAN_STATES_OPTIONS,
  INDIAN_STATE_DISTRICTS_MAP,
  getDistrictsForIndianState,
  getStateForIndianDistrict,
  normalizeIndianStateName,
  ALL_INDIAN_DISTRICTS_OPTIONS,
} from '../src/countries/india/options/registrationOptions'

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failed++
  }
}

console.log('==================================================')
console.log('STARTING INDIAN STATE & DISTRICT DEPENDENT DROPDOWN TESTS')
console.log('==================================================\n')

console.log('--- 1. COVERAGE FOR ALL 37 STATES IN PORTAL OPTIONS ---')
assert(
  PORTAL_INDIAN_STATES_OPTIONS.length === 37,
  `Portal has 37 states/UTs (found ${PORTAL_INDIAN_STATES_OPTIONS.length})`
)

let allStatesHaveDistricts = true
for (const stateOpt of PORTAL_INDIAN_STATES_OPTIONS) {
  const districts = getDistrictsForIndianState(stateOpt.value)
  if (!districts || districts.length === 0) {
    allStatesHaveDistricts = false
    console.error(`Missing districts for state: ${stateOpt.value}`)
  }
}
assert(
  allStatesHaveDistricts,
  'All 37 Indian States and Union Territories have mapped districts'
)

console.log('\n--- 2. COMMON STATES VERIFICATION ---')
const wbDistricts = getDistrictsForIndianState('WEST BENGAL')
assert(
  wbDistricts.length > 20,
  `West Bengal has complete districts (found ${wbDistricts.length})`
)
assert(
  wbDistricts.some((d) => d.value === 'KOLKATA'),
  'West Bengal contains KOLKATA'
)
assert(
  wbDistricts.some((d) => d.value === 'DARJEELING'),
  'West Bengal contains DARJEELING'
)
assert(
  wbDistricts.some((d) => d.value === 'NORTH 24 PARGANAS'),
  'West Bengal contains NORTH 24 PARGANAS'
)

const delhiDistricts = getDistrictsForIndianState('DELHI')
assert(
  delhiDistricts.length >= 10,
  `Delhi has complete districts (found ${delhiDistricts.length})`
)
assert(
  delhiDistricts.some((d) => d.value === 'NEW DELHI'),
  'Delhi contains NEW DELHI'
)

const mhDistricts = getDistrictsForIndianState('MAHARASHTRA')
assert(
  mhDistricts.some((d) => d.value === 'MUMBAI') ||
    mhDistricts.some((d) => d.value === 'MUMBAI CITY'),
  'Maharashtra contains MUMBAI'
)
assert(
  mhDistricts.some((d) => d.value === 'PUNE'),
  'Maharashtra contains PUNE'
)

const tnDistricts = getDistrictsForIndianState('TAMIL NADU')
assert(
  tnDistricts.some((d) => d.value === 'CHENNAI'),
  'Tamil Nadu contains CHENNAI'
)

console.log('\n--- 3. DISTRICT TO STATE REVERSE INFERENCE ---')
assert(
  getStateForIndianDistrict('KOLKATA') === 'WEST BENGAL',
  'KOLKATA resolves automatically to WEST BENGAL'
)
assert(
  getStateForIndianDistrict('NEW DELHI') === 'DELHI',
  'NEW DELHI resolves automatically to DELHI'
)
assert(
  getStateForIndianDistrict('PUNE') === 'MAHARASHTRA',
  'PUNE resolves automatically to MAHARASHTRA'
)
assert(
  getStateForIndianDistrict('CHENNAI') === 'TAMIL NADU',
  'CHENNAI resolves automatically to TAMIL NADU'
)
assert(
  getStateForIndianDistrict('BENGALURU URBAN') === 'KARNATAKA',
  'BENGALURU URBAN resolves automatically to KARNATAKA'
)
assert(
  getStateForIndianDistrict('UNKNOWN_DISTRICT') === null,
  'Unknown district returns null'
)

console.log('\n--- 4. ALL DISTRICTS FALLBACK & CASING ---')
assert(
  ALL_INDIAN_DISTRICTS_OPTIONS.length > 700,
  `Flat list contains over 700 Indian districts (found ${ALL_INDIAN_DISTRICTS_OPTIONS.length})`
)
assert(
  ALL_INDIAN_DISTRICTS_OPTIONS.every((d) => d.value === d.value.toUpperCase()),
  'All district options are strictly uppercase'
)

console.log('\n==================================================')
console.log(`TESTS FINISHED: Passed=${passed}, Failed=${failed}`)
console.log('==================================================')

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
