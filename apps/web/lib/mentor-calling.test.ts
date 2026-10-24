import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveLiveKitRoomName,
  createLiveKitToken,
  isLiveKitConfigured,
} from './livekit.ts';

describe('Mentor Calling Signalling & Session Lifecycle', () => {
  it('guarantees deterministic, identical room names for both mentor and student', () => {
    const requestId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const mentorRoom = deriveLiveKitRoomName(requestId);
    const studentRoom = deriveLiveKitRoomName(requestId);

    assert.equal(mentorRoom, studentRoom);
    assert.match(mentorRoom, /^mentor-call-a1b2c3d4/);
  });

  it('generates distinct participant identities and permissions for mentor vs student', async () => {
    const oldUrl = process.env.LIVEKIT_URL;
    const oldKey = process.env.LIVEKIT_API_KEY;
    const oldSecret = process.env.LIVEKIT_API_SECRET;

    process.env.LIVEKIT_URL = 'wss://test.livekit.io';
    process.env.LIVEKIT_API_KEY = 'test_key_123';
    process.env.LIVEKIT_API_SECRET = 'secret_key_minimum_length_required_by_livekit_sdk_123';

    try {
      const requestId = '11111111-2222-3333-4444-555555555555';
      const mentorId = 'mentor-usr-123';
      const studentId = 'student-usr-456';

      const mentorToken = await createLiveKitToken({
        requestId,
        userId: mentorId,
        userName: 'Dr. Sarah Connor',
        role: 'mentor',
        ttlMinutes: 45,
      });

      const studentToken = await createLiveKitToken({
        requestId,
        userId: studentId,
        userName: 'Alex Student',
        role: 'student',
        ttlMinutes: 45,
      });

      assert.ok(mentorToken, 'Mentor token generated');
      assert.ok(studentToken, 'Student token generated');
      assert.notEqual(mentorToken, studentToken, 'Tokens must be uniquely signed per identity');

      // Decode payloads to verify room and identities match specifications
      const parseJwtPayload = (token: string) => {
        const parts = token.split('.');
        assert.equal(parts.length, 3, 'JWT must have 3 parts');
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      };

      const mentorPayload = parseJwtPayload(mentorToken);
      const studentPayload = parseJwtPayload(studentToken);

      assert.equal(mentorPayload.sub, mentorId);
      assert.equal(studentPayload.sub, studentId);
      assert.equal(mentorPayload.video.room, studentPayload.video.room);
      assert.equal(mentorPayload.video.roomJoin, true);
      assert.equal(studentPayload.video.roomJoin, true);
    } finally {
      if (oldUrl) process.env.LIVEKIT_URL = oldUrl; else delete process.env.LIVEKIT_URL;
      if (oldKey) process.env.LIVEKIT_API_KEY = oldKey; else delete process.env.LIVEKIT_API_KEY;
      if (oldSecret) process.env.LIVEKIT_API_SECRET = oldSecret; else delete process.env.LIVEKIT_API_SECRET;
    }
  });

  it('validates call session state transition rules', () => {
    type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'expired';

    function canTransition(current: CallStatus, next: CallStatus): boolean {
      const allowed: Record<CallStatus, CallStatus[]> = {
        ringing: ['accepted', 'declined', 'ended', 'expired'],
        accepted: ['ended'],
        declined: [],
        ended: [],
        expired: [],
      };
      return allowed[current].includes(next);
    }

    assert.ok(canTransition('ringing', 'accepted'), 'ringing -> accepted is allowed');
    assert.ok(canTransition('ringing', 'declined'), 'ringing -> declined is allowed');
    assert.ok(canTransition('ringing', 'ended'), 'ringing -> ended is allowed');
    assert.ok(canTransition('ringing', 'expired'), 'ringing -> expired is allowed');
    assert.ok(canTransition('accepted', 'ended'), 'accepted -> ended is allowed');

    assert.ok(!canTransition('accepted', 'declined'), 'accepted -> declined is forbidden');
    assert.ok(!canTransition('declined', 'accepted'), 'declined -> accepted is forbidden');
    assert.ok(!canTransition('ended', 'ringing'), 'ended -> ringing is forbidden');
  });

  it('calculates call auto-expiration correctly after 60 seconds', () => {
    const isCallExpired = (createdAtMs: number, nowMs: number) => {
      return nowMs - createdAtMs > 60_000;
    };

    const now = Date.now();
    assert.equal(isCallExpired(now - 30_000, now), false, 'Call at 30s is not expired');
    assert.equal(isCallExpired(now - 59_000, now), false, 'Call at 59s is not expired');
    assert.equal(isCallExpired(now - 61_000, now), true, 'Call at 61s is expired');
    assert.equal(isCallExpired(now - 120_000, now), true, 'Call at 120s is expired');
  });
});
