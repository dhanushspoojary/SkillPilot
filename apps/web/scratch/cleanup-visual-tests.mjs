import pg from 'pg';
import fs from 'node:fs';

for (const f of ['.env.local', '../.env.local']) {
  if (fs.existsSync(f)) {
    try { process.loadEnvFile(f); } catch {}
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query("set skillpilot.allow_account_delete = 'on'");
  const res = await pool.query("delete from users where email like 'visual_student_%' or email like 'mentor_vis_%'");
  await pool.query("set skillpilot.allow_account_delete = 'off'");
  console.log('Cleaned test users count:', res.rowCount);
} catch (e) {
  console.error('Cleanup notice:', e.message);
} finally {
  await pool.end();
}
