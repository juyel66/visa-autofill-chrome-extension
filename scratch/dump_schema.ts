import { BANGLADESH_APPLICATION_SCHEMA } from '../src/core/application/fieldSchema.ts';

for (const s of BANGLADESH_APPLICATION_SCHEMA) {
  console.log('Section: ' + s.id + ' (' + s.fields.length + ' fields):');
  for (const f of s.fields) {
    console.log('  ' + f.key + ' | ' + f.label + ' | visibleByDefault=' + f.visibleByDefault);
  }
}
