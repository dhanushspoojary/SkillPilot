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

console.log('Querying Google Gemini ModelService.ListModels ...');
try {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
  const res = await fetch(url);
  console.log(`ListModels HTTP status: ${res.status}`);
  const data = await res.json();
  if (res.ok && data.models) {
    const supported = data.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    console.log('Supported generateContent models:', supported);
  } else {
    console.log('Error listing models:', data.error);
  }
} catch (e) {
  console.error('ListModels error:', e.message);
}
