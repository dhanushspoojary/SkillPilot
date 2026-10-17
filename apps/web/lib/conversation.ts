import { db, many, one } from './db.ts';

export interface ConversationThread {
  id: string;
  userId: string;
  title: string;
  archived: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: string;
}

export interface StoredMessage {
  id: string;
  userId: string;
  threadId?: string | null;
  role: 'student' | 'agent' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Lists all active conversation threads for a student, ordered by most recently updated.
 */
export async function listConversationThreads(userId: string): Promise<ConversationThread[]> {
  const rows = await many<{
    id: string;
    userId: string;
    title: string;
    archived: boolean;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
    messageCount: string;
    lastMessage: string | null;
  }>(
    `select t.id, t.user_id as "userId", t.title, t.archived, t.pinned,
            t.created_at as "createdAt", t.updated_at as "updatedAt",
            count(m.id)::text as "messageCount",
            (select content from career_conversations where thread_id = t.id order by created_at desc limit 1) as "lastMessage"
     from conversation_threads t
     left join career_conversations m on m.thread_id = t.id
     where t.user_id = $1 and t.archived = false
     group by t.id
     order by t.pinned desc, t.updated_at desc`,
    [userId],
  ).catch(() => []);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    archived: r.archived,
    pinned: r.pinned,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
    messageCount: Number(r.messageCount || 0),
    lastMessage: r.lastMessage || undefined,
  }));
}

/**
 * Retrieves or creates a default thread for backwards compatibility.
 */
export async function getOrCreateDefaultThread(userId: string): Promise<ConversationThread> {
  const existing = await one<ConversationThread>(
    `select id, user_id as "userId", title, archived, pinned, created_at as "createdAt", updated_at as "updatedAt"
     from conversation_threads
     where user_id = $1 and archived = false
     order by pinned desc, updated_at desc
     limit 1`,
    [userId],
  ).catch(() => null);

  if (existing) {
    return {
      ...existing,
      createdAt: new Date(existing.createdAt).toISOString(),
      updatedAt: new Date(existing.updatedAt).toISOString(),
    };
  }

  // Create initial default thread
  const created = await createConversationThread(userId, 'Career AI Workspace');

  // Backfill any orphaned messages from before thread support
  await db().query(
    `update career_conversations set thread_id = $1 where user_id = $2 and thread_id is null`,
    [created.id, userId],
  ).catch(() => {});

  return created;
}

/**
 * Creates a new conversation thread.
 */
