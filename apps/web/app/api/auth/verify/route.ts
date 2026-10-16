import { db } from '../../../../lib/db';
import { consumeEmailToken } from '../../../../lib/email-tokens';
import { dbRateLimit, networkKey } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin } from '../../../../lib/server-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST (not GET) so link scanners and prefetchers cannot consume the single-use token. */
export async function POST(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const ip = networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true');
  if (!(await dbRateLimit(`verify:${ip}`, 20, 15 * 60_000))) return json({ error: 'Too many attempts. Try again later.' }, 429);
  try {
    const b = await readJsonBody<any>(req, 2_000);
    const userId = await consumeEmailToken(typeof b.token === 'string' ? b.token : '', 'verify');
    if (!userId) return json({ error: 'This link is invalid or has expired. Request a new one from the sign-in page.' }, 400);
    await db().query('update users set email_verified_at=coalesce(email_verified_at,now()),updated_at=now() where id=$1', [userId]);
    return json({ ok: true, message: 'Email confirmed. You can sign in now.' });
  } catch { return json({ error: 'Could not verify email' }, 500); }
}
