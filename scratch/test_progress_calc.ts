import { BANGLADESH_APPLICATION_SCHEMA, getAllSchemaFields } from '../src/core/application/fieldSchema.ts';

// Set of legacy fields to exclude completely
const LEGACY_EXCLUDED = new Set(['state_name', 'perm_add3', 'appl.changedSurnameCheck']);

export function isFieldApplicable(key: string, fields: Record<string, any>): boolean {
  if (LEGACY_EXCLUDED.has(key)) return false;

  const getVal = (fieldKey: string): string => {
    const val = fields[fieldKey]?.value ?? fields[fieldKey];
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return '';
  };

  const getBool = (fieldKey: string): boolean => {
    const val = fields[fieldKey]?.value ?? fields[fieldKey];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      return lower === 'yes' || lower === 'true';
    }
    return false;
  };

  if (key === 'appl.prev_surname' || key === 'appl.prev_name') {
    const hasChangedName = fields['appl.changedSurnameCheck'] !== undefined
      ? getBool('appl.changedSurnameCheck')
      : Boolean(getVal('appl.prev_surname') || getVal('appl.prev_name'));
    return hasChangedName;
  }

  if (
    key === 'appl.prev_passport_country_issue' ||
    key === 'appl.oth_pptno' ||
    key === 'appl.oth_ppt_issue_date' ||
    key === 'appl.oth_ppt_issue_place' ||
    key === 'appl.other_ppt_nationality'
  ) {
    return getVal('appl.oth_ppt').toLowerCase() === 'yes';
  }

  if (
    key === 'spouse_name' ||
    key === 'spouse_place_of_birth' ||
    key === 'spouse_country_of_birth' ||
    key === 'spouse_nationality' ||
    key === 'spouse_prev_nationality'
  ) {
    return getVal('marital_status').toLowerCase() === 'married';
  }

  if (key === 'grandparent_details') {
    return getVal('grandparent_flag').toLowerCase() === 'yes';
  }

  if (key === 'occ_flag') {
    const occ = getVal('occupation').toUpperCase();
    return (
      occ === 'HOUSE WIFE' ||
      occ === 'HOUSEWIFE' ||
      occ === 'STUDENT' ||
      occ === 'UN-EMPLOYED' ||
      occ === 'UNEMPLOYED' ||
      occ === 'MINOR' ||
      Boolean(getVal('occ_flag'))
    );
  }

  if (
    key === 'previous_organization' ||
    key === 'previous_designation' ||
    key === 'previous_rank' ||
    key === 'previous_posting'
  ) {
    return getVal('prev_org').toLowerCase() === 'yes';
  }

  if (
    key === 'prv_visit_add1' ||
    key === 'prv_visit_add2' ||
    key === 'prv_visit_add3' ||
    key === 'cities_visited' ||
    key === 'old_visa_no' ||
    key === 'old_visa_type_id' ||
    key === 'oldvisaissueplace' ||
    key === 'oldvisaissuedate'
  ) {
    return getVal('old_visa_flag').toLowerCase() === 'yes';
  }

  if (key === 'refuse_details') {
    return (
      getVal('refuse_flag').toLowerCase() === 'yes' ||
      getVal('appl.refuse_flag').toLowerCase() === 'yes'
    );
  }

  if (key === 'saarc_details') {
    return getVal('saarc_flag').toLowerCase() === 'yes';
  }

  const questionMatch = key.match(/^answer_([1-6])$/);
  if (questionMatch) {
    const qNum = questionMatch[1];
    return getVal(`question_${qNum}_flag`).toLowerCase() === 'yes';
  }

  return true;
}

export function isFieldFilled(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'object' && 'value' in val) {
    val = val.value;
  }
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'boolean') return val === true;
  return false;
}

export function calculateProgress(fields: Record<string, any> = {}) {
  const allFields = getAllSchemaFields();
  const seenKeys = new Set();
  const applicableFields = [];
  const filledFields = [];
  const missingFields = [];

  for (const f of allFields) {
    if (seenKeys.has(f.key)) continue;
    seenKeys.add(f.key);

    if (isFieldApplicable(f.key, fields)) {
      applicableFields.push(f.key);
      const isFilled = isFieldFilled(fields[f.key]);
      if (isFilled) {
        filledFields.push(f.key);
      } else {
        missingFields.push(f.key);
      }
    }
  }

  const total = applicableFields.length;
  const filled = filledFields.length;
  const missing = missingFields.length;
  const percentage = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  const isComplete = total > 0 && filled >= total;

  return { total, filled, missing, percentage, isComplete, applicableFields, filledFields, missingFields };
}

// Test case 1: Single, no previous visa, no other passport, questions all No
const testApp1 = {
  marital_status: 'Single',
  appl_oth_ppt: 'No',
  old_visa_flag: 'No',
  grandparent_flag: 'No',
  prev_org: 'No',
  saarc_flag: 'No',
  refuse_flag: 'No',
  question_1_flag: 'No',
  question_2_flag: 'No',
  question_3_flag: 'No',
  question_4_flag: 'No',
  question_5_flag: 'No',
  question_6_flag: 'No',
};

const res1 = calculateProgress(testApp1);
console.log('App 1 (Single, minimal): total =', res1.total, 'filled =', res1.filled, 'percentage =', res1.percentage + '%');

// Test case 2: Married (+5 spouse fields)
const testApp2 = {
  ...testApp1,
  marital_status: 'Married',
};
const res2 = calculateProgress(testApp2);
console.log('App 2 (Married): total =', res2.total, 'diff =', res2.total - res1.total);

// Test case 3: Visited India (+8 visa fields)
const testApp3 = {
  ...testApp2,
  old_visa_flag: 'Yes',
};
const res3 = calculateProgress(testApp3);
console.log('App 3 (Visited India): total =', res3.total, 'diff =', res3.total - res2.total);
