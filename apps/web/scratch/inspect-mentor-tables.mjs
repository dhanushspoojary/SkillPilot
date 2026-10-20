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
  for (const table of ['mentor_profiles', 'mentor_requests', 'users', 'mock_interviews', 'mock_interview_questions']) {
    const res = await pool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\nTable ${table}:`);
    res.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));
  }
  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
