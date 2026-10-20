import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

console.log('======================================================');
console.log('SKILLPILOT COMPREHENSIVE INTEGRATION & WORKFLOW VERIFICATION');
console.log('======================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passCount++;
  } else {
    console.error(`✗ FAILED: ${message}`);
    failCount++;
  }
}

const { db } = await import('../lib/db.ts');
const { createEmailToken, consumeEmailToken } = await import('../lib/email-tokens.ts');
const { createLiveKitToken, deriveLiveKitRoomName, isLiveKitConfigured } = await import('../lib/livekit.ts');
const { TokenVerifier } = await import('livekit-server-sdk');
const { getActiveExecutionProvider, executePracticeSubmission } = await import('../lib/code-execution/index.ts');

// SECTION 1: DATABASE INTEGRITY
console.log('[SECTION 1] Database & Tables Integrity');
const dbRes = await db().query('SELECT count(*) as count FROM users');
assert(Number(dbRes.rows[0].count) >= 0, 'PostgreSQL database connected and users table accessible');

// SECTION 2: EMAIL VERIFICATION & PASSWORD RESET TOKEN LIFECYCLE
console.log('\n[SECTION 2] Email Verification & Password Reset Token Lifecycle');
const testUserId = (await db().query('SELECT id FROM users LIMIT 1')).rows[0]?.id;
if (testUserId) {
  // Test verify token
  const verifyToken = await createEmailToken(testUserId, 'verify', 60);
  assert(typeof verifyToken === 'string' && verifyToken.length >= 40, 'Created secure single-use verify email token');
  
  const consumedUserId = await consumeEmailToken(verifyToken, 'verify');
  assert(consumedUserId === testUserId, 'Consumed verify token matches original user ID');

  const secondAttempt = await consumeEmailToken(verifyToken, 'verify');
  assert(secondAttempt === null, 'Verify token cannot be reused (single-use enforced)');

  // Test reset token
  const resetToken = await createEmailToken(testUserId, 'reset', 30);
  assert(typeof resetToken === 'string' && resetToken.length >= 40, 'Created secure single-use password reset token');

  const consumedResetUser = await consumeEmailToken(resetToken, 'reset');
  assert(consumedResetUser === testUserId, 'Consumed reset token matches original user ID');

  const secondResetAttempt = await consumeEmailToken(resetToken, 'reset');
  assert(secondResetAttempt === null, 'Reset token cannot be reused (single-use enforced)');
} else {
  console.log('Skipping token test (no users in database)');
}

// SECTION 3: LIVEKIT TOKEN GENERATION & PARTICIPANT ROOM ISOLATION
console.log('\n[SECTION 3] LiveKit Token Generation & Room Authorization');
assert(isLiveKitConfigured(), 'LiveKit credentials configured in environment');

const testRequestId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const expectedRoom = deriveLiveKitRoomName(testRequestId);

const studentJwt = await createLiveKitToken({
  requestId: testRequestId,
  userId: 'student-uuid-1',
  userName: 'Test Student',
  role: 'student'
});

const mentorJwt = await createLiveKitToken({
  requestId: testRequestId,
  userId: 'mentor-uuid-2',
  userName: 'Test Mentor',
  role: 'mentor'
});

assert(typeof studentJwt === 'string' && studentJwt.length > 50, 'Student token generated successfully');
assert(typeof mentorJwt === 'string' && mentorJwt.length > 50, 'Mentor token generated successfully');

const verifier = new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
const studentClaims = await verifier.verify(studentJwt);
const mentorClaims = await verifier.verify(mentorJwt);

assert(studentClaims.sub === 'student-uuid-1', 'Student token identity claim is correct');
assert(mentorClaims.sub === 'mentor-uuid-2', 'Mentor token identity claim is correct');
assert(studentClaims.video?.room === expectedRoom, `Student token scoped to deterministic room: ${expectedRoom}`);
assert(mentorClaims.video?.room === expectedRoom, `Mentor token scoped to deterministic room: ${expectedRoom}`);
assert(studentClaims.video?.roomJoin === true, 'Student has roomJoin permission');
assert(mentorClaims.video?.roomJoin === true, 'Mentor has roomJoin permission');

