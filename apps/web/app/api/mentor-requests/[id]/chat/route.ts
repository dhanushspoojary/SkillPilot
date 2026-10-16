import { currentUser } from '../../../../../lib/auth';
import { many, one } from '../../../../../lib/db';
import { dbRateLimit } from '../../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText, isUuid } from '../../../../../lib/server-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHAT_MAX = 2000;
const CHAT_PAGE = 50;

type Ctx = { params: Promise<{ id: string }> };

async function participant(requestId: string, userId: string) {
  return one<{ id: string; status: string }>(
    `select id,status from mentor_requests where id=$1 and (student_id=$2 or mentor_id=$2)`,
    [requestId, userId],
  );
}

export async function GET(req: Request, ctx: Ctx) {
  const u = await currentUser();
  if (!u) return json({ error: 'Sign in required' }, 401);
  if (!(await dbRateLimit(`chat-read:${u.id}`, 40, 60000)))
    return json({ error: 'Too many chat refreshes. Please wait a minute.' }, 429);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Invalid request id' }, 400);
  const r = await participant(id, u.id);
  if (!r || !['accepted','completed'].includes(r.status))
    return json({ error: 'Chat opens once a request is accepted' }, 404);

  const raw = new URL(req.url).searchParams.get('after');
  const afterMs = raw ? Date.parse(raw) : NaN;
  const after = Number.isNaN(afterMs) ? '1970-01-01T00:00:00.000Z' : new Date(afterMs).toISOString();
  const messages = await many<any>(
    `select m.id,m.sender_id as "senderId",u.name as "senderName",m.body,m.created_at as at
     from mentor_chat_messages m join users u on u.id=m.sender_id
     where m.request_id=$1 and m.reported_at is null and m.created_at>$2
     order by m.created_at asc limit ${CHAT_PAGE}`,
    [id, after],
  );
  return json({ messages });
}

export async function POST(req: Request, ctx: Ctx) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const u = await currentUser();
  if (!u) return json({ error: 'Sign in required' }, 401);
  if (!(await dbRateLimit(`chat-write:${u.id}`, 20, 60000)))
    return json({ error: 'Too many messages. Wait a minute and try again.' }, 429);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Invalid request id' }, 400);
  const r = await participant(id, u.id);
  if (!r || !['accepted','completed'].includes(r.status))
    return json({ error: 'Chat opens once a request is accepted' }, 404);

  try {
    const b = await readJsonBody<any>(req, 20000);
    const body = safeText(b.body, CHAT_MAX);
    if (!body) return json({ error: `Message must be 1-${CHAT_MAX} characters` }, 400);
    const m = await one<any>(
      `insert into mentor_chat_messages(request_id,sender_id,body)
       values($1,$2,$3) returning id,created_at as at`,
      [id, u.id, body],
    );
    return json({ message: { id: m!.id, senderId: u.id, body, at: m!.at } }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'body_too_large') return json({ error: 'Request body is too large' }, 413);
    if (message === 'invalid_json') return json({ error: 'Invalid JSON body' }, 400);
    return json({ error: 'Could not send message' }, 500);
  }
}
