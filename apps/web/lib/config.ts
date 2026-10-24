/** Deployment configuration shared by the auth routes. */

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;
}

/**
 * Email verification is on when explicitly requested, or by default in production once a mail
 * provider is configured. With it on, signup and password reset answer identically whether or not
 * the address is registered, which closes the account-enumeration hole.
 */
export function verificationRequired(): boolean {
  return false;
}

export function appUrl(): string {
  return (process.env.SKILLPILOT_ALLOWED_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const origin = process.env.SKILLPILOT_ALLOWED_ORIGIN || '';
  if (!/^https:\/\/[^/]+$/.test(origin)) throw new Error('Production requires an exact HTTPS SKILLPILOT_ALLOWED_ORIGIN');
  if (process.env.SKILLPILOT_SECURE_COOKIES === 'false') throw new Error('Secure cookies cannot be disabled in production');
  if (process.env.SKILLPILOT_TRUST_PROXY === 'true' && !process.env.SKILLPILOT_ALLOWED_ORIGIN) throw new Error('Trusted proxy requires an exact allowed origin');
}

export function retentionDays(name: 'AGENT' | 'EVENTS', fallback: number): number {
  const n = Number(process.env[`SKILLPILOT_RETENTION_${name}_DAYS`]);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}
