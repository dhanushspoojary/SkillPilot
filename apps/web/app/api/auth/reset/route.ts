import { json, requireOrigin } from '../../../../lib/server-security.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  return json({ error: 'Password reset via email is disabled on this platform. Authenticated users can change their password in Settings.' }, 400);
}
