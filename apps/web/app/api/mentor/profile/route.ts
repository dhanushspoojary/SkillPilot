import { currentUser } from '../../../../lib/auth';
import { db, one } from '../../../../lib/db';
import { dbRateLimit } from '../../../../lib/guard';
import { SKILLS } from '../../../../lib/questions';
import { json, readJsonBody, requireOrigin, safeText } from '../../../../lib/server-security';
export const runtime = 'nodejs';
export async function GET() { const u = await currentUser(); if (!u || u.role !== 'mentor')
    return json({ error: 'Mentor required' }, 403); return json({ profile: await one<any>('select * from mentor_profiles where user_id=$1', [u.id]) }); }
export async function PATCH(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u || u.role !== 'mentor')
        return json({ error: 'Mentor required' }, 403);
    if (!(await dbRateLimit(`mentor-profile:${u.id}`, 20, 3600000)))
        return json({ error: 'Profile update limit reached for this hour.' }, 429);
    try {
        const b = await readJsonBody<any>(req, 20000);
        const bio = safeText(b.bio, 600) || '';
        const focus = safeText(b.focus, 120) || '';
        const rawSkills = Array.isArray(b.skills) ? b.skills : [];
        if (rawSkills.length > 12 || rawSkills.some((x: any) => typeof x !== 'string' || x.trim().length > 64))
            return json({ error: 'Invalid mentor skills' }, 400);
        const skills = [...new Set<string>(rawSkills.map((x: string) => x.trim().toLowerCase()))];
        if (skills.some((x: string) => !SKILLS.some(s => s.id === x)))
            return json({ error: 'Mentor skill list contains an unknown skill' }, 400);
        const r = await db().query(`update mentor_profiles set bio=$1,focus=$2,skills=$3 where user_id=$4 returning *`, [bio, focus, JSON.stringify(skills), u.id]);
        return json({ profile: r.rows[0] });
    }
    catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m === 'body_too_large')
            return json({ error: 'Request too large' }, 413);
        return json({ error: 'Could not update mentor profile' }, 500);
    }
}
