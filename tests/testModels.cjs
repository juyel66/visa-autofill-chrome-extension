const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
const key = match[1].trim();

const pdfBytes = fs.readFileSync('tests/fixtures/Josoda passport.pdf');
const b64 = pdfBytes.toString('base64');

const models = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest'
];

async function testAll() {
  for (const m of models) {
    const start = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract passport number, surname, given names, DOB, addresses from this passport PDF into JSON.' },
              { inline_data: { mime_type: 'application/pdf', data: b64 } }
            ]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      const dur = Date.now() - start;
      const json = await res.json();
      if (res.ok) {
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`✓ Model ${m} SUCCEEDED in ${dur}ms:`, text ? text.substring(0, 150) : 'no text');
      } else {
        console.log(`✗ Model ${m} FAILED with ${res.status} in ${dur}ms:`, JSON.stringify(json.error?.message || json).substring(0, 120));
      }
    } catch(e) {
      console.log(`✗ Model ${m} ERROR:`, e.message);
    }
  }
}
testAll();
