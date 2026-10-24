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
  if (!u || u.role !== 'mentor' || !u.mentorApproved) {
    return json({ error: 'Approved mentor account required' }, 403);
  }

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return json({ error: 'Invalid request id' }, 400);
  }

  if (!(await dbRateLimit(`call-initiate:${u.id}`, 20, 60000))) {
    return json({ error: 'Too many call attempts. Please wait.' }, 429);
  }

  // Verify mentor request exists, is accepted, and belongs to this mentor
  const mr = await one<any>(
    `select id, student_id as "studentId", mentor_id as "mentorId", status
     from mentor_requests
     where id = $1 and mentor_id = $2`,
    [id, u.id]
  );

  if (!mr) {
    return json({ error: 'Mentor request not found or unauthorized' }, 404);
  }

  if (mr.status !== 'accepted' && mr.status !== 'completed') {
    return json({ error: `Cannot call student for a '${mr.status}' request. Must be accepted.` }, 400);
  }

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

  // Clean up any stale sessions for this request
  await db()
    .query(
      `update mentor_call_sessions
       set status = 'ended', ended_at = now()
       where request_id = $1 and status in ('ringing', 'accepted')`,
      [id]
    )
    .catch(() => undefined);

  // Create new active calling session
  const session = await one<any>(
    `insert into mentor_call_sessions (request_id, mentor_id, student_id, room_name, status)
     values ($1, $2, $3, $4, 'ringing')
     returning id, status, created_at as "createdAt"`,
    [id, u.id, mr.studentId, roomName]
  );

  try {
    const token = await createLiveKitToken({
      requestId: id,
      userId: u.id,
      userName: u.name,
      role: 'mentor',
      ttlMinutes: 45,
    });

    return json({
      ok: true,
      sessionId: session.id,
      status: 'ringing',
      roomName,
      token,
      serverUrl: getLiveKitServerUrl(),
      participantIdentity: u.id,
      participantName: u.name,
      role: 'mentor',
    }, 201);
  } catch (err) {
    // Revert session if token creation fails
    await db().query(`delete from mentor_call_sessions where id = $1`, [session.id]).catch(() => undefined);
    return json({ error: err instanceof Error ? err.message : 'Could not initialize video room' }, 500);
  }
}
