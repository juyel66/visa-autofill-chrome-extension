import { BANGLADESH_APPLICATION_SCHEMA, getAllSchemaFields } from '../src/core/application/fieldSchema.ts';

const allFields = getAllSchemaFields();
const uniqueMap = new Map();
allFields.forEach(f => {
  if (!uniqueMap.has(f.key)) {
    uniqueMap.set(f.key, f);
  }
});

console.log('Unique fields count:', uniqueMap.size);

// Print fields by section
for (const [key, field] of uniqueMap.entries()) {
  console.log(`${field.section} -> ${key} (${field.label})`);
}
