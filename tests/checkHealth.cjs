const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
const key = match[1].trim();

async function testSimple() {
  const models = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview'
  ];

  for (const m of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say hello in JSON: {"greeting": "hello"}' }] }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✓ ${m}: OK`);
      } else {
        console.log(`✗ ${m}: ${res.status} - ${data.error?.message?.substring(0, 80)}`);
      }
    } catch(e) {
      console.log(`✗ ${m}: error - ${e.message}`);
    }
  }
}

testSimple();
