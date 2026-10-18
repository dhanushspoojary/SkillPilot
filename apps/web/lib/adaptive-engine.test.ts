import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateResponse,
  selectAdaptiveNextQuestion,
  computeSkillAdaptiveSummary,
} from './adaptive-engine.ts';
import type { Question } from './types.ts';

const testQuestion: Question = {
  id: 'ps-q-sample',
  skill: 'problem-solving',
  level: 2,
  q: 'Sample problem solving question',
  options: ['Correct', 'Common Misconception', 'Wrong', 'Irrelevant'],
  answer: 0,
  why: 'Correct explanation',
  prerequisiteConcept: 'logic-tracing',
  misconceptions: {
    1: 'Confused 0-based indexing with 1-based indexing',
  },
};

test('evaluateResponse: correct response gives full points and verified concept', () => {
  const result = evaluateResponse(testQuestion, { choice: 0 });
  assert.equal(result.classification, 'CORRECT');
  assert.equal(result.earnedPoints, 100);
  assert.equal(result.isEvidence, true);
  assert.equal(result.verifiedConcept, 'logic-tracing');
});

test('evaluateResponse: incorrect response identifies specific misconception', () => {
  const result = evaluateResponse(testQuestion, { choice: 1 });
  assert.equal(result.classification, 'INCORRECT');
  assert.equal(result.earnedPoints, 0);
  assert.equal(result.isEvidence, true);
  assert.equal(result.misconceptionIdentified, 'Confused 0-based indexing with 1-based indexing');
});

test('evaluateResponse: skip does not penalize with failure score and flags concept for reinforcement', () => {
  const result = evaluateResponse(testQuestion, { action: 'skip' });
  assert.equal(result.classification, 'SKIPPED');
  assert.equal(result.isEvidence, false);
  assert.equal(result.conceptNeedingEvidence, 'logic-tracing');
});

test('selectAdaptiveNextQuestion: raises level on correct answer', () => {
  const next = selectAdaptiveNextQuestion({
    skill: 'problem-solving',
    currentQuestion: testQuestion, // level 2
    evalResult: {
      classification: 'CORRECT',
      earnedPoints: 100,
      weight: 1.5,
      isEvidence: true,
      explanation: '',
    },
    usedQuestionIds: new Set([testQuestion.id]),
  });

  assert.ok(next);
  assert.ok(next.level >= 2);
});

test('selectAdaptiveNextQuestion: simplifies and probes prerequisite on struggle', () => {
  const next = selectAdaptiveNextQuestion({
    skill: 'problem-solving',
    currentQuestion: testQuestion, // level 2
    evalResult: {
      classification: 'INCORRECT',
      earnedPoints: 0,
      weight: 1.5,
      isEvidence: true,
      explanation: '',
    },
    usedQuestionIds: new Set([testQuestion.id]),
  });

  assert.ok(next);
  assert.ok(next.level <= 2);
});

test('computeSkillAdaptiveSummary: aggregates proficiency, misconceptions, and confidence', () => {
  const summary = computeSkillAdaptiveSummary({
    skill: 'problem-solving',
    items: [
      {
        question: testQuestion,
        response: { choice: 1 }, // incorrect
      },
      {
        question: {
          id: 'ps-q-easy',
          skill: 'problem-solving',
          level: 1,
          q: 'Easy question',
          options: ['A', 'B'],
          answer: 0,
          why: '',
        },
        response: { choice: 0 }, // correct
      },
    ],
  });

  assert.equal(summary.skill, 'problem-solving');
  assert.ok(summary.proficiency > 0 && summary.proficiency < 100);
  assert.ok(summary.confidence >= 0.5);
  assert.ok(summary.misconceptions.includes('Confused 0-based indexing with 1-based indexing'));
});
