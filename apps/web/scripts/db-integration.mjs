import pg from 'pg';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

if (!process.env.DATABASE_URL) {
    for (const f of ['.env.local', '../.env.local', '.env', '../.env']) {
        if (fsSync.existsSync(f)) {
            try { process.loadEnvFile(f); } catch {}
            if (process.env.DATABASE_URL) break;
        }
    }
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const schema = await fs.readFile(new URL('../../../db/schema.sql', import.meta.url), 'utf8');
await pool.query(schema);
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;
const tables = await q("select table_name from information_schema.tables where table_schema='public' and table_name in ('users','sessions','mentor_profiles','mentor_requests','mentor_reviews','user_skill_evidence','rate_limits','email_tokens')");
if (tables.length !== 8)
    throw new Error(`expected core tables (8), found ${tables.length}`);
const schemaContainsMentorSeed = schema.toLowerCase().includes("insert into users") && schema.toLowerCase().includes("'mentor'");
if (schemaContainsMentorSeed)
    throw new Error('production schema must not seed mentors');

const stamp = Date.now();
const student = (await q(`insert into users(email,password_hash,role,name) values('integration-student-${stamp}@example.test','x','student','Integration Student') returning id`))[0].id;
const mentor = (await q(`insert into users(email,password_hash,role,name) values('integration-mentor-${stamp}@example.test','x','mentor','Integration Mentor') returning id`))[0].id;
await q("insert into mentor_profiles(user_id,bio,focus,status) values($1,'A sufficiently long integration mentor bio.','Backend', 'approved')", [mentor]);
await q("insert into mentor_requests(student_id,mentor_id,message) values($1,$2,'Please review my API work.')", [student, mentor]);
const request = (await q("select id from mentor_requests where student_id=$1 and mentor_id=$2", [student, mentor]))[0].id;
await q("insert into skills(slug,name,category) values('integration-skill','Integration Skill','test') on conflict(slug) do nothing");
const skill = (await q("select id from skills where slug='integration-skill'"))[0].id;
await q("insert into mentor_reviews(request_id,mentor_id,student_id,skill_slug,score,confidence,review) values($1,$2,$3,'integration-skill',88,.92,'Integration review with enough detail.')", [request, mentor, student]);
await q("insert into user_skill_evidence(user_id,skill_id,source,score,confidence) values($1,$2,'mentor',88,.92)", [student, skill]);
let blocked = false;
try {
    await q("update user_skill_evidence set score=1 where user_id=$1", [student]);
}
catch {
    blocked = true;
}
if (!blocked)
    throw new Error('evidence mutation trigger failed');

// Clean up integration test data safely
try {
    await q("set skillpilot.allow_account_delete = 'on'");
    await q("delete from users where id in ($1, $2)", [student, mentor]);
    await q("delete from skills where slug='integration-skill'");
    await q("set skillpilot.allow_account_delete = 'off'");
} catch {}

console.log('database integration: PASS');
await pool.end();
