import { currentUser } from '../../../../../../lib/auth';
import { db, one } from '../../../../../../lib/db';
import { dbRateLimit } from '../../../../../../lib/guard';
import { json, requireOrigin, isUuid } from '../../../../../../lib/server-security';
import {
  validateLiveKitConfig,
  getLiveKitServerUrl,
  deriveLiveKitRoomName,
  createLiveKitToken,
} from '../../../../../../lib/livekit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u) {
    return json({ error: 'Sign in required' }, 401);
  }

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return json({ error: 'Invalid request id' }, 400);
  }

  if (!(await dbRateLimit(`call-accept:${u.id}`, 20, 60000))) {
    return json({ error: 'Too many requests. Please wait.' }, 429);
  }

  // Find the active ringing session for this student and request
  const session = await one<any>(
    `select id, request_id as "requestId", mentor_id as "mentorId", student_id as "studentId", status
     from mentor_call_sessions
     where request_id = $1 and student_id = $2 and status = 'ringing'
       and created_at > now() - interval '90 seconds'
     order by created_at desc
     limit 1`,
    [id, u.id]
  );

  if (!session) {
    return json({ error: 'No active incoming call found for this session or call has expired' }, 404);
  }

  // Update session to accepted
  await db().query(
    `update mentor_call_sessions
     set status = 'accepted', accepted_at = now()
     where id = $1`,
    [session.id]
  );

  // Validate LiveKit configuration
  const configCheck = validateLiveKitConfig();
  if (!configCheck.valid) {
    return json(
      {
        error: configCheck.reason || 'LiveKit video infrastructure is not configured on this server.',
        code: configCheck.code || 'LIVEKIT_NOT_CONFIGURED',
      },
      503
    );
  }

  const roomName = deriveLiveKitRoomName(id);

  try {
    const token = await createLiveKitToken({
      requestId: id,
      userId: u.id,
      userName: u.name,
      role: 'student',
      ttlMinutes: 45,
    });

    return json({
      ok: true,
      sessionId: session.id,
      status: 'accepted',
      roomName,
      token,
      serverUrl: getLiveKitServerUrl(),
      participantIdentity: u.id,
      participantName: u.name,
      role: 'student',
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not generate room token' }, 500);
  }
}
