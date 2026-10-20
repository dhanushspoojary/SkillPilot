import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
if (!match) {
  console.error('No DATABASE_URL found');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: match[1] });
try {
  const r = await pool.query(
    `select u.id, u.email, u.name, u.role, mp.status as mentor_status, mp.focus, length(mp.bio) as bio_len, mp.skills 
     from users u 
     left join mentor_profiles mp on mp.user_id=u.id 
     where u.role in ('mentor', 'admin')`
  );
  console.log('Mentors & Admins:');
  for (const row of r.rows) {
    console.log(`- [${row.role}] ${row.email} (${row.name}) status=${row.mentor_status} focus="${row.focus}" bio_len=${row.bio_len}`);
  }
} catch (err) {
  console.error(err);
} finally {
  await pool.end();
}
