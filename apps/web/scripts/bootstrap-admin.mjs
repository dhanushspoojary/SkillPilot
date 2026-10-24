import pg from 'pg';
import bcrypt from 'bcryptjs';
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
const email=(process.env.SKILLPILOT_ADMIN_EMAIL||'').trim().toLowerCase();
const password=process.env.SKILLPILOT_ADMIN_PASSWORD||'';
const name=(process.env.SKILLPILOT_ADMIN_NAME||'SkillPilot Admin').trim();
if(!email||!password){console.error('Set SKILLPILOT_ADMIN_EMAIL and SKILLPILOT_ADMIN_PASSWORD');process.exit(1)}
if(password.length<16){console.error('Admin password must be at least 16 characters');process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL, password:process.env.PGPASSWORD || undefined});
const hash=await bcrypt.hash(password,12);
const existing = await pool.query('select id from users where email=$1',[email]);
if (existing.rowCount) { console.error(`Admin email already exists: ${email}. Refusing to overwrite an existing account.`); await pool.end(); process.exit(1); }
await pool.query(`insert into users(email,password_hash,role,name,status,email_verified_at) values($1,$2,'admin',$3,'active',now())`,[email,hash,name]);
await pool.end();
console.log(`Admin ready: ${email}`);
