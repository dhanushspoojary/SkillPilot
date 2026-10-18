import { clearSession, currentUser } from '../../../../lib/auth';
import { json, requireOrigin, logSecurityEvent } from '../../../../lib/server-security';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);

    const user = await currentUser().catch(() => null);
    if (user) {
        await logSecurityEvent({
            userId: user.id,
            eventType: 'auth.logout',
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
            userAgent: req.headers.get('user-agent'),
        });
    }

    await clearSession();
    return json({ ok: true });
}

export async function GET() {
    return json({ error: 'Method not allowed. Use POST to log out.' }, 405);
}
