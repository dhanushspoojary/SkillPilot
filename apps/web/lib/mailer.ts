import { mailConfigured } from './config.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends a transactional email using Resend's HTTP API.
 *
 * Returns true when Resend accepts the request, and false when
 * configuration, networking, or provider errors prevent sending.
 *
 * A successful response means Resend accepted the email request;
 * it does not guarantee delivery to the recipient's inbox.
 */
export async function sendMail(
  mail: Mail,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        'Mail is not configured. Check RESEND_API_KEY and MAIL_FROM.',
      );
    } else {
      console.log(
        `[dev mail] to=${mail.to}\n` +
        `subject=${mail.subject}\n` +
        `${mail.text}`,
      );
    }

    return false;
  }

  // Allow up to 30 seconds for Resend to respond.
  const controller = new AbortController();
  const timeoutMs = 30_000;

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;

    if (!apiKey || !from) {
      console.error(
        'Mail configuration is incomplete. Check RESEND_API_KEY and MAIL_FROM.',
      );
      return false;
    }

    const response = await fetchImpl(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
        }),
      },
    );

    if (!response.ok) {
      // Capture the provider's error without logging credentials or
      // the email body, which may contain verification information.
      let providerMessage = '';

      try {
        const errorBody = (await response.text()).slice(0, 500);
        providerMessage = errorBody;
      } catch {
        providerMessage = 'Could not read the provider error response.';
      }

      console.error(
        `Resend email request failed with HTTP ${response.status}.`,
        providerMessage,
      );

      return false;
    }

    return true;
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      console.error(
        `Resend email request timed out after ${timeoutMs / 1000} seconds.`,
      );
    } else {
      const message =
        error instanceof Error ? error.message : 'Unknown network error';

      console.error('Resend email request failed:', message);
    }

    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Starts email sending without making the caller wait for the result.
 *
 * Note: on serverless platforms, fire-and-forget work may be interrupted
 * when a function finishes. For reliable transactional emails, prefer
 * awaiting sendMail() in the route or using a durable background queue.
 */
export function sendMailInBackground(mail: Mail): void {
  void sendMail(mail).catch((error: unknown) => {
    // sendMail normally catches its own errors. This also protects
    // against unexpected failures outside its normal error handling.
    console.error(
      'Unexpected background email error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  });
}