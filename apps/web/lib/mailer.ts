import { mailConfigured } from './config.ts';

export interface Mail { to: string; subject: string; text: string }

/**
 * Sends one transactional email through Resend's HTTP API (no extra dependency).
 * Returns false instead of throwing so callers can answer identically whether or not mail worked.
 * Without configuration, development prints the message to the console; production logs an error.
 */
export async function sendMail(mail: Mail, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === 'production') console.error('mail not configured: set RESEND_API_KEY and MAIL_FROM');
    else console.log(`[dev mail] to=${mail.to}\nsubject=${mail.subject}\n${mail.text}`);
    return false;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8_000);
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) console.error(`mail provider returned ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error('mail send failed', e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget so response timing does not reveal whether an address is registered. */
export function sendMailInBackground(mail: Mail): void {
  void sendMail(mail);
}
