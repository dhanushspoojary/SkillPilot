import { createHmac } from 'node:crypto';
import { hashSecret } from './hash-secret.ts';

export { hashSecret };
import { originOk, securityHeaders } from './guard.ts';

export function json(body: unknown, status=200) { return Response.json(body,{status,headers:securityHeaders()}); }
export function requireOrigin(req: Request): boolean {
  const allowed = process.env.SKILLPILOT_ALLOWED_ORIGIN;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !allowed) return false;

  const origin = req.headers.get('origin');
  const host = req.headers.get('host') || req.headers.get('x-forwarded-host');
  const referer = req.headers.get('referer');
  const secFetchSite = req.headers.get('sec-fetch-site');

  // Hard CSRF boundary: if browser explicitly declared cross-site, reject
  if (secFetchSite === 'cross-site') {
    return false;
  }

  const clean = (val: string | null | undefined): string | null => {
    if (!val) return null;
    try {
      const u = new URL(val);
      return `${u.protocol}//${u.host}`.toLowerCase();
    } catch {
      return null;
    }
  };

  const normOrigin = clean(origin);
  const normAllowed = clean(allowed);
  const normReferer = clean(referer);
  let reqUrlOrigin: string | null = null;
  try {
    const u = new URL(req.url);
    reqUrlOrigin = `${u.protocol}//${u.host}`.toLowerCase();
  } catch {}

  // 1. Direct match with configured allowed origin
  if (normOrigin && normAllowed && normOrigin === normAllowed) {
    return true;
  }

  // 2. Direct same-origin match with incoming request URL origin
  if (normOrigin && reqUrlOrigin && normOrigin === reqUrlOrigin) {
    return true;
  }

  // 3. Match with request's Host header (legitimate same-origin request to this server)
  if (normOrigin && host) {
    const hostLower = host.toLowerCase();
    if (normOrigin === `http://${hostLower}` || normOrigin === `https://${hostLower}`) {
      return true;
    }
  }

  // 4. In development, accept localhost / 127.0.0.1 / [::1] on identical port or host match
  if (!isProd && normOrigin) {
    const devNorm = (o: string) => o.replace('://127.0.0.1:', '://localhost:').replace('://[::1]:', '://localhost:');
    if (normAllowed && devNorm(normOrigin) === devNorm(normAllowed)) {
      return true;
    }
    if (reqUrlOrigin && devNorm(normOrigin) === devNorm(reqUrlOrigin)) {
      return true;
    }
    try {
      const u = new URL(normOrigin);
      if (['localhost', '127.0.0.1', '::1'].includes(u.hostname) && host) {
        const hostPort = host.split(':')[1] || (u.protocol === 'https:' ? '443' : '80');
        const originPort = u.port || (u.protocol === 'https:' ? '443' : '80');
        if (originPort === hostPort) {
          return true;
        }
      }
    } catch {}
  }

  // 5. If origin header is absent (same-origin fetch, navigations, or some browser extensions)
  if (!origin) {
    if (secFetchSite === 'same-origin') {
      return true;
    }
    if (normReferer) {
      if (normAllowed && normReferer === normAllowed) return true;
      if (reqUrlOrigin && normReferer === reqUrlOrigin) return true;
      if (host && (normReferer === `http://${host.toLowerCase()}` || normReferer === `https://${host.toLowerCase()}`)) {
        return true;
      }
      if (!isProd) {
        const devNorm = (o: string) => o.replace('://127.0.0.1:', '://localhost:').replace('://[::1]:', '://localhost:');
        if (normAllowed && devNorm(normReferer) === devNorm(normAllowed)) return true;
      }
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      return true;
    }
    return false;
  }

  // Fallback to originOk for existing compatibility
  return originOk(req.method, origin, allowed);
}
// Keyed hash: an unsalted SHA-256 of an IPv4 address or email can be reversed by brute force.
export function hashInput(value: string) { return createHmac('sha256', hashSecret()).update(value).digest('hex'); }
export function safeText(v: unknown,max:number){ return typeof v==='string' && v.trim().length>0 && v.length<=max ? v.trim() : null; }
export function isUuid(v: string | null): v is string { return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
const ALLOWED_HOSTS = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'meet.jit.si', 'whereby.com'];
export function validMeetingUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    return url.toString().slice(0, 600);
  } catch {
    return null;
  }
}

export async function readJsonBody<T = unknown>(req: Request, maxBytes = 100_000): Promise<T> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new Error('body_too_large');
  const reader = req.body?.getReader();
  if (!reader) return {} as T;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new Error('body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as T; }
  catch { throw new Error('invalid_json'); }
}

export async function logSecurityEvent(input: {
  userId?: string | null;
  eventType: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { db } = await import('./db');
  const { maybeRunRetention } = await import('./retention');
  const ipHash = input.ip ? hashInput(input.ip) : null;
  const uaHash = input.userAgent ? hashInput(input.userAgent) : null;
  void maybeRunRetention();
  await db().query(
    `insert into security_events(user_id,event_type,ip_hash,user_agent_hash,metadata) values($1,$2,$3,$4,$5)`,
    [input.userId ?? null, input.eventType, ipHash, uaHash, JSON.stringify(input.metadata ?? {})],
  ).catch(() => undefined);
}
