import { clearSession } from '../../../../lib/auth';
import { json, requireOrigin } from '../../../../lib/server-security';
export const runtime = 'nodejs';
export async function POST(req: Request) { if (!requireOrigin(req))
    return json({ error: 'Origin not allowed' }, 403); await clearSession(); return json({ ok: true }); }
