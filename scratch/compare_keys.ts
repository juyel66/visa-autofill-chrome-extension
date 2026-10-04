import fs from 'fs';
import { BANGLADESH_APPLICATION_SCHEMA } from '../src/core/application/fieldSchema.ts';

const files = [
  './src/application/components/RegistrationSection.tsx',
  './src/application/components/BasicDetailsSection.tsx',
  './src/application/components/FamilyDetailsSection.tsx',
  './src/application/components/VisaDetailsSection.tsx',
  './src/application/components/AdditionalQuestionsSection.tsx',
];

const workspaceKeys = new Set();

// Add the question keys from AdditionalQuestionsSection
for (let i = 1; i <= 6; i++) {
  workspaceKeys.add(`question_${i}_flag`);
  workspaceKeys.add(`answer_${i}`);
}

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const matches = content.matchAll(/onFieldChange\(\s*['"]([^'"]+)['"]/g);
  for (const m of matches) {
    workspaceKeys.add(m[1]);
  }
}

const schemaKeys = new Set(BANGLADESH_APPLICATION_SCHEMA.flatMap(s => s.fields).map(f => f.key));

console.log('Total unique workspaceKeys:', workspaceKeys.size);
console.log('Total unique schemaKeys:', schemaKeys.size);

const inSchemaNotWorkspace = [...schemaKeys].filter(k => !workspaceKeys.has(k));
console.log('In schema but not in workspace onFieldChange:', inSchemaNotWorkspace);

const inWorkspaceNotSchema = [...workspaceKeys].filter(k => !schemaKeys.has(k));
console.log('In workspace onFieldChange but not in schema:', inWorkspaceNotSchema);
