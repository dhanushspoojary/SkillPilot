import { currentUser } from '../../../../../lib/auth';
import { db, one } from '../../../../../lib/db';
import { dbRateLimit } from '../../../../../lib/guard';
import { json } from '../../../../../lib/server-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await currentUser();
  if (!u) {
    return json({ error: 'Sign in required' }, 401);
  }

  if (!(await dbRateLimit(`call-active:${u.id}`, 60, 60000))) {
    return json({ error: 'Rate limit reached' }, 429);
  }

  // Auto-expire unanswered calls older than 60 seconds
  await db()
    .query(
      `update mentor_call_sessions
       set status = 'expired', ended_at = now()
       where status = 'ringing' and created_at < now() - interval '60 seconds'`
    )
    .catch(() => undefined);

  // Find active call where the user is either the student being called, or the mentor calling
  const activeCall = await one<any>(
    `select cs.id as "sessionId",
            cs.request_id as "requestId",
            cs.mentor_id as "mentorId",
            cs.student_id as "studentId",
            cs.room_name as "roomName",
            cs.status,
            cs.created_at as "createdAt",
            m.name as "mentorName",
            s.name as "studentName",
            mr.message as "topic"
     from mentor_call_sessions cs
     join users m on m.id = cs.mentor_id
     join users s on s.id = cs.student_id
     join mentor_requests mr on mr.id = cs.request_id
     where (cs.student_id = $1 or cs.mentor_id = $1)
       and cs.status in ('ringing', 'accepted')
       and cs.created_at > now() - interval '2 hours'
     order by cs.created_at desc
     limit 1`,
    [u.id]
  );

  return json({ activeCall: activeCall || null });
}
