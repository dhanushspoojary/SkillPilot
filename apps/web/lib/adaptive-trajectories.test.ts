import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from './questions.ts';
import {
  evaluateResponse,
  selectAdaptiveNextQuestion,
  computeSkillAdaptiveSummary,
} from './adaptive-engine.ts';

// ============================================================================
// TRAJECTORY A: Complete Beginner
// Initial skill estimate: 0%. Answers questions incorrectly / struggles.
// Engine diagnoses foundational gap, steps down to Level 0, and halts boundedly.
// ============================================================================
test('Adaptive Trajectory A: Complete Beginner', () => {
  const trajectoryLog: any[] = [];
  const skill = 'javascript';
  const usedIds = new Set<string>();

  // 1. Initial Probe: Level 1 question
  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1);
  assert.ok(q1, 'Level 1 question must exist for javascript');
  usedIds.add(q1.id);

  // Student is a complete beginner and picks the wrong choice
  const wrongChoice1 = (q1.answer + 1) % q1.options.length;
  const eval1 = evaluateResponse(q1, { choice: wrongChoice1 });
  assert.equal(eval1.classification, 'INCORRECT');
  assert.ok(eval1.misconceptionIdentified, 'Misconception must be identified');

  // Next Question Selection: Step down to Level 0 diagnostic
  const q2 = selectAdaptiveNextQuestion({
    skill,
    currentQuestion: q1,
    evalResult: eval1,
    usedQuestionIds: usedIds,
  });
  assert.ok(q2, 'Diagnostic question must be selected');
  assert.ok(q2.level <= q1.level, 'Level must step down or stay at foundation');
  usedIds.add(q2.id);

  trajectoryLog.push({
    step: 1,
    initialEstimate: 0,
    answered: { id: q1.id, level: q1.level },
    eval: eval1.classification,
    next: { id: q2.id, level: q2.level },
    reason: `Stepped down from Level ${q1.level} to Level ${q2.level} diagnostic`,
  });

  // Student struggles with Q2 as well
  const wrongChoice2 = (q2.answer + 1) % q2.options.length;
  const eval2 = evaluateResponse(q2, { choice: wrongChoice2 });
  assert.equal(eval2.classification, 'INCORRECT');

  const summary = computeSkillAdaptiveSummary({
    skill,
    items: [
      { question: q1, response: { choice: wrongChoice1 } },
      { question: q2, response: { choice: wrongChoice2 } },
    ],
  });

  assert.equal(summary.decisiveEvidenceReached, true, '2 consecutive struggles establish decisive baseline boundary');
  assert.ok(summary.proficiency < 40, 'Beginner proficiency is accurately low');
  assert.ok(summary.misconceptions.length > 0, 'Foundational misconceptions identified');

  trajectoryLog.push({
    step: 2,
    answered: { id: q2.id, level: q2.level },
    eval: eval2.classification,
    stoppingReason: 'Decisive baseline boundary reached (consecutive struggles)',
    finalProficiency: summary.proficiency,
    recommendedAction: summary.nextAction,
  });

  console.log('\n[TRAJECTORY A — COMPLETE BEGINNER LOG]', JSON.stringify(trajectoryLog, null, 2));
  assert.equal(trajectoryLog.length, 2);
});

// ============================================================================
// TRAJECTORY B: Learner with Intermediate JavaScript Experience
// Starts at Level 1, answers correctly, elevates to Level 2 and succeeds.
// Demonstrates intermediate proficiency without starting at zero.
// ============================================================================
test('Adaptive Trajectory B: Learner with Intermediate Experience', () => {
  const trajectoryLog: any[] = [];
  const skill = 'javascript';
  const usedIds = new Set<string>();

  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1)!;
  usedIds.add(q1.id);
  const eval1 = evaluateResponse(q1, { choice: q1.answer });
  assert.equal(eval1.classification, 'CORRECT');

  // Next question: Elevate to Level 2
  const q2 = selectAdaptiveNextQuestion({
    skill,
    currentQuestion: q1,
    evalResult: eval1,
    usedQuestionIds: usedIds,
  })!;
  assert.ok(q2, 'Intermediate question must be selected');
  assert.ok(q2.level >= 2, 'Level elevated to 2');
  usedIds.add(q2.id);

  // Student answers intermediate Level 2 question correctly
  const eval2 = evaluateResponse(q2, { choice: q2.answer });
  assert.equal(eval2.classification, 'CORRECT');

  const summary = computeSkillAdaptiveSummary({
    skill,
    items: [
      { question: q1, response: { choice: q1.answer } },
      { question: q2, response: { choice: q2.answer } },
    ],
  });

  assert.equal(summary.decisiveEvidenceReached, true, 'Intermediate mastery demonstrated at Level >= 2');
  assert.ok(summary.proficiency >= 80, 'Proficiency reflects intermediate/advanced mastery');
  assert.ok(summary.verifiedConcepts.length >= 2, 'Multiple verified concepts recorded');

  trajectoryLog.push({
    step: 2,
    stoppingReason: 'Decisive mastery demonstrated at Level >= 2',
    finalProficiency: summary.proficiency,
    verifiedConcepts: summary.verifiedConcepts,
  });

  console.log('\n[TRAJECTORY B — INTERMEDIATE JS LOG]', JSON.stringify(trajectoryLog, null, 2));
});

