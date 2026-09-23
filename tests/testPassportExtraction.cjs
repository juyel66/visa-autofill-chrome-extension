const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
const key = match[1].trim();

const pdfBytes = fs.readFileSync('tests/fixtures/Josoda passport.pdf');
const b64 = pdfBytes.toString('base64');

async function testExtraction() {
  const models = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
  
  for (const m of models) {
    console.log(`Testing model: ${m}...`);
    const t0 = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Extract all applicant data into valid JSON matching:
{
  "personal": {
    "surname": string | null,
    "givenNames": string | null,
    "fullName": string | null,
    "sex": "male" | "female" | null,
    "dateOfBirth": "YYYY-MM-DD" | null,
    "townCityOfBirth": string | null,
    "countryOfBirth": string | null,
    "nationality": string | null
  },
  "passport": {
    "passportNumber": string | null,
    "issuingCountry": string | null,
    "placeOfIssue": string | null,
    "issueDate": "YYYY-MM-DD" | null,
    "expiryDate": "YYYY-MM-DD" | null
  },
  "contact": {
    "phone": string | null,
    "email": string | null
  },
  "presentAddress": {
    "addressLine1": string | null,
    "addressLine2": string | null,
    "villageTownCity": string | null,
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
              { inline_data: { mime_type: 'application/pdf', data: b64 } }
            ]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      
      const elapsed = Date.now() - t0;
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`✓ SUCCESS with ${m} in ${elapsed}ms:`);
        console.log(text);
        return;
      } else {
        const err = await res.text();
        console.log(`✗ FAILED with ${m} (HTTP ${res.status}) in ${elapsed}ms: ${err.substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`✗ ERROR with ${m}: ${e.message}`);
    }
  }
}

testExtraction();
