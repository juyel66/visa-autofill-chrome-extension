const { setGlobalDispatcher, Agent } = require('undici');
const dns = require('dns');

setGlobalDispatcher(new Agent({
  connect: {
    lookup: (hostname, opts, cb) => {
      dns.lookup(hostname, { ...opts, family: 4, all: true }, (err, addresses) => {
        if (err) return cb(err);
        if (opts.all) {
          cb(null, addresses);
        } else {
          cb(null, addresses[0].address, addresses[0].family);
        }
      });
    }
  }
}));

const fs = require('fs');
const key = fs.readFileSync('.env', 'utf8').match(/VITE_GEMINI_API_KEY=(.+)/)[1].trim();

async function test() {
  const t0 = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with valid JSON: {"status": "ok"}' }] }],
        generationConfig: { response_mime_type: 'application/json' }
      })
    });
    const d = await res.json();
    console.log(`SUCCESS in ${Date.now() - t0}ms: HTTP ${res.status}:`, d.candidates?.[0]?.content?.parts?.[0]?.text || d);
  } catch (e) {
    console.log(`Failed in ${Date.now() - t0}ms:`, e);
  }
}
test();
