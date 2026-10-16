import { createHash } from 'node:crypto';

export function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
