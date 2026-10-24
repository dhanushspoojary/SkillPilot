import { currentUser } from '../../../../../../lib/auth';
import { db, one } from '../../../../../../lib/db';
import { dbRateLimit } from '../../../../../../lib/guard';
import { json, requireOrigin, isUuid } from '../../../../../../lib/server-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u) {
    return json({ error: 'Sign in required' }, 401);
  }

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return json({ error: 'Invalid request id' }, 400);
  }

  if (!(await dbRateLimit(`call-end:${u.id}`, 30, 60000))) {
    return json({ error: 'Too many requests. Please wait.' }, 429);
  }

  const updated = await one<any>(
    `update mentor_call_sessions
     set status = 'ended', ended_at = now()
     where request_id = $1
       and (student_id = $2 or mentor_id = $2)
       and status in ('ringing', 'accepted')
     returning id, status`,
    [id, u.id]
  );

  return json({ ok: true, status: updated ? 'ended' : 'none' });
}