// Parse metadata
const studentMeta = JSON.parse(studentClaims.metadata || '{}');
const mentorMeta = JSON.parse(mentorClaims.metadata || '{}');
assert(studentMeta.role === 'student' && studentMeta.requestId === testRequestId, 'Student metadata verified');
assert(mentorMeta.role === 'mentor' && mentorMeta.requestId === testRequestId, 'Mentor metadata verified');

// SECTION 4: CODE EXECUTION PROVIDER & SECURITY BOUNDARY
console.log('\n[SECTION 4] Code Execution Provider & Honest Fallback Verification');
const provider = getActiveExecutionProvider();
assert(provider !== null, 'Execution provider abstraction initialized');

const testSubmission = {
  problemId: 'two-sum-target',
  language: 'python',
  code: 'def two_sum(nums, target): return [0, 1]',
  testCases: [
    { id: 'tc-1', input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]' }
  ],
  isSubmission: true
};

const execRes = await executePracticeSubmission(testSubmission);
assert(typeof execRes.status === 'string', `Execution status returned: ${execRes.status}`);

if (!execRes.isRunnerAvailable) {
  assert(execRes.success === false, 'When runner is unavailable, success is strictly false');
  assert(execRes.totalPassed === 0, 'When runner is unavailable, totalPassed is strictly 0');
  console.log(`✓ Honest unavailable message: "${execRes.message}"`);
  passCount++;
} else {
  console.log(`✓ Runner is available; result success=${execRes.success}`);
  passCount++;
}

// SECTION 4B: ISOLATED IN-MEMORY SQL PRACTICE DATABASE ENGINE
console.log('\n[SECTION 4B] Isolated In-Memory SQL Practice Database Engine');
const sqlSubmission = {
  problemId: 'sql-second-highest-salary',
  language: 'sql',
  code: 'SELECT MAX(salary) AS SecondHighestSalary FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);',
  testCases: [
    { id: 'tc-1', input: '[[1, 100], [2, 200], [3, 300]]', expectedOutput: '200' },
    { id: 'tc-2', input: '[[1, 100]]', expectedOutput: 'null' }
  ],
  isSubmission: true
};
const sqlRes = await executePracticeSubmission(sqlSubmission);
assert(sqlRes.provider === 'sqlite_internal', 'SQL query routed to isolated in-memory SQLite sandbox');
assert(sqlRes.isRunnerAvailable === true, 'Isolated SQLite sandbox is active and available');
assert(sqlRes.success === true, 'SQL submission passed all test cases in isolated practice sandbox');
assert(sqlRes.totalPassed === 2, 'SQL submission passed both test cases without touching production PostgreSQL');


// SECTION 5: SECRET EXPOSURE CHECK
console.log('\n[SECTION 5] Secret Leakage & Redaction Verification');
assert(!process.env.NEXT_PUBLIC_ONLINECOMPILER_API_KEY, 'NEXT_PUBLIC_ONLINECOMPILER_API_KEY does NOT exist (must never be public)');
assert(!process.env.NEXT_PUBLIC_LIVEKIT_API_SECRET, 'NEXT_PUBLIC_LIVEKIT_API_SECRET does NOT exist (must never be public)');
assert(!process.env.NEXT_PUBLIC_DATABASE_URL, 'NEXT_PUBLIC_DATABASE_URL does NOT exist (must never be public)');
assert(!process.env.NEXT_PUBLIC_SESSION_SECRET, 'NEXT_PUBLIC_SESSION_SECRET does NOT exist (must never be public)');
assert(!process.env.NEXT_PUBLIC_GEMINI_API_KEY, 'NEXT_PUBLIC_GEMINI_API_KEY does NOT exist (must never be public)');

console.log('\n======================================================');
console.log(`INTEGRATION SUITE COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================');

if (failCount > 0) process.exit(1);
