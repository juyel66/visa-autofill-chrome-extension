const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const key = env.match(/VITE_GEMINI_API_KEY=(.+)/)[1].trim();

const models = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-flash-latest'
];

async function run() {
  for (const m of models) {
    const t0 = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with valid JSON: {"status": "ok"}' }] }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      const data = await res.json();
      console.log(`${m}: HTTP ${res.status} (${Date.now() - t0}ms) -> ${res.ok ? 'SUCCESS' : data.error?.message?.slice(0, 70)}`);
    } catch (e) {
      console.log(`${m}: ERROR -> ${e.message}`);
    }
  }
}
run();
