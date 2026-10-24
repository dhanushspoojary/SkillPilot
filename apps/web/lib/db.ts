import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';
// node-postgres returns numeric as string and timestamptz as Date by default. The engine and the
// JSON API expect plain numbers and ISO strings, so parse them once, here, at the boundary.
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric
types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz
declare global {
    var skillpilotPool: Pool | undefined;
}
let pool: Pool | null = globalThis.skillpilotPool ?? null;
export function db(): Pool {
    if (!process.env.DATABASE_URL)
        throw new Error('DATABASE_URL is not configured');
    if (!pool) {
        pool = new Pool({ connectionString: process.env.DATABASE_URL, password: process.env.PGPASSWORD || undefined, max: Number(process.env.DB_POOL_MAX ?? 10), idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_VERIFY !== 'false' } : undefined });
        // An idle client can error (e.g. Postgres restart). Without a listener Node treats it as fatal.
        pool.on('error', (err) => { console.error('postgres pool error', err.message); });
        if (process.env.NODE_ENV !== 'production') {
            globalThis.skillpilotPool = pool;
        }
    }
    return pool;
}
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await db().connect();
    let broken = false;
    try {
        await client.query('BEGIN');
        const out = await fn(client);
        await client.query('COMMIT');
        return out;
    }
    catch (e) {
        try {
            await client.query('ROLLBACK');
        }
        catch {
            broken = true;
        }
        throw e;
    }
    finally {
        client.release(broken ? true : undefined);
    }
}
export async function one<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const r = await db().query<T>(sql, params);
    return r.rows[0] ?? null;
}
export async function many<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await db().query<T>(sql, params)).rows;
}
