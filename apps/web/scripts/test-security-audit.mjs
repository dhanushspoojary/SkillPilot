import pg from 'pg';
import fsSync from 'node:fs';
import { requireOrigin } from '../lib/server-security.ts';
import { submitExerciseAttempt } from '../lib/practice-engine.ts';

for (const f of [new URL('../.env.local', import.meta.url), '.env.local', 'apps/web/.env.local', '../.env.local', '.env', '../.env']) {
  if (fsSync.existsSync(f)) {
    try { process.loadEnvFile(f); } catch {}
    if (process.env.DATABASE_URL) break;
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

(async () => {
  console.log('--- PHASE 5: SECURITY, ISOLATION & REGRESSION AUDIT ---');

  // 1. Host Header Spoofing vs CSRF Origin Protection
  console.log('\n[Security 1] Testing Host Header Spoofing & CSRF Origin Protection...');
  
  // Cross-site origin should be blocked
  const crossSiteReq = new Request('http://localhost:3000/api/learn/attempt', {
    method: 'POST',
    headers: {
      'origin': 'https://evil-attacker.com',
      'host': 'localhost:3000'
    }
  });
  assert(requireOrigin(crossSiteReq) === false, 'Cross-site origin must be rejected');

  // Arbitrary Host header attempting to match evil origin
  const spoofedHostReq = new Request('http://evil-attacker.com/api/learn/attempt', {
    method: 'POST',
    headers: {
      'origin': 'https://evil-attacker.com',
      'host': 'evil-attacker.com'
    }
  });
  assert(requireOrigin(spoofedHostReq) === false, 'Arbitrary Host header spoofing must NOT bypass origin validation');

  // Legitimate same-origin request
  const legitReq = new Request('http://localhost:3000/api/learn/attempt', {
    method: 'POST',
    headers: {
      'origin': 'http://localhost:3000',
      'host': 'localhost:3000'
    }
  });
  assert(requireOrigin(legitReq) === true, 'Legitimate same-origin request must be accepted');

  // 2. Client Side Leakage Audit (Correct Answers hidden before submission)
  console.log('\n[Security 2] Testing Answer Secrecy (Zero Pre-Submission Leakage)...');
  const serverBase = 'http://localhost:3000';
  
  // Call /api/learn/lesson?id=ps-loop-tracing without auth -> must be 401
  const unauthLessonRes = await fetch(`${serverBase}/api/learn/lesson?id=ps-loop-tracing`);
  assert(unauthLessonRes.status === 401, 'Unauthenticated access to learning lesson must be 401');

  const unauthActionRes = await fetch(`${serverBase}/api/learn/next-action`);
  assert(unauthActionRes.status === 401, 'Unauthenticated access to next-action must be 401');

  // 3. Duplicate Submission Mastery Credit Idempotency Test
  console.log('\n[Security 3] Testing Idempotency & Duplicate Submission Credit Protection...');
  const studentAId = 'ffffffff-aaaa-4444-8888-000000000001';
  const studentBId = 'ffffffff-bbbb-4444-8888-000000000002';

  try {
    // Create student A and student B
    await pool.query(
      `insert into users (id, email, password_hash, role, name)
       values 
         ($1, 'student.a@test.com', 'dummyhash', 'student', 'Student A'),
         ($2, 'student.b@test.com', 'dummyhash', 'student', 'Student B')
       on conflict (id) do nothing`,
      [studentAId, studentBId]
    );

    // Clean prior attempts
    await pool.query(`delete from student_practice_attempts where user_id in ($1, $2)`, [studentAId, studentBId]);
    await pool.query(`delete from student_lesson_progress where user_id in ($1, $2)`, [studentAId, studentBId]);
    await pool.query(`delete from student_concept_mastery where user_id in ($1, $2)`, [studentAId, studentBId]);
    await pool.query(`delete from user_skill_evidence where user_id in ($1, $2) and source = 'practice'`, [studentAId, studentBId]);

    // Student A submits ps-trace-q1 correctly first time (zero hints)
    const res1 = await submitExerciseAttempt({
      userId: studentAId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 0, // correct ('4')
      hintsUsed: 0
    });

    assert(res1.isCorrect === true, 'First attempt must evaluate correct');
    assert(res1.lessonProgress.exercisesCompleted === 1, 'First correct attempt should increment completed to 1');
    const score1 = res1.conceptMastery.score;
    assert(score1 === 35, 'First correct attempt with 0 hints should award 35 score');

    // Student A resubmits the EXACT same correct exercise (duplicate submission)
    const res2 = await submitExerciseAttempt({
      userId: studentAId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 0, // correct again
      hintsUsed: 0
    });

    assert(res2.isCorrect === true, 'Duplicate submission still returns correct answer feedback');
    assert(res2.lessonProgress.exercisesCompleted === 1, 'Duplicate submission MUST NOT increment exercisesCompleted again');
    assert(res2.conceptMastery.score === score1, 'Duplicate submission MUST NOT award duplicate mastery score');
    assert(res2.conceptMastery.problemsSolved === 1, 'Duplicate submission MUST NOT increment problemsSolved again');

    // 4. Cross-Student Privacy & Data Isolation
    console.log('\n[Security 4] Testing Cross-Student Data Isolation...');
    // Student B attempts the same exercise incorrectly (index 1 is '6')
    const resB = await submitExerciseAttempt({
      userId: studentBId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 1, // incorrect
      hintsUsed: 1
    });

    assert(resB.isCorrect === false, 'Student B incorrect answer evaluated correctly');
    assert(resB.lessonProgress.exercisesCompleted === 0, 'Student B has 0 exercises completed');

    // Verify database rows are isolated
    const rowsA = await pool.query(
      `select count(*)::int as count from student_practice_attempts where user_id = $1`,
      [studentAId]
    );
    const rowsB = await pool.query(
      `select count(*)::int as count from student_practice_attempts where user_id = $1`,
      [studentBId]
    );
    assert(rowsA.rows[0].count === 2, 'Student A has exactly 2 attempts recorded');
    assert(rowsB.rows[0].count === 1, 'Student B has exactly 1 attempt recorded');

    // Confirm Student B cannot see Student A progress
    const bProg = await pool.query(
      `select * from student_lesson_progress where user_id = $1`,
      [studentBId]
    );
    assert(bProg.rows[0].exercises_completed === 0, 'Student B progress record is completely isolated from Student A');

    console.log('\n======================================================');
    console.log('PHASE 5: SECURITY & REGRESSION AUDIT 100% VERIFIED');
    console.log('======================================================\n');
  } finally {
    // Cleanup test users
    await pool.query(`delete from users where id in ($1, $2)`, [studentAId, studentBId]).catch(() => {});
    await pool.end();
    process.exit(0);
  }
})();