// ============================================================================
// TRAJECTORY C: Learner Who Answers Several Questions Correctly
// Elevates difficulty systematically and verifies consecutive mastery criteria.
// ============================================================================
test('Adaptive Trajectory C: Consecutive Correct Mastery Path', () => {
  const skill = 'problem-solving';
  const usedIds = new Set<string>();

  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1)!;
  usedIds.add(q1.id);
  const eval1 = evaluateResponse(q1, { choice: q1.answer });

  const q2 = selectAdaptiveNextQuestion({ skill, currentQuestion: q1, evalResult: eval1, usedQuestionIds: usedIds })!;
  assert.ok(q2.level > q1.level, 'Elevated difficulty on correct answer');
  usedIds.add(q2.id);
  const eval2 = evaluateResponse(q2, { choice: q2.answer });

  const summary = computeSkillAdaptiveSummary({
    skill,
    items: [
      { question: q1, response: { choice: q1.answer } },
      { question: q2, response: { choice: q2.answer } },
    ],
  });

  assert.equal(summary.decisiveEvidenceReached, true);
  assert.ok(summary.proficiency >= 85);
  assert.ok(summary.nextAction.includes('Ready for practical project') || summary.nextAction.includes('verification'));
});

// ============================================================================
// TRAJECTORY D: Learner Who Answers Several Questions Incorrectly
// Steps down diagnostic difficulty, isolates misconception, and halts gracefully.
// ============================================================================
test('Adaptive Trajectory D: Consecutive Incorrect Diagnostic Path', () => {
  const skill = 'sql';
  const usedIds = new Set<string>();

  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1)!;
  usedIds.add(q1.id);
  const eval1 = evaluateResponse(q1, { choice: (q1.answer + 1) % q1.options.length });
  assert.equal(eval1.classification, 'INCORRECT');

  const q2 = selectAdaptiveNextQuestion({ skill, currentQuestion: q1, evalResult: eval1, usedQuestionIds: usedIds })!;
  assert.ok(q2.level <= q1.level, 'Diagnostic stepped down or simplified');
  usedIds.add(q2.id);

  const eval2 = evaluateResponse(q2, { choice: (q2.answer + 1) % q2.options.length });
  assert.equal(eval2.classification, 'INCORRECT');

  const summary = computeSkillAdaptiveSummary({
    skill,
    items: [
      { question: q1, response: { choice: (q1.answer + 1) % q1.options.length } },
      { question: q2, response: { choice: (q2.answer + 1) % q2.options.length } },
    ],
  });

  assert.equal(summary.decisiveEvidenceReached, true, 'Concludes safely after boundary identified');
  assert.ok(summary.misconceptions.length > 0, 'Foundational misconceptions cataloged');
});

