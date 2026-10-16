import { db } from '../../../lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        await db().query('select 1');
        return Response.json({ service: 'skillpilot', status: 'ok', database: 'ok', timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch {
        return Response.json({ service: 'skillpilot', status: 'degraded', database: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
