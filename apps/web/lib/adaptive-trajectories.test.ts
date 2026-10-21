import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from './questions.ts';
import {
  evaluateResponse,
  selectAdaptiveNextQuestion,
  computeSkillAdaptiveSummary,
} from './adaptive-engine.ts';

test('Adaptive Assessment — Trajectory 1: Demonstrates Mastery with Difficulty Elevation', () => {
  const trajectoryLog: any[] = [];
  const skill = 'problem-solving';
  const usedIds = new Set<string>();

  // 1. Initial Question: Starts at Level 1
  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1);
  assert.ok(q1, 'Level 1 question must exist for problem-solving');
  usedIds.add(q1.id);

  // Student answers Q1 CORRECTLY
  const eval1 = evaluateResponse(q1, { choice: q1.answer });
  assert.equal(eval1.classification, 'CORRECT');

  const summaryAfterQ1 = computeSkillAdaptiveSummary({
    skill,
    items: [{ question: q1, response: { choice: q1.answer } }],
  });
  assert.equal(summaryAfterQ1.decisiveEvidenceReached, false, '1 answer is not decisive');

  // Next Question Selection
  const q2 = selectAdaptiveNextQuestion({
    skill,
    currentQuestion: q1,
    evalResult: eval1,
    usedQuestionIds: usedIds,
  });
  assert.ok(q2, 'Next question must be selected');
  assert.ok(q2.level > q1.level, `Next level ${q2.level} must be elevated above Level 1`);
  assert.equal(q2.level, 2, 'Next level should be elevated to Level 2');
  usedIds.add(q2.id);

  trajectoryLog.push({
    step: 1,
    answeredQuestion: { id: q1.id, level: q1.level, q: q1.q },
    answerGiven: 'CORRECT',
    nextSelectedQuestion: { id: q2.id, level: q2.level, q: q2.q },
    reasonForSelection: `Elevated from Level ${q1.level} to Level ${q2.level} due to verified mastery`,
    decisiveReached: false,
  });

  // Student answers Q2 CORRECTLY at Level 2
  const eval2 = evaluateResponse(q2, { choice: q2.answer });
  assert.equal(eval2.classification, 'CORRECT');

  const summaryAfterQ2 = computeSkillAdaptiveSummary({
    skill,
    items: [
      { question: q1, response: { choice: q1.answer } },
      { question: q2, response: { choice: q2.answer } },
    ],
  });

  // Decisive mastery criteria satisfied!
  assert.equal(summaryAfterQ2.decisiveEvidenceReached, true, '2 consecutive corrects at level >= 2 is decisive');
  assert.ok(summaryAfterQ2.proficiency >= 80, 'Proficiency indicates mastery');

  trajectoryLog.push({
    step: 2,
    answeredQuestion: { id: q2.id, level: q2.level, q: q2.q },
    answerGiven: 'CORRECT',
    nextSelectedQuestion: null,
    reasonForSelection: 'Assessment complete: Decisive mastery criteria satisfied',
    stoppingDecision: 'Decisive evidence criteria satisfied: 2 consecutive correct answers at level >= 2',
    decisiveReached: true,
    totalQuestions: 2,
  });

  console.log('\n[TRAJECTORY 1 — MASTERY PATH LOG]', JSON.stringify(trajectoryLog, null, 2));
  assert.equal(trajectoryLog.length, 2);
  assert.equal(trajectoryLog[1].totalQuestions, 2);
});

