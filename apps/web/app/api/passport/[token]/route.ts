import { getPublicPassport } from '../../../../lib/passport';
import { json } from '../../../../lib/server-security';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const passport = await getPublicPassport(token);

  if (!passport) {
    return json({ error: 'Passport not found or share has been revoked' }, 404);
  }

  return json({ passport });
}