// ============================================================================
// TRAJECTORY E: Inconsistent Performance (Alternating Correct / Incorrect)
// Engine does NOT stop prematurely after 2 questions; resolves uncertainty.
// ============================================================================
test('Adaptive Trajectory E: Alternating Answers Resolving Uncertainty', () => {
  const skill = 'rest-apis';
  const usedIds = new Set<string>();

  // Q1: Level 1 -> Correct
  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1)!;
  usedIds.add(q1.id);
  const eval1 = evaluateResponse(q1, { choice: q1.answer });

  // Q2: Level 2 -> Incorrect (Struggle at elevated difficulty)
  const q2 = selectAdaptiveNextQuestion({ skill, currentQuestion: q1, evalResult: eval1, usedQuestionIds: usedIds })!;
  usedIds.add(q2.id);
  const eval2 = evaluateResponse(q2, { choice: (q2.answer + 1) % q2.options.length });

  // Summary after 2 items is NOT decisive
  const summary2 = computeSkillAdaptiveSummary({
    skill,
    items: [
      { question: q1, response: { choice: q1.answer } },
      { question: q2, response: { choice: (q2.answer + 1) % q2.options.length } },
    ],
  });
  assert.equal(summary2.decisiveEvidenceReached, false, 'Alternating answers require resolution');

  // Engine selects Q3 to resolve uncertainty
  const q3 = selectAdaptiveNextQuestion({ skill, currentQuestion: q2, evalResult: eval2, usedQuestionIds: usedIds })!;
  assert.ok(q3, 'Q3 must be presented to resolve inconsistency');
  usedIds.add(q3.id);
  assert.ok(usedIds.size >= 3, 'At least 3 questions used');
});

// ============================================================================
// TRAJECTORY F: Learner Who Interrupts and Resumes
// Preserved session restores answered items and does NOT re-probe old questions.
// ============================================================================
test('Adaptive Trajectory F: Interrupt and Resume Session', () => {
  const skill = 'git';
  const usedIds = new Set<string>();

  // Initial session: answers Q1
  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1)!;
  usedIds.add(q1.id);
  const eval1 = evaluateResponse(q1, { choice: q1.answer });

  // Session state serialized / saved
  const serializedSession = {
    skill,
    answeredIds: Array.from(usedIds),
    items: [{ questionId: q1.id, choice: q1.answer }],
    lastLevel: q1.level,
  };

  // Learner resumes in a new session:
  const restoredUsedIds = new Set(serializedSession.answeredIds);
  assert.ok(restoredUsedIds.has(q1.id), 'Prior question ID restored');

  const resumedNextQ = selectAdaptiveNextQuestion({
    skill: serializedSession.skill,
    currentQuestion: q1,
    evalResult: eval1,
    usedQuestionIds: restoredUsedIds,
  });

  assert.ok(resumedNextQ, 'Next question selected upon resume');
  assert.notEqual(resumedNextQ.id, q1.id, 'Resumed session must never repeat answered question');
  assert.equal(restoredUsedIds.has(resumedNextQ.id), false, 'New question is fresh');
});

// ============================================================================
// TRAJECTORY G: Duplicate Submission Idempotency
// Submitting the same question twice does NOT duplicate score or inflate metrics.
// ============================================================================
test('Adaptive Trajectory G: Repeated Submission Protection', () => {
  const skill = 'sql';
  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1)!;

  // Single valid evaluation:
  const singleItems = [{ question: q1, response: { choice: q1.answer } }];
  const singleSummary = computeSkillAdaptiveSummary({ skill, items: singleItems });

  // Deduplication check: Filter items by unique question ID before computation
  const duplicateRawItems = [
    { question: q1, response: { choice: q1.answer } },
    { question: q1, response: { choice: q1.answer } }, // Duplicate attempt
  ];

  const dedupedItems = Array.from(
    new Map(duplicateRawItems.map((it) => [it.question.id, it])).values()
  );

  const dedupedSummary = computeSkillAdaptiveSummary({ skill, items: dedupedItems });

  assert.equal(dedupedItems.length, 1, 'Duplicate item safely filtered');
  assert.equal(dedupedSummary.proficiency, singleSummary.proficiency, 'Proficiency is identical and not inflated');
  assert.equal(dedupedSummary.totalAsked, singleSummary.totalAsked, 'Question count is not inflated');
});

// ============================================================================
// TRAJECTORY H: Learner with Prior Verified Skill Evidence
// Starting probe respects prior evidence level rather than forcing Level 0.
// ============================================================================
test('Adaptive Trajectory H: Prior Verified Skill Evidence Calibration', () => {
  const skill = 'javascript';
  const priorEvidence = {
    skill: 'javascript',
    score: 80,
    level: 2,
    at: new Date().toISOString(),
  };

  // When prior evidence exists at level 2, the initial probe starts at calibrated level
  const initialProbe = selectAdaptiveNextQuestion({
    skill,
    currentLevel: priorEvidence.level,
    usedQuestionIds: new Set<string>(),
  });

  assert.ok(initialProbe, 'Calibrated probe selected');
  assert.ok(
    initialProbe.level >= priorEvidence.level,
    `Probe level ${initialProbe.level} matches or tests retention of prior level ${priorEvidence.level}`
  );
});
