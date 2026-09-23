const fs = require('fs');
const key = fs.readFileSync('.env', 'utf8').match(/VITE_GEMINI_API_KEY=(.+)/)[1].trim();

const modelsToTest = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-pro-latest'
];

async function check() {
  console.log('Testing with simple text:');
  for (const m of modelsToTest) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond: {"ok":true}' }] }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      const d = await res.json();
      console.log(`${m}: HTTP ${res.status} -> ${res.ok ? 'OK' : d.error?.message?.slice(0, 70)}`);
    } catch (e) {
      console.log(`${m}: ERR -> ${e.message}`);
    }
  }
}

check();
