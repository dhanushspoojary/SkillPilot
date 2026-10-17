import { currentUser } from '../../../lib/auth';
import { json, requireOrigin } from '../../../lib/server-security';
import { getConversationHistory, clearConversationHistory } from '../../../lib/conversation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  const messages = await getConversationHistory(u.id, 50);
  return json({ messages });
}

export async function DELETE(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  await clearConversationHistory(u.id);
  return json({ ok: true, cleared: true, deleted: true });
}
