import { currentUser } from '../../../lib/auth';
import { json, requireOrigin, readJsonBody } from '../../../lib/server-security';
import {
  listConversationThreads,
  getOrCreateDefaultThread,
  createConversationThread,
  renameConversationThread,
  deleteConversationThread,
  searchConversations,
  getConversationHistory,
  clearConversationHistory,
} from '../../../lib/conversation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  const url = new URL(req.url);
  const threadId = url.searchParams.get('threadId') || undefined;
  const query = url.searchParams.get('q') || undefined;

  // Search if query provided
  if (query) {
    const searchResults = await searchConversations(u.id, query);
    return json(searchResults);
  }

  // Ensure default thread exists for student
  const defaultThread = await getOrCreateDefaultThread(u.id);
  const threads = await listConversationThreads(u.id);

  const activeThreadId = threadId || defaultThread.id;
  const messages = await getConversationHistory(u.id, activeThreadId, 100);

  return json({
    threads,
    activeThreadId,
    messages,
  });
}

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const body = await readJsonBody<any>(req, 10000);
    const title = typeof body?.title === 'string' ? body.title : 'New Conversation';
    const newThread = await createConversationThread(u.id, title);
    const threads = await listConversationThreads(u.id);

    return json({
      ok: true,
      thread: newThread,
      threads,
    }, 201);
  } catch (err) {
    console.error('conversation POST error', err);
    return json({ error: 'Could not create conversation' }, 500);
  }
}

export async function PATCH(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const body = await readJsonBody<any>(req, 10000);
    const threadId = typeof body?.threadId === 'string' ? body.threadId : '';
    const title = typeof body?.title === 'string' ? body.title : '';

    if (!threadId || !title.trim()) {
      return json({ error: 'threadId and title are required' }, 400);
    }

    const updated = await renameConversationThread(u.id, threadId, title);
    if (!updated) {
      return json({ error: 'Thread not found or unauthorized' }, 404);
    }

    const threads = await listConversationThreads(u.id);
    return json({ ok: true, thread: updated, threads });
  } catch (err) {
    console.error('conversation PATCH error', err);
    return json({ error: 'Could not rename conversation' }, 500);
  }
}

export async function DELETE(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const body = await readJsonBody<any>(req, 10000).catch(() => ({}));
    const threadId = typeof body?.threadId === 'string' ? body.threadId : undefined;

    if (threadId) {
      const deleted = await deleteConversationThread(u.id, threadId);
      const threads = await listConversationThreads(u.id);
      return json({ ok: true, cleared: true, deleted, threads });
    }

    await clearConversationHistory(u.id);
    const threads = await listConversationThreads(u.id);
    return json({ ok: true, cleared: true, deleted: true, threads });
  } catch (err) {
    console.error('conversation DELETE error', err);
    return json({ error: 'Could not delete conversation' }, 500);
  }
}
