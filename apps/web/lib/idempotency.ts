import { db, one } from './db.ts';

export interface IdempotencyRecord {
  id: string;
  userId: string;
  idempotencyKey: string;
  actionType: string;
  responseBody: unknown;
  createdAt: string;
}

const inMemoryIdempotency = new Map<string, unknown>();

/**
 * Executes an action with idempotency protection.
 * If the exact same idempotencyKey was previously processed for this user,
 * returns the saved response without re-executing state mutations.
 */
export async function withIdempotency<T>(
  userId: string,
  idempotencyKey: string | null | undefined,
  actionType: string,
  fn: () => Promise<T>,
): Promise<{ result: T; cached: boolean }> {
  const cleanKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';

  if (!cleanKey || cleanKey.length > 120) {
    const fresh = await fn();
    return { result: fresh, cached: false };
  }

  if (!process.env.DATABASE_URL) {
    const memoryKey = `${userId}:${cleanKey}:${actionType}`;
    if (inMemoryIdempotency.has(memoryKey)) {
      return { result: inMemoryIdempotency.get(memoryKey) as T, cached: true };
    }
    const fresh = await fn();
    inMemoryIdempotency.set(memoryKey, fresh);
    return { result: fresh, cached: false };
  }

  // 1. Check existing record
  const existing = await one<{ response_body: unknown }>(
    `select response_body from request_idempotency_keys where user_id = $1 and idempotency_key = $2 and action_type = $3`,
    [userId, cleanKey, actionType],
  ).catch(() => null);

  if (existing && existing.response_body !== undefined) {
    return { result: existing.response_body as T, cached: true };
  }

  // 2. Execute authoritative operation
  const fresh = await fn();

  // 3. Persist idempotency record
  await db().query(
    `insert into request_idempotency_keys (user_id, idempotency_key, action_type, response_body, created_at)
     values ($1, $2, $3, $4, now())
     on conflict (user_id, idempotency_key) do nothing`,
    [userId, cleanKey, actionType, JSON.stringify(fresh)],
  ).catch(() => {});

  return { result: fresh, cached: false };
}
