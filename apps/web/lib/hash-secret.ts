/** Secret that keys the hashes of IPs, user agents and email rate-limit keys. Mandatory in production. */
export function hashSecret(): string {
  const secret = process.env.SKILLPILOT_HASH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('SKILLPILOT_HASH_SECRET must be set to at least 16 characters in production (openssl rand -hex 32)');
  }
  return 'skillpilot-dev-only-secret';
}
