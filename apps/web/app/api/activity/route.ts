import { currentUser } from '../../../lib/auth';
import { tx } from '../../../lib/db';
import { parseActionId } from '../../../lib/activity';
import { dbRateLimit } from '../../../lib/guard';
import { json, readJsonBody, requireOrigin } from '../../../lib/server-security';
import { SKILLS } from '../../../lib/questions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Records (or undoes) "I did this" for a roadmap action. It never creates evidence or changes a score. */
export async function POST(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const u = await currentUser();
  if (!u || u.role !== 'student') return json({ error: 'Student account required' }, 401);
  if (!(await dbRateLimit(`activity:${u.id}`, 120, 3_600_000))) return json({ error: 'Too many updates. Try again later.' }, 429);

  try {
    const b = await readJsonBody<any>(req, 5_000);
    const actionId = typeof b.actionId === 'string' ? b.actionId : '';
    const parsed = parseActionId(actionId);
    if (!parsed) return json({ error: 'Unknown action' }, 400);
    const done = b.done === true;
    const title = parsed.kind === 'MENTOR' ? 'Review mentor feedback' : (SKILLS.find((s) => s.id === parsed.skill)?.task.title ?? actionId);
    await tx(async (c) => {
      await c.query(`delete from roadmap_actions where user_id=$1 and source=$2 and status='completed'`, [u.id, actionId]);
      if (done) {
        await c.query(
          `insert into roadmap_actions(user_id,title,week_start,priority,status,source,completed_at) values($1,$2,current_date,0,'completed',$3,now())`,
          [u.id, title, actionId],
        );
      }
    });
    return json({ ok: true, actionId, done });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'body_too_large') return json({ error: 'Request too large' }, 413);
    if (msg === 'invalid_json') return json({ error: 'Invalid JSON' }, 400);
    return json({ error: 'Could not save progress' }, 500);
  }
}
