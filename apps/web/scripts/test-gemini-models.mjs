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

if (!geminiKey) {
  console.log('No GEMINI_API_KEY found in .env.local');
  process.exit(1);
}

const modelsToTest = ['gemini-2.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];

for (const model of modelsToTest) {
  console.log(`Testing Gemini model: ${model}...`);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Return strictly the word OK.' }] }]
      })
    });
    console.log(`  Model ${model} HTTP status: ${res.status}`);
    const data = await res.json();
    if (res.ok) {
      console.log(`  ✓ Model ${model} SUCCESS:`, data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
    } else {
      console.log(`  ✗ Model ${model} ERROR:`, data.error?.message || data.error);
    }
  } catch (err) {
    console.log(`  ✗ Model ${model} FETCH FAILED:`, err.message);
  }
}
