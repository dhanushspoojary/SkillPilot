import pg from 'pg';
import fsSync from 'node:fs';
import { determineNextAction } from '../lib/next-action-engine.ts';
import { saveStudentCapabilityProfile } from '../lib/capability-profile.ts';

for (const f of ['.env.local', '../.env.local', '.env', '../.env']) {
  if (fsSync.existsSync(f)) {
    try { process.loadEnvFile(f); } catch {}
    if (process.env.DATABASE_URL) break;
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function check(cond, msg) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✓ ${msg}`);
}

(async () => {
  console.log('--- PHASE 4: AUDITING THE AUTOMATIC NEXT-ACTION ENGINE ---');
  const stamp = Date.now();
  const testUserId = (await pool.query(
    `insert into users (email, name, password_hash, role, status)
     values ($1, $2, $3, 'student', 'active')
     returning id`,
    [`audit-student-${stamp}@test.local`, 'Audit Student', 'hash-placeholder-123']
  )).rows[0].id;

  try {
    // 1. STATE A: Incomplete Onboarding
    console.log('\n[Scenario 1] Testing Incomplete Onboarding...');
    const action1 = await determineNextAction(testUserId);
    check(action1.type === 'ONBOARDING', 'Should recommend ONBOARDING when profile is uncalibrated');
    check(action1.route === 'calibration', 'Route must be calibration');
    check(action1.buttonLabel === 'Start Discovery', 'Button label should be Start Discovery');

    // 2. STATE B: Baseline Diagnostic Assessment
    console.log('\n[Scenario 2] Testing Missing Diagnostic Assessment...');
    await saveStudentCapabilityProfile(testUserId, {
      educationLevel: 'first_year',
      programmingExperience: 'beginner',
      careerInterests: ['Software Engineer'],
      weeklyHours: 5,
      skillsToLearn: ['C', 'Problem Solving'],
      skillsKnown: ['JavaScript'],
      onboardingCompleted: true,
    });
    const action2 = await determineNextAction(testUserId);
    check(action2.type === 'ASSESSMENT', 'Should recommend ASSESSMENT when no baseline evidence exists');
    check(action2.route === 'assess', 'Route must be assess');
    check(action2.buttonLabel === 'Start Adaptive Diagnostic', 'Button label should prompt diagnostic');

    // Seed baseline evidence
    const skillRow = await pool.query(`select id from skills limit 1`);
    const skillId = skillRow.rows[0]?.id || '00000000-0000-0000-0000-000000000001';
    await pool.query(
      `insert into user_skill_evidence (user_id, skill_id, source, score, confidence, metadata)
       values ($1, $2, 'assessment', 70, 0.8, '{"baseline": true}')`,
      [testUserId, skillId]
    );

    // 3. STATE C: Weak Concept Requiring Remediation
    console.log('\n[Scenario 3] Testing Weak Concept Remedial Practice...');
    await pool.query(
      `insert into student_concept_mastery (user_id, skill_slug, concept, mastery_score, status, problems_attempted, problems_solved)
       values ($1, 'problem-solving', 'loop_invariants', 20, 'novice', 3, 0)`,
      [testUserId]
    );
    const action3 = await determineNextAction(testUserId);
    check(action3.type === 'PRACTICE', 'Should recommend remedial PRACTICE when a weak concept exists');
    check(action3.buttonLabel === 'Practice Weak Concept', 'Button label should specify Practice Weak Concept');
    check(action3.explanation.includes('loop invariants') || action3.explanation.includes('difficulty'), 'Explanation should reference the weak concept');

    // Clear weak concept (student mastered it)
    await pool.query(
      `update student_concept_mastery set status = 'mastered', mastery_score = 90, problems_solved = 3
       where user_id = $1 and concept = 'loop_invariants'`,
      [testUserId]
    );

    // 4. STATE D: In-Progress Lesson Resumption
    console.log('\n[Scenario 4] Testing In-Progress Lesson Resumption...');
    await pool.query(
      `insert into student_lesson_progress (user_id, skill_slug, lesson_id, status, exercises_completed, exercises_total)
       values ($1, 'problem-solving', 'ps-loop-tracing', 'in_progress', 1, 3)`,
      [testUserId]
    );
    const action4 = await determineNextAction(testUserId);
    check(action4.type === 'LESSON', 'Should recommend LESSON resumption');
    check(action4.lessonId === 'ps-loop-tracing', 'Must target the exact in-progress lesson');
    check(action4.buttonLabel === 'Resume Lesson', 'Button label must be Resume Lesson');
    check(action4.explanation.includes('Loop Tracing'), 'Explanation must mention the lesson title');

    // 5. STATE E: Progression to Next Lesson (Never repeats completed lesson)
    console.log('\n[Scenario 5] Testing Progression to Next Lesson without loops...');
    await pool.query(
      `update student_lesson_progress set status = 'completed', exercises_completed = 3, completed_at = now()
       where user_id = $1 and lesson_id = 'ps-loop-tracing'`,
      [testUserId]
    );
    const action5 = await determineNextAction(testUserId);
    check(action5.type === 'LESSON', 'Should recommend the next uncompleted LESSON');
    check(action5.lessonId !== 'ps-loop-tracing', 'Must NOT send student back into completed lesson');
    check(action5.buttonLabel === 'Start Learning', 'Button label should be Start Learning for fresh lesson');

    // 6. STATE F: Project Recommendation When Lessons Complete
    console.log('\n[Scenario 6] Testing Project Milestone when Core Curriculum Completed...');
    await pool.query(
      `insert into student_lesson_progress (user_id, skill_slug, lesson_id, status, exercises_completed, exercises_total, completed_at)
       values 
         ($1, 'c-systems', 'c-pointers-basics', 'completed', 3, 3, now()),
         ($1, 'modern-javascript', 'js-closures-scoping', 'completed', 3, 3, now()),
         ($1, 'sql-databases', 'sql-joins-filtering', 'completed', 3, 3, now())`,
      [testUserId]
    );
    const action6 = await determineNextAction(testUserId);
    check(action6.type === 'PROJECT', 'Should recommend a practical PROJECT after curriculum completion');
    check(action6.route === 'projects', 'Route must be projects');
    check(action6.buttonLabel === 'Open Project Workspace', 'Button label must be Open Project Workspace');
    check(action6.explanation.includes('turn your learning into verified passport proof'), 'Explanation must justify project recommendation');

    // 7. STATE G: Deterministic Resumption for Returning Student
    console.log('\n[Scenario 7] Testing Returning Student Persistence & Determinism...');
    const action7 = await determineNextAction(testUserId);
    check(action7.id === action6.id, 'Repeated calls for returning student must yield consistent task ID');
    check(action7.type === action6.type, 'Action type must be identical across sessions');

    console.log('\n======================================================');
    console.log('PHASE 4: NEXT-ACTION ENGINE AUDIT 100% VERIFIED');
    console.log('======================================================\n');
  } finally {
    // Cleanup audit test user
    await pool.query(`delete from users where id = $1`, [testUserId]).catch(() => {});
    await pool.end();
  }
})();
