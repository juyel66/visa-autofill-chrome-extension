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

Return ONLY a valid JSON object matching the standard schema.
`;

async function runGeminiFull() {
  const models = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
  for (const m of models) {
    console.log(`Calling ${m}...`);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
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
      if (res.ok) {
        const json = await res.json();
        console.log(`✓ Succeeded with ${m}:`);
        console.log(json.candidates?.[0]?.content?.parts?.[0]?.text);
        return;
      } else {
        const err = await res.text();
        console.log(`✗ ${m} failed with ${res.status}:`, err.substring(0, 150));
      }
    } catch (e) {
      console.log(`✗ ${m} error:`, e.message);
    }
  }
}

runGeminiFull();
