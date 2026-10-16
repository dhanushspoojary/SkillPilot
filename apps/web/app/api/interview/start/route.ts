import { currentUser } from '../../../../lib/auth';
import { db, many, tx } from '../../../../lib/db';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText } from '../../../../lib/server-security';
import { INTERVIEW_QUESTION_COUNT, promptsFor } from '../../../../lib/interview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const u = await currentUser();
  if (!u || u.role !== 'student') return json({ error: 'Student account required' }, 401);
  if (!(await dbRateLimit(`interview-start:${u.id}`, 10, 3600000))) return json({ error: 'Interview start limit reached for this hour.' }, 429);
  try {
    const b = await readJsonBody<any>(req, 10000);
    const skill = safeText(b.skill, 64);
    const prompts = skill ? promptsFor(skill) : [];
    if (prompts.length < INTERVIEW_QUESTION_COUNT) return json({ error: 'Unknown skill for mock interview' }, 400);
    const skillRow = await db().query('select id from skills where slug=$1', [skill]);
    if (!skillRow.rowCount) return json({ error: 'Unknown skill' }, 400);
    const interview = await tx(async (c) => {
      const iv = await c.query<any>(`insert into mock_interviews(user_id,skill_slug) values($1,$2) returning id,status`, [u.id, skill]);
      for (let i = 0; i < INTERVIEW_QUESTION_COUNT; i++)
        await c.query(`insert into mock_interview_questions(interview_id,position,prompt) values($1,$2,$3)`, [iv.rows[0].id, i + 1, prompts[i]]);
      return iv.rows[0];
    });
    const questions = await many<any>(`select position,prompt from mock_interview_questions where interview_id=$1 order by position`, [interview.id]);
    return json({ interview: { id: interview.id, skill, status: interview.status, questions } }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'body_too_large') return json({ error: 'Request body is too large' }, 413);
    if (message === 'invalid_json') return json({ error: 'Invalid JSON body' }, 400);
    return json({ error: 'Could not start interview' }, 500);
  }
}
