import fs from 'fs';
const files = [
  './src/application/components/RegistrationSection.tsx',
  './src/application/components/BasicDetailsSection.tsx',
  './src/application/components/FamilyDetailsSection.tsx',
  './src/application/components/VisaDetailsSection.tsx',
  './src/application/components/AdditionalQuestionsSection.tsx',
];
const fieldChanges = new Set();
for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const matches = content.matchAll(/onFieldChange\(\s*['"]([^'"]+)['"]/g);
  for (const m of matches) {
    fieldChanges.add(m[1]);
  }
}
console.log('Unique onFieldChange keys count:', fieldChanges.size);
console.log(JSON.stringify(Array.from(fieldChanges).sort()));
