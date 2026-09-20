const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
const key = match[1].trim();

const pdfBytes = fs.readFileSync('tests/fixtures/Josoda passport.pdf');
const b64 = pdfBytes.toString('base64');

const PASSPORT_EXTRACTION_PROMPT = `
You are an expert OCR & document parsing AI specializing in international passports, visas, national ID cards, and travel documents.

Analyze ALL provided document image(s) or PDF pages (including single/dual-page scans, MRZ lines, emergency contact page, visual data zones, and stamps).

Extract ONLY information visibly present in the document.
If a field is not present or cannot be reliably read from the document, return null.
Do NOT invent, guess, or default any fields (such as father nationality, place of issue, country of issue, religion, or phone numbers).

Return ONLY a valid JSON object matching the standard schema:
{
  "personal": {
    "surname": null,
    "givenNames": null,
    "fullName": null,
    "sex": null,
    "dateOfBirth": null,
    "townCityOfBirth": null,
    "countryOfBirth": null,
    "nationality": null,
    "nationalIdNumber": null,
    "religion": null
  },
  "passport": {
    "passportNumber": null,
    "passportType": null,
    "issuingCountry": null,
    "placeOfIssue": null,
    "issueDate": null,
    "expiryDate": null,
    "holdsOtherPassport": null,
    "otherPassportNumber": null
  },
  "contact": {
    "email": null,
    "phone": null,
    "mobile": null,
    "isdCode": null
  },
  "presentAddress": {
    "addressLine1": null,
    "addressLine2": null,
    "villageTownCity": null,
    "district": null,
    "stateProvince": null,
    "postalCode": null,
    "country": null
  },
  "permanentAddress": {
    "addressLine1": null,
    "addressLine2": null,
    "villageTownCity": null,
    "district": null,
    "stateProvince": null,
    "postalCode": null,
    "country": null
  },
  "family": {
    "fatherName": null,
    "motherName": null,
    "spouseName": null
  }
}
`;

async function testExtraction() {
  const start = Date.now();
  console.log('Sending Josoda passport.pdf directly to gemini-flash-latest...');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: PASSPORT_EXTRACTION_PROMPT },
          { inline_data: { mime_type: 'application/pdf', data: b64 } }
        ]
      }],
      generationConfig: { response_mime_type: 'application/json' }
    })
  });

  console.log('Status:', res.status, 'Duration:', (Date.now() - start) + 'ms');
  const json = await res.json();
  if (res.ok) {
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('RAW JSON RESULT:');
    console.log(raw);
  } else {
    console.error('Error:', json);
  }
}

testExtraction();
