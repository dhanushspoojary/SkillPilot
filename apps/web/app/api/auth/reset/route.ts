import { db } from '../../../../lib/db';
import { passwordHash, validPassword } from '../../../../lib/auth';
import { consumeEmailToken } from '../../../../lib/email-tokens';
import { dbRateLimit, networkKey } from '../../../../lib/guard';
import { json, logSecurityEvent, readJsonBody, requireOrigin } from '../../../../lib/server-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const ip = networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true');
  if (!(await dbRateLimit(`reset:${ip}`, 10, 15 * 60_000))) return json({ error: 'Too many attempts. Try again later.' }, 429);
  try {
    const b = await readJsonBody<any>(req, 4_000);
    const next = typeof b.newPassword === 'string' ? b.newPassword : '';
    if (!validPassword(next)) return json({ error: 'New password must be between 12 and 72 characters' }, 400);
    const userId = await consumeEmailToken(typeof b.token === 'string' ? b.token : '', 'reset');
    if (!userId) return json({ error: 'This link is invalid or has expired. Request a new one.' }, 400);
    const hash = await passwordHash(next);
    // Following the link proves control of the mailbox, so the address counts as verified.
    await db().query('update users set password_hash=$1,email_verified_at=coalesce(email_verified_at,now()),updated_at=now() where id=$2', [hash, userId]);
    await db().query('delete from sessions where user_id=$1', [userId]);
    await logSecurityEvent({ userId, eventType: 'auth.password_reset', ip, userAgent: req.headers.get('user-agent') });
    return json({ ok: true, message: 'Password updated. Sign in with your new password.' });
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m === 'body_too_large') return json({ error: 'Request too large' }, 413);
    return json({ error: 'Could not reset password' }, 500);
  }
}
