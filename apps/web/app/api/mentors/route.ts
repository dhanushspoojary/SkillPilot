import { currentUser } from '../../../lib/auth';
import { many } from '../../../lib/db';
import { json } from '../../../lib/server-security';
import { dbRateLimit } from '../../../lib/guard';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { const u = await currentUser(); if (!u)
    return json({ error: 'Unauthorized' }, 401); if (u.role !== 'student')
    return json({ mentors: [] }); if (!(await dbRateLimit(`mentor-discovery:${u.id}`, 30, 60000)))
    return json({ error: 'Mentor discovery rate limit reached' }, 429); const url = new URL(req.url); const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || 12))); const offset = Math.min(200, Math.max(0, Number(url.searchParams.get('offset') || 0))); const q = (url.searchParams.get('q') || '').trim().slice(0, 80); const params: any[] = [limit, offset]; let filter = ''; if (q) {
    params.push(`%${q}%`);
    filter = ' and (u.name ilike $3 or mp.focus ilike $3 or mp.bio ilike $3)';
} const mentors = await many<any>(`select u.id,u.name,mp.bio,mp.focus,mp.skills from users u join mentor_profiles mp on mp.user_id=u.id where u.role='mentor' and u.status='active' and mp.status='approved'${filter} order by mp.approved_at desc,u.name asc limit $1 offset $2`, params); return json({ mentors, limit, offset, hasMore: mentors.length === limit }); }
