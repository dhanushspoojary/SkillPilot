import { one } from '../../../../lib/db';
import { verificationRequired } from '../../../../lib/config';
import { maybeRunRetention } from '../../../../lib/retention';
import { issueSession, passwordCheck, passwordCheckDummy } from '../../../../lib/auth';
import { json, requireOrigin, safeText, logSecurityEvent, readJsonBody, hashInput } from '../../../../lib/server-security';
import { dbRateLimit, dbRateLimitReset, networkKey } from '../../../../lib/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const ip = networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true');
  try {
    if (!(await dbRateLimit(`login:${ip}`, 8, 60_000))) return json({ error: 'Too many sign-in attempts. Try again later.' }, 429);
    const b = await readJsonBody<any>(req, 10_000);
    const email = safeText(b.email, 254)?.toLowerCase();
    const password = typeof b.password === 'string' && Buffer.byteLength(b.password, 'utf8') <= 72 ? b.password : null;
    if (!email || !password) return json({ error: 'Email and password are required' }, 400);
    // Per email+network limit stops guessing without letting a stranger lock the owner out;
    // the looser per-email ceiling still bounds a distributed attack.
    const emailKey = hashInput(email);
    const pairKey = `login:pair:${emailKey}:${ip}`;
    if (!(await dbRateLimit(pairKey, 6, 15 * 60_000)) || !(await dbRateLimit(`login:account:${emailKey}`, 60, 15 * 60_000))) {
      return json({ error: 'Too many sign-in attempts. Try again later.' }, 429);
    }
    const u = await one<any>('select id,email,name,role,status,password_hash,email_verified_at from users where email=$1', [email]);
    const valid = u && u.status === 'active' ? await passwordCheck(password, u.password_hash) : await passwordCheckDummy(password);
    if (!u || u.status !== 'active' || !valid) {
      await logSecurityEvent({ eventType: 'auth.login_failed', ip, userAgent: req.headers.get('user-agent'), metadata: { reason: 'invalid_credentials' } });
      return json({ error: 'Invalid email or password' }, 401);
    }
    // Only reveal "unverified" to someone who proved they know the password.
    if (verificationRequired() && !u.email_verified_at) {
      return json({ error: 'Please confirm your email address first. Check your inbox, or request a new link.', code: 'email_unverified' }, 403);
    }
    await dbRateLimitReset(pairKey);
    void maybeRunRetention();
    await issueSession(u.id);
    const mentorApproved = !!(await one<any>(`select 1 from mentor_profiles where user_id=$1 and status='approved'`, [u.id]));
    return json({ user: { id: u.id, email: u.email, name: u.name, role: u.role, mentorApproved } });
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m === 'body_too_large') return json({ error: 'Request too large' }, 413);
    if (m === 'invalid_json') return json({ error: 'Invalid JSON' }, 400);
    console.error('Login error:', e instanceof Error ? e.message : 'unknown');
    return json({ error: 'Could not sign in' }, 500);
  }
}
