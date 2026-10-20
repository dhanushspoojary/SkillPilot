import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

let geminiKey = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('GEMINI_API_KEY=')) {
      geminiKey = line.trim().split('=')[1].replace(/['"]/g, '').trim();
    }
  }
}

async function testFast(model) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] }),
      signal: AbortSignal.timeout(15000)
    });
    console.log(`[${model}] HTTP status: ${res.status}`);
    const data = await res.json();
    if (res.ok) {
      console.log(`[${model}] SUCCESS:`, data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
    } else {
      console.log(`[${model}] ERROR:`, data.error?.message?.slice(0, 150));
    }
  } catch (err) {
    console.log(`[${model}] TIMEOUT/ERROR:`, err.message);
  }
}

await testFast('gemini-3.5-flash-lite');
await testFast('gemini-2.5-flash');
await testFast('gemini-3.5-flash');
