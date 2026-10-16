import { currentUser } from '../../../../../../lib/auth';
import { one } from '../../../../../../lib/db';
import { dbRateLimit } from '../../../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText, isUuid, logSecurityEvent } from '../../../../../../lib/server-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const u = await currentUser();
  if (!u) return json({ error: 'Sign in required' }, 401);
  if (!(await dbRateLimit(`chat-report:${u.id}`, 10, 3600000)))
    return json({ error: 'Report limit reached for this hour.' }, 429);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Invalid request id' }, 400);
  const r = await one<any>(
    `select id from mentor_requests where id=$1 and (student_id=$2 or mentor_id=$2) and status in ('accepted','completed')`,
    [id, u.id],
  );
  if (!r) return json({ error: 'Chat opens once a request is accepted' }, 404);

  try {
    const b = await readJsonBody<any>(req, 10000);
    const messageId = safeText(b.messageId, 64);
    const reason = safeText(b.reason, 500);
    if (!isUuid(messageId) || !reason) return json({ error: 'Message and reason are required' }, 400);
    const out = await one<any>(
      `update mentor_chat_messages set reported_at=now(),reported_by=$3,report_reason=$4
       where id=$1 and request_id=$2 and sender_id<>$5 and reported_at is null returning id`,
      [messageId, id, u.id, reason, u.id],
    );
    if (!out) return json({ error: 'Message not found or already reported' }, 404);
    await logSecurityEvent({ userId: u.id, eventType: 'mentor.chat_message_reported', userAgent: req.headers.get('user-agent'), metadata: { requestId: id, messageId } });
    return json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'body_too_large') return json({ error: 'Request body is too large' }, 413);
    if (message === 'invalid_json') return json({ error: 'Invalid JSON body' }, 400);
    return json({ error: 'Could not report message' }, 500);
  }
}