export async function createConversationThread(
  userId: string,
  title = 'New Conversation',
): Promise<ConversationThread> {
  const res = await db().query(
    `insert into conversation_threads(user_id, title, created_at, updated_at)
     values($1, $2, now(), now())
     returning id, user_id as "userId", title, archived, pinned, created_at as "createdAt", updated_at as "updatedAt"`,
    [userId, title.trim().slice(0, 100) || 'New Conversation'],
  );

  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    archived: row.archived,
    pinned: row.pinned,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Renames an existing conversation thread (server-enforced student ownership).
 */
export async function renameConversationThread(
  userId: string,
  threadId: string,
  title: string,
): Promise<ConversationThread | null> {
  const cleanTitle = title.trim().slice(0, 100);
  if (!cleanTitle) return null;

  const res = await db().query(
    `update conversation_threads
     set title = $1, updated_at = now()
     where id = $2 and user_id = $3
     returning id, user_id as "userId", title, archived, pinned, created_at as "createdAt", updated_at as "updatedAt"`,
    [cleanTitle, threadId, userId],
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    archived: row.archived,
    pinned: row.pinned,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Deletes a conversation thread and all its messages.
 */
export async function deleteConversationThread(
  userId: string,
  threadId: string,
): Promise<boolean> {
  const res = await db().query(
    `delete from conversation_threads where id = $1 and user_id = $2`,
    [threadId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Searches conversations by keyword across titles and message contents.
 */
export async function searchConversations(
  userId: string,
  query: string,
): Promise<{
  threads: ConversationThread[];
  messages: StoredMessage[];
}> {
  const cleanQ = query.trim().slice(0, 100);
  if (!cleanQ) return { threads: [], messages: [] };

  const pattern = `%${cleanQ}%`;

  const threads = await many<{
    id: string;
    userId: string;
    title: string;
    archived: boolean;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
  }>(
    `select id, user_id as "userId", title, archived, pinned, created_at as "createdAt", updated_at as "updatedAt"
     from conversation_threads
     where user_id = $1 and title ilike $2 and archived = false
     order by updated_at desc limit 10`,
    [userId, pattern],
  ).catch(() => []);

  const messages = await many<{
    id: string;
    userId: string;
    threadId: string | null;
    role: 'student' | 'agent' | 'system';
    content: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>(
    `select id, user_id as "userId", thread_id as "threadId", role, content, metadata, created_at as "createdAt"
     from career_conversations
     where user_id = $1 and content ilike $2
     order by created_at desc limit 20`,
    [userId, pattern],
  ).catch(() => []);

  return {
    threads: threads.map((t) => ({
      ...t,
      createdAt: new Date(t.createdAt).toISOString(),
      updatedAt: new Date(t.updatedAt).toISOString(),
    })),
    messages: messages.map((m) => ({
      ...m,
      createdAt: new Date(m.createdAt).toISOString(),
    })),
  };
}

/**
 * Retrieves conversation messages for a specific thread, or all student messages if threadId omitted.
 */
export async function getConversationHistory(
  userId: string,
  threadId?: string,
  limit = 100,
): Promise<StoredMessage[]> {
  let query = `
    select id, user_id as "userId", thread_id as "threadId", role, content, metadata, created_at as "createdAt"
    from career_conversations
    where user_id = $1
  `;
  const params: unknown[] = [userId];

  if (threadId) {
    query += ` and thread_id = $2 order by created_at asc limit $3`;
    params.push(threadId, limit);
  } else {
    query += ` order by created_at asc limit $2`;
    params.push(limit);
  }

  const rows = await many<{
    id: string;
    userId: string;
    threadId: string | null;
    role: 'student' | 'agent' | 'system';
    content: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>(query, params).catch(() => []);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    threadId: r.threadId,
    role: r.role,
    content: r.content,
    metadata: r.metadata || {},
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

/**
 * Appends a message to a thread and automatically derives thread title if it was default.
 */
export async function appendConversationMessage(
  userId: string,
  role: 'student' | 'agent' | 'system',
  content: string,
  metadata: Record<string, unknown> = {},
  threadId?: string,
): Promise<StoredMessage> {
  let effectiveThreadId = threadId;

  if (!effectiveThreadId) {
    const def = await getOrCreateDefaultThread(userId);
    effectiveThreadId = def.id;
  }

  const res = await db().query(
    `insert into career_conversations(user_id, thread_id, role, content, metadata, created_at)
     values($1, $2, $3, $4, $5, now())
     returning id, user_id as "userId", thread_id as "threadId", role, content, metadata, created_at as "createdAt"`,
    [userId, effectiveThreadId, role, content, JSON.stringify(metadata)],
  );

  // Update thread's updated_at timestamp
  await db().query(
    `update conversation_threads set updated_at = now() where id = $1 and user_id = $2`,
    [effectiveThreadId, userId],
  ).catch(() => {});

  // If first user message and title is still "New Conversation", auto-title the thread
  if (role === 'student') {
    const thread = await one<{ title: string; count: string }>(
      `select t.title, count(m.id)::text as count
       from conversation_threads t
       join career_conversations m on m.thread_id = t.id
       where t.id = $1 and t.user_id = $2
       group by t.title`,
      [effectiveThreadId, userId],
    ).catch(() => null);

    if (thread && (thread.title === 'New Conversation' || Number(thread.count) <= 2)) {
      const autoTitle = content.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 40);
      if (autoTitle.length >= 3) {
        await renameConversationThread(userId, effectiveThreadId, autoTitle).catch(() => {});
      }
    }
  }

  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    threadId: row.threadId,
    role: row.role,
    content: row.content,
    metadata: row.metadata || {},
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/**
 * Clears messages for a specific thread, or all conversation threads for the user.
 */
export async function clearConversationHistory(
  userId: string,
  threadId?: string,
): Promise<boolean> {
  if (threadId) {
    await db().query(
      `delete from career_conversations where user_id = $1 and thread_id = $2`,
      [userId, threadId],
    );
  } else {
    await db().query(
      `delete from career_conversations where user_id = $1`,
      [userId],
    );
  }
  return true;
}
