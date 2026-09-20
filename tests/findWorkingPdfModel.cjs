const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
const key = match[1].trim();

const pdfBytes = fs.readFileSync('tests/fixtures/Josoda passport.pdf');
const b64 = pdfBytes.toString('base64');

async function testPdfModels() {
  const models = [
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest'
  ];

  for (const m of models) {
    const start = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract passport info in JSON' },
              { inline_data: { mime_type: 'application/pdf', data: b64 } }
            ]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      const dur = Date.now() - start;
      const json = await res.json();
      if (res.ok) {
        console.log(`✓ ${m} SUCCEEDED in ${dur}ms:`, json.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100));
        break;
      } else {
        console.log(`✗ ${m} failed (${res.status}) in ${dur}ms:`, json.error?.message?.substring(0, 80));
      }
    } catch (e) {
      console.log(`✗ ${m} error:`, e.message);
    }
  }
}

testPdfModels();
