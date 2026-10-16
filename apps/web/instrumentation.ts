/** Fail fast at server start (not at build time) when required production secrets are missing. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    const { hashSecret } = await import('./lib/server-security');
    const { assertProductionConfig } = await import('./lib/config');
    hashSecret();
    assertProductionConfig();
  }
}
