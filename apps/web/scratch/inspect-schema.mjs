import fs from 'node:fs';
import pg from 'pg';

for (const f of [new URL('../.env.local', import.meta.url), '.env.local', 'apps/web/.env.local']) {
  if (fs.existsSync(f)) {
    try { process.loadEnvFile(f); } catch {}
    if (process.env.DATABASE_URL) break;
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  console.log('PUBLIC TABLES in Database:');
  console.log(res.rows.map(r => r.table_name).join(', '));
  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
