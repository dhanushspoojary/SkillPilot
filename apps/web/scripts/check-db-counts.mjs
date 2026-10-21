import pg from 'pg';
import fsSync from 'node:fs';

for (const f of ['.env.local', '../.env.local', '.env', '../.env']) {
  if (fsSync.existsSync(f)) {
    try { process.loadEnvFile(f); } catch {}
    if (process.env.DATABASE_URL) break;
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const users = await pool.query('select count(*) as c from users');
  const evidence = await pool.query('select count(*) as c from user_skill_evidence');
  const assessments = await pool.query('select count(*) as c from assessments');
  const requests = await pool.query('select count(*) as c from mentor_requests');
  console.log(`PRESERVATION AUDIT: users=${users.rows[0].c}, evidence=${evidence.rows[0].c}, assessments=${assessments.rows[0].c}, mentor_requests=${requests.rows[0].c}`);
} finally {
  await pool.end();
}
