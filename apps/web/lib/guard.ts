/** Small, dependency-free helpers shared by the Next.js API routes. */
export function securityHeaders(): Record<string, string> {
    return {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'X-DNS-Prefetch-Control': 'off',
    };
}
/**
 * Identity used for rate limiting. Never derived from a client-chosen header: that would let
 * a caller dodge limits by sending a new value each time. Behind exactly one reverse proxy you
 * control, set SKILLPILOT_TRUST_PROXY=true to use the right-most X-Forwarded-For entry.
 */
export function networkKey(headers: Headers, trustProxy: boolean): string {
    if (trustProxy) {
        const last = headers.get('x-forwarded-for')?.split(',').pop()?.trim();
        if (last && last.length <= 64)
            return last;
    }
    // Without a trusted proxy, the server cannot know the real client IP.
    // Use a bounded user-agent bucket instead of collapsing every visitor into one global bucket.
    const ua = headers.get('user-agent')?.slice(0, 256) || 'unknown';
    let h = 2166136261;
    for (let i = 0; i < ua.length; i++)
        h = Math.imul(h ^ ua.charCodeAt(i), 16777619);
    return `ua:${(h >>> 0).toString(16)}`;
}
/** Fixed-window limiter with a hard cap on tracked keys (fails closed when full). */
export function createLimiter(max: number, windowMs: number, maxKeys = 5000) {
    const hits = new Map<string, {
        start: number;
        n: number;
    }>();
    return {
        hit(key: string, now = Date.now()): boolean {
            if (hits.size >= maxKeys || hits.size % 64 === 0) {
                for (const [k, v] of hits)
                    if (now - v.start >= windowMs)
                        hits.delete(k);
            }
            let entry = hits.get(key);
            if (!entry || now - entry.start >= windowMs) {
                if (!entry && hits.size >= maxKeys)
                    return false;
                entry = { start: now, n: 0 };
                hits.set(key, entry);
            }
            entry.n += 1;
            return entry.n <= max;
        },
        size: () => hits.size,
    };
}
/** Browsers always send Origin on cross-origin and on PUT/POST; a mismatch is rejected. */
export function originOk(method: string, origin: string | null, allowed: string | undefined): boolean {
    const effectiveAllowed = allowed || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : undefined);
    if (!effectiveAllowed)
        return true;
    if (origin) {
        const norm = (o: string) => o.replace(/\/+$/, '').toLowerCase();
        const oNorm = norm(origin);
        const aNorm = norm(effectiveAllowed);
        if (oNorm === aNorm)
            return true;
        if (process.env.NODE_ENV !== 'production') {
            const devNorm = (o: string) => o.replace('://127.0.0.1:', '://localhost:').replace('://[::1]:', '://localhost:');
            if (devNorm(oNorm) === devNorm(aNorm))
                return true;
        }
        return false;
    }
    return method === 'GET' || method === 'HEAD';
}
export const CLIENT_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
/** Database-backed limiter for production deployments with multiple web instances. */
let lastRateLimitPrune = 0;
interface QueryRunner {
    query<T extends Record<string, any> = Record<string, any>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
const fallbackLimiter = createLimiter(100, 60000, 10000);

export async function dbRateLimit(key: string, max: number, windowMs: number, now = Date.now(), client?: QueryRunner): Promise<boolean> {
    if (!process.env.DATABASE_URL && !client) {
        return fallbackLimiter.hit(key, now);
    }
    const { db } = await import('./db.ts');
    const runner: QueryRunner = client || db();
    if (now - lastRateLimitPrune > 5 * 60000 && !client) {
        lastRateLimitPrune = now;
        await runner.query(`delete from rate_limits where updated_at < now() - interval '2 days'`).catch(() => undefined);
    }
    const start = new Date(Math.floor(now / windowMs) * windowMs);
    const result = await runner.query<{
        count: number;
    }>(`insert into rate_limits(key,window_start,count,updated_at)
     values($1,$2,1,now())
     on conflict(key) do update set
       window_start = case when rate_limits.window_start < excluded.window_start then excluded.window_start else rate_limits.window_start end,
       count = case when rate_limits.window_start < excluded.window_start then 1 else rate_limits.count + 1 end,
       updated_at = now()
     returning count`, [key, start]);
    return Number(result.rows[0]?.count ?? max + 1) <= max;
}
export async function dbRateLimitReset(key: string): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    const { db } = await import('./db.ts');
    await db().query('delete from rate_limits where key=$1', [key]).catch(() => undefined);
}
export async function pruneRateLimits(): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    const { db } = await import('./db.ts');
    await db().query(`delete from rate_limits where updated_at < now() - interval '2 days'`).catch(() => undefined);
}
