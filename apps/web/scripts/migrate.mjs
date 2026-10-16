import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
const { Pool } = pg;
const root = process.env.SKILLPILOT_MIGRATION_DIR || path.resolve(process.cwd(), '../../db/migrations');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, password: process.env.PGPASSWORD || undefined });
try {
    const files = (await fs.readdir(root)).filter(f => /^\d+.*\.sql$/.test(f)).sort();
    await pool.query(`create table if not exists schema_migrations(version text primary key, applied_at timestamptz not null default now())`);
    for (const file of files) {
        const version = /^([0-9]+)/.exec(file)?.[1];
        if (!version)
            continue;
        const exists = await pool.query('select 1 from schema_migrations where version=$1', [version]);
        if (exists.rowCount)
            continue;
        const sql = await fs.readFile(path.join(root, file), 'utf8');
        const client = await pool.connect();
        try {
            await client.query('begin');
            await client.query(sql);
            await client.query('insert into schema_migrations(version) values($1)', [version]);
            await client.query('commit');
        }
        catch (e) {
            await client.query('rollback');
            throw e;
        }
        finally {
            client.release();
        }
    }
    console.log('SkillPilot migrations complete');
}
finally {
    await pool.end();
}
