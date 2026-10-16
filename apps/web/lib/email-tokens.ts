import { randomBytes } from 'node:crypto';
import { db } from './db';
import { hashEmailToken } from './token-hash.ts';

export { hashEmailToken };

export type TokenPurpose = 'verify' | 'reset';

/** Creates a single-use token. Older unused tokens for the same user and purpose are discarded. */
export async function createEmailToken(userId: string, purpose: TokenPurpose, ttlMinutes: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db().query(`delete from email_tokens where user_id=$1 and purpose=$2 and used_at is null`, [userId, purpose]);
  await db().query(
    `insert into email_tokens(user_id,purpose,token_hash,expires_at) values($1,$2,$3,now()+make_interval(mins=>$4))`,
    [userId, purpose, hashEmailToken(token), ttlMinutes],
  );
  return token;
}

/** Atomically marks a valid token as used and returns its user id, or null. */
export async function consumeEmailToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const r = await db().query<{ user_id: string }>(
    `update email_tokens set used_at=now() where token_hash=$1 and purpose=$2 and used_at is null and expires_at>now() returning user_id`,
    [hashEmailToken(token), purpose],
  );
  return r.rows[0]?.user_id ?? null;
}
