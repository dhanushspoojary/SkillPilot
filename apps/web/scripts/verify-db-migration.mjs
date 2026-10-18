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
  const migs = await pool.query('select version, applied_at from schema_migrations order by version desc limit 6');
  console.log('Latest applied migrations:');
  console.table(migs.rows);

  const tables = await pool.query(`
    select table_name 
    from information_schema.tables 
    where table_schema='public' 
      and table_name in ('student_lesson_progress', 'student_practice_attempts', 'student_concept_mastery', 'practice_questions')
    order by table_name
  `);
  console.log('Learning tables present:');
  console.table(tables.rows);

  const cols = await pool.query(`
    select column_name, data_type 
    from information_schema.columns 
    where table_name='student_capability_profiles' 
      and column_name in ('skills_to_learn', 'skills_known')
    order by column_name
  `);
  console.log('Capability columns present:');
  console.table(cols.rows);
} finally {
  await pool.end();
}
