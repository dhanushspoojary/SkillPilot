import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractClaimedSkills,
  hasPrerequisiteMet,
  calculateJustifiedLevel,
  validateQuestionProposal,
  planAssessmentSession,
} from './assessment-planner.ts';
import type { Evidence } from './types.ts';

test('extractClaimedSkills: beginner defaults to problem-solving and never claims JS/SQL without declaration', () => {
  const claims = extractClaimedSkills({
    educationLevel: 'first_year',
    programmingExperience: 'beginner',
    focusAreas: ['Programming Fundamentals', 'Problem Solving'],
  });

  assert.equal(claims.isBeginner, true);
  assert.equal(claims.hasClaimed('problem-solving'), true);
  assert.equal(claims.hasClaimed('javascript'), false);
  assert.equal(claims.hasClaimed('sql'), false);
  assert.equal(claims.hasClaimed('rest-apis'), false);
});

test('extractClaimedSkills: student declaring frontend/web claims JavaScript', () => {
  const claims = extractClaimedSkills({
    educationLevel: '2nd_year',
    programmingExperience: 'small_programs',
    focusAreas: ['Web Development', 'JavaScript'],
  });

  assert.equal(claims.hasClaimed('javascript'), true);
  assert.equal(claims.hasClaimed('sql'), false);
});

test('validateQuestionProposal: rejects unclaimed skill', () => {
  const result = validateQuestionProposal(
    { skill: 'sql', level: 1 },
    {
      claimedSkills: ['problem-solving'],
      evidence: [],
      isExplicitSelection: false,
    }
  );

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'UNCLAIMED_SKILL');
  assert.match(result.reason, /unclaimed/i);
});

test('validateQuestionProposal: rejects question when prerequisite is missing', () => {
  const result = validateQuestionProposal(
    { skill: 'rest-apis', level: 1 },
    {
      claimedSkills: ['problem-solving', 'rest-apis'],
      evidence: [], // no JS evidence
      isExplicitSelection: true,
    }
  );

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'MISSING_PREREQUISITES');
  assert.equal(result.suggestedSkill, 'javascript');
});

test('validateQuestionProposal: rejects question when level exceeds justified capability', () => {
  const result = validateQuestionProposal(
    { skill: 'problem-solving', level: 3 },
    {
      claimedSkills: ['problem-solving'],
      evidence: [], // justified level is 1
      isBeginner: true,
    }
  );

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'LEVEL_TOO_HIGH');
  assert.equal(result.suggestedLevel, 1);
});

test('validateQuestionProposal: allows question when claimed, prereqs met, and level is justified', () => {
  const evidence: Evidence[] = [
    {
      id: 'e1',
      skill: 'javascript',
      kind: 'assessment',
      score: 75,
      confidence: 0.6,
      at: new Date().toISOString(),
      label: 'JS Diagnostic',
    },
    {
      id: 'e2',
      skill: 'problem-solving',
      kind: 'assessment',
      score: 80,
      confidence: 0.6,
      at: new Date().toISOString(),
      label: 'PS Diagnostic',
    },
  ];

  assert.equal(hasPrerequisiteMet('javascript', evidence), true);
  assert.equal(hasPrerequisiteMet('problem-solving', evidence), true);

  const result = validateQuestionProposal(
    { skill: 'rest-apis', level: 2 },
    {
      claimedSkills: ['problem-solving', 'javascript', 'rest-apis'],
      evidence,
      isExplicitSelection: true,
    }
  );

  assert.equal(result.allowed, true);
  assert.equal(result.code, 'OK');
});

test('planAssessmentSession: beginner plan contains only problem-solving questions, never JS or SQL', () => {
  const plan = planAssessmentSession({
    userId: 'u1',
    profile: {
      educationLevel: 'first_year',
      programmingExperience: 'beginner',
    },
    evidence: [],
  });

  assert.deepEqual(plan.skillsToAssess, ['problem-solving']);
  assert.equal(plan.initialQuestions.length, 1);
  assert.equal(plan.initialQuestions[0].skill, 'problem-solving');
  assert.notEqual(plan.initialQuestions[0].skill, 'javascript');
  assert.notEqual(plan.initialQuestions[0].skill, 'sql');
});

test('planAssessmentSession: requesting unearned focus diverts to missing prerequisite', () => {
  const plan = planAssessmentSession({
    userId: 'u2',
    focus: 'rest-apis',
    profile: {
      educationLevel: '2nd_year',
      programmingExperience: 'small_programs',
      focusAreas: ['Backend'],
    },
    evidence: [],
  });

  // Since javascript is missing, it diverts to javascript rather than crashing or blindly giving rest-apis
  assert.deepEqual(plan.skillsToAssess, ['javascript']);
  assert.equal(plan.initialQuestions[0].skill, 'javascript');
});
