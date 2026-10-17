import { db, many } from './db.ts';

export interface StoredMessage {
  id: string;
  userId: string;
  role: 'student' | 'agent' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function getConversationHistory(
  userId: string,
  limit = 50,
): Promise<StoredMessage[]> {
  const rows = await many<{
    id: string;
    userId: string;
    role: 'student' | 'agent' | 'system';
    content: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>(
    `select id, user_id as "userId", role, content, metadata, created_at as "createdAt"
     from career_conversations
     where user_id = $1
     order by created_at asc
     limit $2`,
    [userId, limit],
  ).catch(() => []);

  return rows;
}

export async function appendConversationMessage(
  userId: string,
  role: 'student' | 'agent' | 'system',
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<StoredMessage> {
  const res = await db().query(
    `insert into career_conversations(user_id, role, content, metadata, created_at)
     values($1, $2, $3, $4, now())
     returning id, user_id as "userId", role, content, metadata, created_at as "createdAt"`,
    [userId, role, content, JSON.stringify(metadata)],
  );

  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    content: row.content,
    metadata: row.metadata || {},
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function clearConversationHistory(userId: string): Promise<boolean> {
  await db().query(
    `delete from career_conversations where user_id = $1`,
    [userId],
  );
  return true;
}
