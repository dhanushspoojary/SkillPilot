import { json, requireOrigin } from '../../../../lib/server-security.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    return json({ error: 'Email-based password reset is disabled. Signed-in users can update passwords in Settings, or contact an administrator.' }, 400);
}