test('Adaptive Assessment — Trajectory 2: Demonstrates Struggle with Diagnostic Step-Down', () => {
  const trajectoryLog: any[] = [];
  const skill = 'problem-solving';
  const usedIds = new Set<string>();

  // 1. Initial Question: Starts at Level 1
  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1);
  assert.ok(q1, 'Level 1 question must exist for problem-solving');
  usedIds.add(q1.id);

  // Student answers Q1 INCORRECTLY (picks wrong option)
  const wrongChoice = (q1.answer + 1) % q1.options.length;
  const eval1 = evaluateResponse(q1, { choice: wrongChoice });
  assert.equal(eval1.classification, 'INCORRECT');
  assert.ok(eval1.misconceptionIdentified, 'Misconception identified');

  const summaryAfterQ1 = computeSkillAdaptiveSummary({
    skill,
    items: [{ question: q1, response: { choice: wrongChoice } }],
  });
  assert.equal(summaryAfterQ1.decisiveEvidenceReached, false, '1 answer is not decisive');

  // Next Question Selection
  const q2 = selectAdaptiveNextQuestion({
    skill,
    currentQuestion: q1,
    evalResult: eval1,
    usedQuestionIds: usedIds,
  });
  assert.ok(q2, 'Next diagnostic question must be selected');
  assert.ok(q2.level < q1.level, `Diagnostic level ${q2.level} must be stepped down below Level 1`);
  assert.equal(q2.level, 0, 'Level stepped down to 0 for diagnostic isolation');
  usedIds.add(q2.id);

  trajectoryLog.push({
    step: 1,
    answeredQuestion: { id: q1.id, level: q1.level, q: q1.q },
    answerGiven: 'INCORRECT',
    misconception: eval1.misconceptionIdentified,
    nextSelectedQuestion: { id: q2.id, level: q2.level, q: q2.q },
    reasonForSelection: `Stepped down from Level ${q1.level} to Level ${q2.level} diagnostic to isolate foundational concept`,
    decisiveReached: false,
  });

  // Student answers Q2 INCORRECTLY
  const wrongChoice2 = (q2.answer + 1) % q2.options.length;
  const eval2 = evaluateResponse(q2, { choice: wrongChoice2 });
  assert.equal(eval2.classification, 'INCORRECT');

  const summaryAfterQ2 = computeSkillAdaptiveSummary({
    skill,
    items: [
      { question: q1, response: { choice: wrongChoice } },
      { question: q2, response: { choice: wrongChoice2 } },
    ],
  });

  // Decisive struggle boundary reached!
  assert.equal(summaryAfterQ2.decisiveEvidenceReached, true, '2 consecutive struggles establish decisive baseline boundary');
  assert.ok(summaryAfterQ2.proficiency < 40, 'Low proficiency confirmed');
  assert.ok(summaryAfterQ2.misconceptions.length > 0, 'Misconceptions recorded for foundational learning');

  trajectoryLog.push({
    step: 2,
    answeredQuestion: { id: q2.id, level: q2.level, q: q2.q },
    answerGiven: 'INCORRECT',
    nextSelectedQuestion: null,
    reasonForSelection: 'Assessment complete: Decisive foundational boundary identified',
    stoppingDecision: 'Decisive evidence criteria satisfied: 2 consecutive struggles isolate skill gap',
    decisiveReached: true,
    totalQuestions: 2,
  });

  console.log('\n[TRAJECTORY 2 — STRUGGLE / DIAGNOSTIC LOG]', JSON.stringify(trajectoryLog, null, 2));
  assert.equal(trajectoryLog.length, 2);
  assert.equal(trajectoryLog[1].totalQuestions, 2);
});

test('Adaptive Assessment — Trajectory 3: Inconsistent Answers Lead to Extended Resolving Questions', () => {
  const trajectoryLog: any[] = [];
  const skill = 'problem-solving';
  const usedIds = new Set<string>();

  // Q1: Level 1 -> Correct
  const q1 = QUESTIONS.find((q) => q.skill === skill && q.level === 1)!;
  usedIds.add(q1.id);
  const eval1 = evaluateResponse(q1, { choice: q1.answer });

  // Q2: Level 2 -> Incorrect (Struggle at higher level)
  const q2 = selectAdaptiveNextQuestion({ skill, currentQuestion: q1, evalResult: eval1, usedQuestionIds: usedIds })!;
  usedIds.add(q2.id);
  const eval2 = evaluateResponse(q2, { choice: (q2.answer + 1) % q2.options.length });

  // Summary after 2 questions: 1 correct, 1 incorrect -> NOT DECISIVE!
  const summary2 = computeSkillAdaptiveSummary({
    skill,
    items: [
      { question: q1, response: { choice: q1.answer } },
      { question: q2, response: { choice: (q2.answer + 1) % q2.options.length } },
    ],
  });
  assert.equal(summary2.decisiveEvidenceReached, false, 'Inconsistent performance requires more questions');

  // Engine must select Q3 to resolve uncertainty
  const q3 = selectAdaptiveNextQuestion({ skill, currentQuestion: q2, evalResult: eval2, usedQuestionIds: usedIds })!;
  assert.ok(q3, 'Q3 must be selected');
  usedIds.add(q3.id);

  trajectoryLog.push({
    step: 'Q1 -> Q2 -> Q3',
    q1: { level: q1.level, result: 'CORRECT' },
    q2: { level: q2.level, result: 'INCORRECT' },
    q3: { level: q3.level, action: 'Resolving uncertainty with question 3' },
    summary2Decisive: summary2.decisiveEvidenceReached,
  });

  console.log('\n[TRAJECTORY 3 — RESOLVING LOG]', JSON.stringify(trajectoryLog, null, 2));
  assert.ok(usedIds.size >= 3, 'Learner received 3 or more distinct questions');
});
