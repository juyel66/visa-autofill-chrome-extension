const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
const key = match[1].trim();

const pdfBytes = fs.readFileSync('tests/fixtures/Josoda passport.pdf');
const b64 = pdfBytes.toString('base64');

async function testSmartFallback() {
  const models = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
  let successfulData = null;

  for (const m of models) {
    console.log(`Trying ${m}...`);
    const start = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract passport data in JSON: {"passport": {"passportNumber": ""}, "personal": {"fullName": "", "surname": "", "givenNames": ""}}' },
              { inline_data: { mime_type: 'application/pdf', data: b64 } }
            ]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      const dur = Date.now() - start;
      if (res.ok) {
        const json = await res.json();
        console.log(`✓ ${m} succeeded in ${dur}ms!`);
        successfulData = json.candidates?.[0]?.content?.parts?.[0]?.text;
        break; // STOP IMMEDIATELY ON SUCCESS: 1 request, 1 response!
      } else {
        console.log(`✗ ${m} returned ${res.status}, trying next fallback model...`);
      }
    } catch (e) {
      console.log(`✗ ${m} error: ${e.message}`);
    }
  }

  console.log('Result:', successfulData);
}

testSmartFallback();
