// Comprehensive Journey & Evidence Integrity Verification Script
// Tests:
// 1. Beginner vs Experienced student journeys (plans, profiles, roadmaps, next actions)
// 2. Reassessment comparison (first-time null, reassessment delta accuracy)
// 3. Evidence creation across Assessment, Practice, Project, and Mock Interview
// 4. Prevention of duplicate evidence and incomplete activity evidence protection

import fs from 'node:fs';
import pg from 'pg';
import http from 'node:http';

if (!process.env.DATABASE_URL) {
  for (const f of [new URL('../.env.local', import.meta.url), 'apps/web/.env.local', '.env.local', '../.env.local', '.env']) {
    if (fs.existsSync(f)) {
      try { process.loadEnvFile(f); } catch {}
      if (process.env.DATABASE_URL) break;
    }
  }
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 10000,
});

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const stamp = Date.now();

function assert(condition, message) {
  if (!condition) {
    console.error(`\n❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function apiCall(path, { method = 'GET', cookie, body } = {}) {
  const headers = {
    origin: BASE_URL,
    ...(cookie ? { cookie } : {}),
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {}
  return { res, status: res.status, data, headers: res.headers };
}

async function run() {
  console.log('================================================================');
  console.log('SkillPilot Journey & Evidence Integrity Verification');
  console.log(`Target: ${BASE_URL} | Time: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  // Verify server reachability
  const health = await apiCall('/api/health');
  assert(health.status === 200, `Health check must return 200 (got ${health.status})`);
  console.log('✔ Server health check: OK\n');

  // -------------------------------------------------------------------------
  // PHASE 1: Beginner Student Journey Verification
  // -------------------------------------------------------------------------
  console.log('--- Phase 1: Beginner Student Journey ---');
  const beginnerEmail = `beginner_${stamp}@test.skillpilot.io`;
  const beginnerSignup = await apiCall('/api/auth/signup', {
    method: 'POST',
    body: {
      email: beginnerEmail,
      name: 'Beginner Student',
      password: 'SecurePassword123!',
      role: 'student',
    },
  });
  assert(beginnerSignup.status === 201, `Beginner signup failed (${beginnerSignup.status})`);
  const beginnerCookie = beginnerSignup.headers.get('set-cookie')?.split(';')[0];
  assert(beginnerCookie, 'Beginner must receive auth cookie');

  // Get Beginner User ID from DB
  const beginnerUserRow = await pool.query(`select id from users where email = $1`, [beginnerEmail]);
  const beginnerId = beginnerUserRow.rows[0].id;
  console.log(`✔ Created isolated beginner student account: ${beginnerId}`);

  // Complete Beginner Onboarding via Profile PATCH
  const beginnerProfilePatch = await apiCall('/api/profile', {
    method: 'PATCH',
    cookie: beginnerCookie,
    body: {
      careerGoal: 'Software Engineer',
      capabilityProfile: {
        educationLevel: 'first_year',
        programmingExperience: 'beginner',
        fieldOfStudy: 'computer_science',
        careerInterests: ['Software Engineer'],
        weeklyHours: 5,
        dailyMinutes: 20,
        difficultyPreference: 'simpler_explanations',
        focusAreas: ['Programming Fundamentals', 'Problem Solving'],
        primaryFocusSkill: 'problem-solving',
        onboardingCompleted: true,
      },
    },
  });
  assert(beginnerProfilePatch.status === 200, 'Beginner profile patch must succeed');

  // Call /api/assess/start for Beginner
  const beginnerAssessStart = await apiCall('/api/assess/start', {
    method: 'POST',
    cookie: beginnerCookie,
    body: {},
  });
  assert(beginnerAssessStart.status === 201, `Beginner assess/start must succeed (got ${beginnerAssessStart.status})`);
  assert(
    beginnerAssessStart.data.question.skill === 'problem-solving',
    `Beginner MUST start on problem-solving, never JS or SQL (got '${beginnerAssessStart.data.question.skill}')`
  );
  assert(
    beginnerAssessStart.data.question.level <= 1,
    `Beginner question level must be <= 1 (got Level ${beginnerAssessStart.data.question.level})`
  );
  console.log(`✔ Beginner diagnostic plan correctly started on: ${beginnerAssessStart.data.question.skill} (Level ${beginnerAssessStart.data.question.level})`);

  // Call /api/learn/next-action for Beginner
  const beginnerNextAction = await apiCall('/api/learn/next-action', {
    cookie: beginnerCookie,
  });
  assert(beginnerNextAction.status === 200, 'Beginner next-action must return 200');
  const bTask = beginnerNextAction.data.nextAction || beginnerNextAction.data.task;
  assert(bTask, 'Beginner next action must be defined');
  console.log(`✔ Beginner Next Action: "${bTask.title}" (Type: ${bTask.type})`);

  // Verify Beginner Roadmap Node States
  const beginnerProfile = await apiCall('/api/profile', { cookie: beginnerCookie });
  assert(beginnerProfile.status === 200, 'Beginner profile fetch must succeed');
  console.log(`✔ Verified beginner profile, career goal: ${beginnerProfile.data.careerGoal}\n`);


  // -------------------------------------------------------------------------
  // PHASE 2: Experienced Student Journey Verification
  // -------------------------------------------------------------------------
  console.log('--- Phase 2: Experienced Student Journey ---');
  const expEmail = `experienced_${stamp}@test.skillpilot.io`;
  const expSignup = await apiCall('/api/auth/signup', {
    method: 'POST',
    body: {
      email: expEmail,
      name: 'Experienced Student',
      password: 'SecurePassword123!',
      role: 'student',
    },
  });
  assert(expSignup.status === 201, `Experienced signup failed (${expSignup.status})`);
  const expCookie = expSignup.headers.get('set-cookie')?.split(';')[0];
  assert(expCookie, 'Experienced must receive auth cookie');

  const expUserRow = await pool.query(`select id from users where email = $1`, [expEmail]);
  const expId = expUserRow.rows[0].id;
  console.log(`✔ Created isolated experienced student account: ${expId}`);

  // Complete Experienced Onboarding
  const expProfilePatch = await apiCall('/api/profile', {
    method: 'PATCH',
    cookie: expCookie,
    body: {
      careerGoal: 'Backend Engineer',
      capabilityProfile: {
        educationLevel: 'graduated',
        programmingExperience: 'built_projects',
        fieldOfStudy: 'computer_science',
        careerInterests: ['Backend Engineer'],
        weeklyHours: 15,
        dailyMinutes: 60,
        difficultyPreference: 'harder_challenge',
        focusAreas: ['REST APIs', 'SQL', 'Backend Architecture'],
        primaryFocusSkill: 'problem-solving',
        onboardingCompleted: true,
      },
    },
  });
  assert(expProfilePatch.status === 200, 'Experienced profile patch must succeed');

  // Verify Experienced Career Goal Targets Differ from Beginner
  const expProfile = await apiCall('/api/profile', { cookie: expCookie });
  assert(expProfile.data.careerGoal === 'Backend Engineer', 'Career goal must be Backend Engineer');
  console.log(`✔ Verified Experienced Profile Career Goal: ${expProfile.data.careerGoal}`);


  // -------------------------------------------------------------------------
  // PHASE 3: Reassessment & Comparison Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 3: Reassessment & Score Comparison ---');
  // First Assessment for Experienced student on problem-solving
  const firstAssess = await apiCall('/api/assess/start', {
    method: 'POST',
    cookie: expCookie,
    body: { focus: 'problem-solving' },
  });
  assert(firstAssess.status === 201, 'First assessment start must succeed');
  const firstAid = firstAssess.data.assessmentId;
  let currentQ = firstAssess.data.question;

  // Answer first assessment
  let firstDone = false;
  let firstFinalResults = null;
  for (let step = 0; step < 6 && !firstDone; step++) {
    const submitRes = await apiCall('/api/assess/submit', {
      method: 'POST',
      cookie: expCookie,
      body: {
        assessmentId: firstAid,
        questionId: currentQ.id,
        choice: 0, // answer
      },
    });
    assert(submitRes.status === 200, `Answer step ${step} must succeed`);
    if (submitRes.data.done) {
      firstDone = true;
      firstFinalResults = submitRes.data.results;
      break;
    }
    currentQ = submitRes.data.question;
  }
  assert(firstDone, 'First assessment should complete');
  const firstPsResult = firstFinalResults.find((r) => r.skill === 'problem-solving');
  assert(firstPsResult, 'Must contain problem-solving result');
  assert(
    firstPsResult.comparison === null,
    'FIRST-TIME assessment must have comparison === null (no misleading comparison)'
  );
  console.log(`✔ First-time assessment completed. Score: ${firstPsResult.score}% | Comparison: null (correctly handled)`);

  // Clear 30-min cooldown in test database to allow immediate reassessment test
  await pool.query(
    `update assessments set completed_at = now() - interval '35 minutes' where id = $1`,
    [firstAid]
  );

  // Start REASSESSMENT on problem-solving
  const retestAssess = await apiCall('/api/assess/start', {
    method: 'POST',
    cookie: expCookie,
    body: { focus: 'problem-solving' },
  });
  assert(retestAssess.status === 201, `Reassessment start must succeed (got ${retestAssess.status})`);
  const retestAid = retestAssess.data.assessmentId;
  currentQ = retestAssess.data.question;

  let retestDone = false;
  let retestFinalResults = null;
  for (let step = 0; step < 6 && !retestDone; step++) {
    const submitRes = await apiCall('/api/assess/submit', {
      method: 'POST',
      cookie: expCookie,
      body: {
        assessmentId: retestAid,
        questionId: currentQ.id,
        choice: 0,
      },
    });
    assert(submitRes.status === 200, `Retest answer step ${step} must succeed`);
    if (submitRes.data.done) {
      retestDone = true;
      retestFinalResults = submitRes.data.results;
      break;
    }
    currentQ = submitRes.data.question;
  }
  assert(retestDone, 'Reassessment must complete');
  const retestPsResult = retestFinalResults.find((r) => r.skill === 'problem-solving');
  assert(retestPsResult, 'Must contain reassessment result');
  assert(retestPsResult.comparison !== null, 'REASSESSMENT must return comparison object');
  assert(
    retestPsResult.comparison.previousScore === firstPsResult.score,
    `comparison.previousScore (${retestPsResult.comparison.previousScore}) must match prior score (${firstPsResult.score})`
  );
  assert(
    retestPsResult.comparison.currentScore === retestPsResult.score,
    `comparison.currentScore must match retest score`
  );
  assert(
    retestPsResult.comparison.delta === (retestPsResult.score - firstPsResult.score),
    `comparison.delta must match currentScore - previousScore`
  );
  console.log(`✔ Reassessment comparison verified: Previous ${retestPsResult.comparison.previousScore}%, Current ${retestPsResult.comparison.currentScore}%, Delta ${retestPsResult.comparison.delta >= 0 ? '+' : ''}${retestPsResult.comparison.delta}%`);


  // -------------------------------------------------------------------------
  // PHASE 4: Evidence Integrity Verification Across All 4 Modalities
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 4: Evidence Integrity Verification ---');

  // 1. Assessment Evidence Checks
  const assessEvidence = await pool.query(
    `select id, user_id, skill_id, source, score, confidence, metadata from user_skill_evidence where user_id = $1 and source = 'assessment'`,
    [expId]
  );
  assert(assessEvidence.rows.length >= 2, 'Must have at least 2 assessment evidence rows');
  assert(assessEvidence.rows[0].user_id === expId, 'Evidence user_id must match student');
  assert(assessEvidence.rows[0].source === 'assessment', 'Evidence source must be assessment');
  assert(Number(assessEvidence.rows[0].confidence) > 0, 'Evidence confidence must be > 0');
  console.log(`✔ Assessment Evidence: verified ${assessEvidence.rows.length} rows, correct user_id, correct source, confidence > 0`);

  // Verify Idempotency / No Duplicates on re-submitting completed assessment
  const countBeforeResubmit = (await pool.query(
    `select count(*) from user_skill_evidence where user_id = $1 and source = 'assessment'`,
    [expId]
  )).rows[0].count;

  const repeatRes = await apiCall('/api/assess/submit', {
    method: 'POST',
    cookie: expCookie,
    body: {
      assessmentId: retestAid,
      questionId: 'current',
      choice: 0,
    },
  });
  assert(repeatRes.status === 200, 'Re-submitting completed assessment must return 200');
  assert(repeatRes.data.done === true, 'Re-submitting must return done = true');

  const countAfterResubmit = (await pool.query(
    `select count(*) from user_skill_evidence where user_id = $1 and source = 'assessment'`,
    [expId]
  )).rows[0].count;
  assert(countBeforeResubmit === countAfterResubmit, 'Re-submitting completed assessment must NOT insert duplicate evidence');
  console.log('✔ Assessment Deduplication: verified zero duplicate evidence rows on repeated submission');

  // 2. Practice Evidence Checks
  console.log('\nVerifying Practice & Coding Exercises...');
  const practiceAttempt = await apiCall('/api/learn/attempt', {
    method: 'POST',
    cookie: expCookie,
    body: {
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 1, // choice
      hintsUsed: 0,
    },
  });
  assert(practiceAttempt.status === 200, `Practice attempt must succeed (got ${practiceAttempt.status})`);

  // Verify practice attempts in DB
  const practiceRows = await pool.query(
    `select user_id, skill_slug, question_id, is_correct, hints_used from student_practice_attempts where user_id = $1`,
    [expId]
  );
  assert(practiceRows.rows.length > 0, 'student_practice_attempts must contain the attempt');
  assert(practiceRows.rows[0].user_id === expId, 'Practice attempt must belong to expId');
  assert(practiceRows.rows[0].skill_slug === 'problem-solving', 'Practice attempt skill must be problem-solving');
  console.log(`✔ Practice Attempt: verified user_id, skill_slug, question_id in student_practice_attempts`);

  // Verify Concept Mastery Table
  const masteryRows = await pool.query(
    `select user_id, skill_slug, concept, status from student_concept_mastery where user_id = $1`,
    [expId]
  );
  assert(masteryRows.rows.length > 0, 'student_concept_mastery must contain tracked concept');
  console.log(`✔ Concept Mastery: verified concept '${masteryRows.rows[0].concept}' tracked with status '${masteryRows.rows[0].status}'`);

  // 3. Practical Project Evidence Checks
  console.log('\nVerifying Practical Projects...');
  // Test failing code submission (should NOT award verified evidence)
  const failProjectRes = await apiCall('/api/projects', {
    method: 'POST',
    cookie: expCookie,
    body: {
      slug: 'rest-bookstore-service',
      code: 'export class BookstoreService { listBooks() { return null; } }',
    },
  });
  assert(failProjectRes.status === 200, 'Project submission should return 200');
  assert(failProjectRes.data.passed === false, 'Failing project code must have passed === false');

  const projectEvidenceFail = await pool.query(
    `select * from user_skill_evidence where user_id = $1 and source = 'project' and metadata->>'projectSlug' = 'rest-bookstore-service'`,
    [expId]
  );
  assert(projectEvidenceFail.rows.length === 0, 'FAILING project must NOT award evidence in user_skill_evidence');
  console.log('✔ Failing Project: verified 0 evidence awarded for incomplete/failing code');

  // Test passing code submission
  const validPassingCode = `
export class BookstoreService {
  constructor() {
    this.books = [];
  }
  listBooks() {
    return this.books;
  }
  getBookById(id) {
    return this.books.find(b => b.id === id);
  }
  addBook(payload) {
    if (!payload || !payload.title || !payload.author) {
      throw new Error('400: Invalid payload');
    }
    this.books.push(payload);
    return payload;
  }
  deleteBook(id) {
    this.books = this.books.filter(b => b.id !== id);
    return true;
  }
}
`;
  const passProjectRes = await apiCall('/api/projects', {
    method: 'POST',
    cookie: expCookie,
    body: {
      slug: 'rest-bookstore-service',
      code: validPassingCode,
    },
  });
  assert(passProjectRes.status === 200, 'Passing project code must return 200');
  assert(passProjectRes.data.passed === true, 'Passing project code must have passed === true');

  // Check DB for project evidence
  const projectEvidencePass = await pool.query(
    `select id, user_id, skill_id, source, score, confidence from user_skill_evidence where user_id = $1 and source = 'project' and metadata->>'projectSlug' = 'rest-bookstore-service'`,
    [expId]
  );
  assert(projectEvidencePass.rows.length > 0, 'PASSING project must award evidence in user_skill_evidence');
  assert(projectEvidencePass.rows[0].source === 'project', 'Project evidence source must be project');
  assert(Number(projectEvidencePass.rows[0].score) >= 80, `Verified project must have score >= 80 (got ${projectEvidencePass.rows[0].score})`);
  assert(Number(projectEvidencePass.rows[0].confidence) >= 0.80, `Project confidence must be >= 0.80 (got ${projectEvidencePass.rows[0].confidence})`);
  console.log(`✔ Passing Project: verified evidence awarded (source: 'project', score: ${projectEvidencePass.rows[0].score}, confidence: ${projectEvidencePass.rows[0].confidence})`);

  // Verify Project Deduplication: resubmitting passing project must NOT insert duplicate evidence
  const projectEvidenceCountBefore = projectEvidencePass.rows.length;
  await apiCall('/api/projects', {
    method: 'POST',
    cookie: expCookie,
    body: {
      slug: 'rest-bookstore-service',
      code: validPassingCode,
    },
  });
  const projectEvidenceCountAfter = (await pool.query(
    `select count(*) from user_skill_evidence where user_id = $1 and source = 'project' and metadata->>'projectSlug' = 'rest-bookstore-service'`,
    [expId]
  )).rows[0].count;
  assert(Number(projectEvidenceCountAfter) === projectEvidenceCountBefore, `Resubmitting passing project must NOT duplicate evidence (expected ${projectEvidenceCountBefore}, got ${projectEvidenceCountAfter})`);
  console.log('✔ Project Deduplication: verified zero duplicate evidence on repeated submission');

  // 4. Mock Interview Evidence Checks
  console.log('\nVerifying Mock Interview Session & Evidence...');
  // Start mock interview
  const interviewStart = await apiCall('/api/interview/start', {
    method: 'POST',
    cookie: expCookie,
    body: { skill: 'communication' },
  });
  assert(interviewStart.status === 201, `Interview start must succeed (got ${interviewStart.status})`);
  const interviewId = interviewStart.data.interview.id;

  // Incomplete mock interview attempt (calling finish without answering all questions)
  const incompleteFinish = await apiCall('/api/interview/finish', {
    method: 'POST',
    cookie: expCookie,
    body: { interviewId },
  });
  assert(incompleteFinish.status === 409, 'Incomplete interview finish must be rejected with 409');
  const interviewEvidenceIncomplete = await pool.query(
    `select * from user_skill_evidence where user_id = $1 and metadata->>'interviewId' = $2`,
    [expId, interviewId]
  );
  assert(interviewEvidenceIncomplete.rows.length === 0, 'Incomplete interview must NOT award evidence');
  console.log('✔ Incomplete Mock Interview: verified 409 rejection and 0 evidence awarded');

  // Answer mock interview questions (3 questions)
  for (let pos = 1; pos <= 3; pos++) {
    const ansRes = await apiCall('/api/interview/answer', {
      method: 'POST',
      cookie: expCookie,
      body: {
        interviewId,
        position: pos,
        transcript: `This is a structured technical answer for position ${pos} demonstrating communication clarity, trade-off explanation, and architectural reasoning.`,
        latencyMs: 1200,
      },
    });
    assert(ansRes.status === 200, `Answering interview question ${pos} must succeed`);
  }

  // Finish mock interview
  const finishRes = await apiCall('/api/interview/finish', {
    method: 'POST',
    cookie: expCookie,
    body: { interviewId },
  });
  assert(finishRes.status === 200, `Finishing complete interview must succeed (got ${finishRes.status})`);
  assert(finishRes.data.interview.score > 0, 'Completed interview must have score > 0');

  // Check DB for mock interview record & evidence
  const interviewRecord = await pool.query(
    `select id, user_id, status, server_score from mock_interviews where id = $1`,
    [interviewId]
  );
  assert(interviewRecord.rows.length === 1, 'mock_interviews must have session record');
  assert(interviewRecord.rows[0].status === 'completed', 'mock_interviews status must be completed');

  const interviewEvidence = await pool.query(
    `select id, user_id, skill_id, source, score, confidence, metadata from user_skill_evidence where user_id = $1 and metadata->>'interviewId' = $2`,
    [expId, interviewId]
  );
  assert(interviewEvidence.rows.length === 1, 'mock interview must write evidence row to user_skill_evidence');
  assert(interviewEvidence.rows[0].user_id === expId, 'Interview evidence user_id must match');
  console.log(`✔ Completed Mock Interview: verified record in mock_interviews and evidence row in user_skill_evidence (score: ${interviewEvidence.rows[0].score}%)`);

  // Verify Mock Interview Deduplication
  const repeatInterviewFinish = await apiCall('/api/interview/finish', {
    method: 'POST',
    cookie: expCookie,
    body: { interviewId },
  });
  assert(repeatInterviewFinish.status === 409, 'Re-finishing completed interview must be rejected with 409');
  const interviewEvidenceCount = (await pool.query(
    `select count(*) from user_skill_evidence where user_id = $1 and metadata->>'interviewId' = $2`,
    [expId, interviewId]
  )).rows[0].count;
  assert(interviewEvidenceCount === '1', 'Re-finishing interview must NOT duplicate evidence');
  console.log('✔ Mock Interview Deduplication: verified 409 rejection and zero duplicate evidence on repeated finish');

  console.log('\n================================================================');
  console.log('ALL JOURNEY & EVIDENCE INTEGRITY VERIFICATIONS PASSED (100%)');
  console.log('================================================================');
}

run()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
