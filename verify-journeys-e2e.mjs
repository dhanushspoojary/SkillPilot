// Root forwarder for verify-journeys-e2e.mjs
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scriptPath = join(__dirname, 'apps', 'web', 'scripts', 'verify-journeys-e2e.mjs');
const child = spawn(process.execPath, [scriptPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: join(__dirname, 'apps', 'web'),
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
