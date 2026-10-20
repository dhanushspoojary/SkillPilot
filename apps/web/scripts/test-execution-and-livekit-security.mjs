/**
 * SKILLPILOT ISOLATED CODE EXECUTION & LIVEKIT SECURITY TEST SUITE
 * Verifies server authorization, input constraints, token minting,
 * CSRF origin validation, and evidence integrity against active attack vectors.
 */

import assert from 'node:assert/strict';
import { TokenVerifier } from 'livekit-server-sdk';
import pg from 'pg';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;

console.log('======================================================');
console.log('TEST SUITE: ISOLATED CODE EXECUTION & LIVEKIT SECURITY');
console.log('======================================================\n');

async function run() {
  let passed = 0;
  let failed = 0;

  function recordPass(desc) {
    console.log(`✓ ${desc}`);
    passed++;
  }

  function recordFail(desc, err) {
    console.error(`✗ ${desc}:`, err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // SECTION 1: Practice Execution Security & Input Validation
  // --------------------------------------------------------------------------
  console.log('[SECTION 1] Practice Arena Execution API Security');

  // Test 1.1: Unauthenticated request rejected
  try {
    const res = await fetch(`${BASE_URL}/api/practice/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
      },
      body: JSON.stringify({
        code: 'console.log(1)',
        problemId: 'two-sum-target',
        language: 'javascript',
      }),
    });
    assert.equal(res.status, 401, 'Should reject unauthenticated call');
    recordPass('Unauthenticated execute call is rejected with 401');
  } catch (e) {
    recordFail('Unauthenticated execute call is rejected with 401', e);
  }

  // Test 1.2: Cross-origin CSRF spoofing rejected
  try {
    const res = await fetch(`${BASE_URL}/api/practice/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious-attacker.com',
      },
      body: JSON.stringify({
        code: 'console.log(1)',
        problemId: 'two-sum-target',
        language: 'javascript',
      }),
    });
    assert.equal(res.status, 403, 'Should reject untrusted origin');
    recordPass('Cross-origin CSRF request rejected with 403');
  } catch (e) {
    recordFail('Cross-origin CSRF request rejected with 403', e);
  }

  // --------------------------------------------------------------------------
  // SECTION 2: LiveKit Token Generation & Room Authorization
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 2] LiveKit Video Room Authorization & Token Security');

  // Test 2.1: Unauthenticated token request rejected
  try {
    const res = await fetch(`${BASE_URL}/api/mentor-requests/00000000-0000-0000-0000-000000000001/call/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
      },
    });
    assert.equal(res.status, 401, 'Should reject unauthenticated token request');
    recordPass('Unauthenticated LiveKit token request rejected with 401');
  } catch (e) {
    recordFail('Unauthenticated LiveKit token request rejected with 401', e);
  }

  // Test 2.2: Malformed UUID request rejected
  try {
    const res = await fetch(`${BASE_URL}/api/mentor-requests/not-a-valid-uuid/call/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
      },
    });
    assert.ok(res.status === 400 || res.status === 401, 'Should reject invalid UUID or unauthorized');
    recordPass('Malformed UUID request rejected safely');
  } catch (e) {
    recordFail('Malformed UUID request rejected safely', e);
  }

  // Test 2.3: LiveKit token minting unit verification
  try {
    const testApiKey = 'devkey_test_livekit_123';
    const testSecret = 'secret_32_characters_long_for_hmac_signing_1234';
    const reqId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'usr-student-42';

    const { createLiveKitToken, deriveLiveKitRoomName } = await import('../lib/livekit.js').catch(
      async () => await import('../lib/livekit.ts')
    );

    process.env.LIVEKIT_API_KEY = testApiKey;
    process.env.LIVEKIT_API_SECRET = testSecret;

    const token = await createLiveKitToken({
      requestId: reqId,
      userId,
      userName: 'Bob Student',
      role: 'student',
      ttlMinutes: 30,
    });

    assert.ok(token, 'Should generate valid JWT');
    const verifier = new TokenVerifier(testApiKey, testSecret);
    const claims = await verifier.verify(token);

    assert.equal(claims.sub, userId);
    assert.equal(claims.video?.room, `mentor-call-${reqId}`);
    assert.equal(claims.video?.roomJoin, true);
    assert.equal(claims.video?.canPublish, true);
    assert.equal(claims.video?.canSubscribe, true);

    recordPass('LiveKit AccessToken verified: signed JWT scoped to deterministic room');
  } catch (e) {
    recordFail('LiveKit AccessToken verified: signed JWT scoped to deterministic room', e);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: Code Execution Provider Abstraction & Harness Integrity
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 3] Code Execution Provider Abstraction');

  try {
    const { getActiveExecutionProvider, executePracticeSubmission } = await import(
      '../lib/code-execution/index.js'
    ).catch(async () => await import('../lib/code-execution/index.ts'));

    const provider = getActiveExecutionProvider();
    console.log(`   Active Provider configured in process: ${provider ? provider.name : 'none (Drafting Mode)'}`);

    // Test rejection of oversized code
    const oversized = 'x = 1;\n'.repeat(10000);
    const oversizeRes = await executePracticeSubmission({
      code: oversized,
      problemId: 'two-sum-target',
      language: 'javascript',
      testCases: [{ id: 'tc-1', input: '1', expectedOutput: '1' }],
    });
    assert.equal(oversizeRes.status, 'rejected_code_too_large');
    assert.equal(oversizeRes.success, false);
    recordPass('Code length limit (>50,000 chars) enforced');

    // Test rejection of unsupported language
    const langRes = await executePracticeSubmission({
      code: 'puts "hello"',
      problemId: 'two-sum-target',
      language: 'ruby',
      testCases: [{ id: 'tc-1', input: '1', expectedOutput: '1' }],
    });
    assert.equal(langRes.status, 'rejected_unsupported_language');
    recordPass('Unsupported language strictly rejected against allowlist');

    // Test offline runner safe behavior
    const offlineRes = await executePracticeSubmission({
      code: 'function twoSum() { return [0, 1]; }',
      problemId: 'two-sum-target',
      language: 'javascript',
      testCases: [
        { id: 'tc-1', input: '[2, 7], 9', expectedOutput: '[0, 1]', isHidden: false },
        { id: 'tc-2', input: 'SECRET', expectedOutput: 'SECRET', isHidden: true },
      ],
      isSubmission: true,
    });
    assert.equal(offlineRes.success, false);
    assert.equal(offlineRes.isRunnerAvailable, false);
    assert.equal(offlineRes.runnerType, 'disabled_no_sandbox');
    recordPass('Offline runner safely disables execution without fabricating fake passes');
  } catch (e) {
    recordFail('Code Execution Provider Abstraction', e);
  }

  console.log('\n======================================================');
  console.log(`SECURITY & ISOLATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
