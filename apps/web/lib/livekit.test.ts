import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLiveKitConfigured,
  getLiveKitServerUrl,
  deriveLiveKitRoomName,
  createLiveKitToken,
} from './livekit.ts';
import { TokenVerifier } from 'livekit-server-sdk';

test('livekit: isLiveKitConfigured detects complete and incomplete credentials', () => {
  const oldUrl = process.env.LIVEKIT_URL;
  const oldKey = process.env.LIVEKIT_API_KEY;
  const oldSecret = process.env.LIVEKIT_API_SECRET;

  try {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    assert.equal(isLiveKitConfigured(), false);

    process.env.LIVEKIT_URL = 'wss://mock.livekit.cloud';
    assert.equal(isLiveKitConfigured(), false);

    process.env.LIVEKIT_API_KEY = 'mock-key';
    assert.equal(isLiveKitConfigured(), false);

    process.env.LIVEKIT_API_SECRET = 'mock-secret-at-least-32-chars-long-123456';
    assert.equal(isLiveKitConfigured(), true);
    assert.equal(getLiveKitServerUrl(), 'wss://mock.livekit.cloud');
  } finally {
    if (oldUrl) process.env.LIVEKIT_URL = oldUrl; else delete process.env.LIVEKIT_URL;
    if (oldKey) process.env.LIVEKIT_API_KEY = oldKey; else delete process.env.LIVEKIT_API_KEY;
    if (oldSecret) process.env.LIVEKIT_API_SECRET = oldSecret; else delete process.env.LIVEKIT_API_SECRET;
  }
});

test('livekit: deriveLiveKitRoomName enforces deterministic room identifiers', () => {
  const reqId = '7b7c25c8-1bb1-4cfa-811c-c764f434ee49';
  const room1 = deriveLiveKitRoomName(reqId);
  const room2 = deriveLiveKitRoomName(reqId);

  assert.equal(room1, 'mentor-call-7b7c25c8-1bb1-4cfa-811c-c764f434ee49');
  assert.equal(room1, room2);
  // Rejects arbitrary user-supplied names by exclusively scoping to requestId
  assert.notEqual(room1, 'arbitrary-room-name');
});

test('livekit: createLiveKitToken generates signed JWT with room grants', async () => {
  const testKey = 'devkey123';
  const testSecret = 'secret_key_minimum_length_required_by_livekit_sdk_123';

  process.env.LIVEKIT_URL = 'wss://test.livekit.io';
  process.env.LIVEKIT_API_KEY = testKey;
  process.env.LIVEKIT_API_SECRET = testSecret;

  try {
    const token = await createLiveKitToken({
      requestId: 'req-456',
      userId: 'usr-student-99',
      userName: 'Alice Student',
      role: 'student',
      ttlMinutes: 20,
    });

    assert.ok(typeof token === 'string');
    assert.ok(token.length > 50);

    // Verify token structure using official TokenVerifier
    const verifier = new TokenVerifier(testKey, testSecret);
    const claims = await verifier.verify(token);

    assert.equal(claims.sub, 'usr-student-99');
    assert.equal(claims.name, 'Alice Student');
    assert.ok(claims.video);
    assert.equal(claims.video.room, 'mentor-call-req-456');
    assert.equal(claims.video.roomJoin, true);
    assert.equal(claims.video.canPublish, true);
    assert.equal(claims.video.canSubscribe, true);

    const metadata = JSON.parse(claims.metadata || '{}');
    assert.equal(metadata.role, 'student');
    assert.equal(metadata.requestId, 'req-456');
  } finally {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
  }
});

test('livekit: throws informative error when credentials missing', async () => {
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;

  await assert.rejects(
    async () => {
      await createLiveKitToken({
        requestId: 'req-1',
        userId: 'u-1',
        userName: 'User',
        role: 'student',
      });
    },
    /LiveKit credentials .* are not configured/
  );
});

test('livekit: mentor role token has correct metadata and grants', async () => {
  const testKey = 'mentor_test_key';
  const testSecret = 'mentor_test_secret_32_characters_long_12345';

  process.env.LIVEKIT_API_KEY = testKey;
  process.env.LIVEKIT_API_SECRET = testSecret;

  try {
    const token = await createLiveKitToken({
      requestId: 'req-mentor-888',
      userId: 'usr-mentor-01',
      userName: 'Dr. Jane Mentor',
      role: 'mentor',
    });

    const verifier = new TokenVerifier(testKey, testSecret);
    const claims = await verifier.verify(token);

    assert.equal(claims.sub, 'usr-mentor-01');
    assert.equal(claims.name, 'Dr. Jane Mentor');
    assert.equal(claims.video?.room, 'mentor-call-req-mentor-888');

    const metadata = JSON.parse(claims.metadata || '{}');
    assert.equal(metadata.role, 'mentor');
  } finally {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
  }
});
