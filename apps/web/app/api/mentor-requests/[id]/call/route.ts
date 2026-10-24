import { currentUser } from '../../../../../lib/auth';
import { one } from '../../../../../lib/db';
import { dbRateLimit } from '../../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText, isUuid, validMeetingUrl } from '../../../../../lib/server-security';
import {
  isLiveKitConfigured,
  validateLiveKitConfig,
  getLiveKitServerUrl,
  deriveLiveKitRoomName,
  createLiveKitToken,
} from '../../../../../lib/livekit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const u = await currentUser();
  if (!u) return json({ error: 'Sign in required' }, 401);
  if (!(await dbRateLimit(`call-read:${u.id}`, 30, 60000))) return json({ error: 'Too many refreshes' }, 429);
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Invalid request id' }, 400);

  const r = await one<any>(
    `select id, student_id as "studentId", mentor_id as "mentorId", status,
            call_url as "callUrl", call_scheduled_at as "callAt"
     from mentor_requests where id=$1 and (student_id=$2 or mentor_id=$2) and status in ('accepted','completed')`,
    [id, u.id],
  );
  if (!r) return json({ error: 'Call is available once a request is accepted' }, 404);

  const configCheck = validateLiveKitConfig();
  let livekitInfo: any = {
    available: false,
    message: configCheck.reason || 'LiveKit credentials are not configured on this server.',
    code: configCheck.code || 'LIVEKIT_NOT_CONFIGURED',
  };

  if (configCheck.valid) {
    try {
      const role = u.id === r.mentorId ? 'mentor' : 'student';
      const token = await createLiveKitToken({
        requestId: id,
        userId: u.id,
        userName: u.name,
        role,
        ttlMinutes: 45,
      });

      livekitInfo = {
        available: true,
        serverUrl: getLiveKitServerUrl(),
        roomName: deriveLiveKitRoomName(id),
        token,
        participantIdentity: u.id,
        participantName: u.name,
        role,
      };
    } catch (err) {
      livekitInfo = {
        available: false,
        message: err instanceof Error ? err.message : 'Could not generate room token',
      };
    }
  }

  return json({
    call: {
      callUrl: r.callUrl,
      callAt: r.callAt,
      livekit: livekitInfo,
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const u = await currentUser();
  if (!u || u.role !== 'mentor' || !u.mentorApproved) return json({ error: 'Approved mentor account required' }, 403);
  if (!(await dbRateLimit(`call-link:${u.id}`, 20, 3600000))) return json({ error: 'Too many link updates this hour.' }, 429);
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Invalid request id' }, 400);
  try {
    const b = await readJsonBody<any>(req, 10000);
    const raw = typeof b.callUrl === 'string' ? b.callUrl.trim() : '';
    const callUrl = raw === '' ? null : validMeetingUrl(raw);
    if (raw !== '' && !callUrl) return json({ error: `Link must be an HTTPS URL on an approved meeting host.` }, 400);
    const schedMs = b.callScheduledAt ? Date.parse(String(b.callScheduledAt)) : NaN;
    if (b.callScheduledAt && Number.isNaN(schedMs)) return json({ error: 'Invalid meeting date/time' }, 400);
    const callAt = Number.isNaN(schedMs) ? null : new Date(schedMs).toISOString();
    const out = await one<any>(
      `update mentor_requests set call_url=$1,call_scheduled_at=$2
       where id=$3 and mentor_id=$4 and status='accepted'
       returning call_url as "callUrl",call_scheduled_at as "callAt"`,
      [callUrl, callAt, id, u.id],
    );
    if (!out) return json({ error: 'Request not found or not accepted' }, 404);
    return json({ call: out });
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'body_too_large') return json({ error: 'Request body is too large' }, 413);
    if (message === 'invalid_json') return json({ error: 'Invalid JSON body' }, 400);
    return json({ error: 'Could not save meeting link' }, 500);
  }
}
