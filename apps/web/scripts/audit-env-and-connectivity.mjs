import fs from 'fs';
import path from 'path';

const candidatePaths = [
  path.resolve('.env'),
  path.resolve('.env.local'),
  path.resolve('apps/web/.env'),
  path.resolve('apps/web/.env.local')
];

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const keys = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => line.split('=')[0].trim());
    console.log(`[FILE] ${envPath}`);
    console.log(`[KEYS] ${keys.join(', ')}`);
  } else {
    console.log(`[FILE] ${envPath} (Not Present)`);
  }
}
