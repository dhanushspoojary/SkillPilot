import { currentUser } from '../../../../../../lib/auth';
import { one } from '../../../../../../lib/db';
import { dbRateLimit } from '../../../../../../lib/guard';
import { json, requireOrigin, isUuid } from '../../../../../../lib/server-security';
import {
  isLiveKitConfigured,
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

  if (!(await dbRateLimit(`call-token:${u.id}`, 20, 60000))) {
    return json({ error: 'Too many token requests. Please wait a moment.' }, 429);
  }

  // 1. Check if the mentor request exists at all
  const rawRequest = await one<any>(
    `select id, student_id as "studentId", mentor_id as "mentorId", status
     from mentor_requests where id=$1`,
    [id],
  );

  if (!rawRequest) {
    return json({ error: 'Mentor request not found' }, 404);
  }

  // 2. Enforce strict participant authorization: ONLY the assigned student or mentor
  if (rawRequest.studentId !== u.id && rawRequest.mentorId !== u.id) {
    return json({ error: 'Unauthorized: you are not a participant in this mentor session' }, 403);
  }

  // 3. Request must be accepted or completed
  if (rawRequest.status !== 'accepted' && rawRequest.status !== 'completed') {
    return json(
      { error: `Video call token cannot be generated for a '${rawRequest.status}' request. Must be accepted.` },
      400
    );
  }

  // 4. Verify LiveKit configuration
  if (!isLiveKitConfigured()) {
    return json(
      {
        error: 'LiveKit video infrastructure is not configured on this server.',
        code: 'LIVEKIT_NOT_CONFIGURED',
      },
      503
    );
  }

  try {
    const role = u.id === rawRequest.mentorId ? 'mentor' : 'student';
    const roomName = deriveLiveKitRoomName(id);

    const token = await createLiveKitToken({
      requestId: id,
      userId: u.id,
      userName: u.name,
      role,
      ttlMinutes: 45,
    });

    return json({
      ok: true,
      token,
      serverUrl: getLiveKitServerUrl(),
      roomName,
      participantIdentity: u.id,
      participantName: u.name,
      role,
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Could not generate room token' },
      500
    );
  }
}
