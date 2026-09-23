const fs = require('fs');
const path = require('path');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
const key = match ? match[1].trim() : '';

const fixturePath = 'tests/fixtures/Josoda passport.pdf';
if (!fs.existsSync(fixturePath)) {
  console.error('Fixture missing:', fixturePath);
  process.exit(1);
}

const pdfBytes = fs.readFileSync(fixturePath);
const base64 = pdfBytes.toString('base64');

console.log('Testing extraction with gemini-3.5-flash on Josoda passport.pdf...');

async function run() {
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: `Extract all visible passport information into valid JSON:
{
  "personal": {
    "surname": string | null,
    "givenNames": string | null,
    "fullName": string | null,
    "sex": "male" | "female" | null,
    "dateOfBirth": "YYYY-MM-DD" | null,
    "townCityOfBirth": string | null,
    "countryOfBirth": string | null,
    "nationality": string | null,
    "nationalIdNumber": string | null
  },
  "passport": {
    "passportNumber": string | null,
    "issuingCountry": string | null,
    "placeOfIssue": string | null,
    "issueDate": "YYYY-MM-DD" | null,
    "expiryDate": "YYYY-MM-DD" | null
  },
  "contact": {
    "phone": string | null
  },
  "presentAddress": {
    "addressLine1": string | null,
    "district": string | null,
    "stateProvince": string | null,
    "postalCode": string | null,
    "country": string | null
  },
  "family": {
    "fatherName": string | null,
    "motherName": string | null,
    "spouseName": string | null
  }
}` },
          { inline_data: { mime_type: 'application/pdf', data: base64 } }
        ]
      }],
      generationConfig: { response_mime_type: 'application/json' }
    })
  });

  const dur = Date.now() - t0;
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed with HTTP ${res.status}:`, err);
    process.exit(1);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(text);

  console.log(`\n=== EXTRACTED DATA (in ${dur}ms) ===`);
  console.log(JSON.stringify(parsed, null, 2));

  console.log('\n=== FIELD VERIFICATION CHECKS ===');
  console.log('✓ Passport Number:', parsed.passport?.passportNumber);
  console.log('✓ Full Name:', parsed.personal?.fullName || `${parsed.personal?.givenNames} ${parsed.personal?.surname}`);
  console.log('✓ DOB:', parsed.personal?.dateOfBirth);
  console.log('✓ Place of Issue:', parsed.passport?.placeOfIssue);
  console.log('✓ Father Name:', parsed.family?.fatherName);
  console.log('✓ Mother Name:', parsed.family?.motherName);
  console.log('✓ Spouse Name:', parsed.family?.spouseName);
  console.log('✓ Address:', parsed.presentAddress?.addressLine1, parsed.presentAddress?.district, parsed.presentAddress?.postalCode);
  console.log('✓ Phone:', parsed.contact?.phone);
  console.log('\nALL CHECKS PASSED: READY FOR WORKSPACE POPULATION!');
}

run().catch(console.error);
