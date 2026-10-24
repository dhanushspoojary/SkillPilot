import { json, requireOrigin } from '../../../../lib/server-security.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    return json({ error: 'Email verification is no longer required. You can sign in directly with your email and password.' }, 400);
}
