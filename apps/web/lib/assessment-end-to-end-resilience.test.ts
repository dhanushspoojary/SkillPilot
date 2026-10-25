import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAssessmentQuestion,
  canonicalizeQuestion,
  generateQuestionId,
} from './question-contract.ts';
import {
  evaluateResponse,
  computeSkillAdaptiveSummary,
  selectAdaptiveNextQuestion,
} from './adaptive-engine.ts';
import {
  planAssessmentSession,
  calculateJustifiedLevel,
} from './assessment-planner.ts';
import { determineNextAction } from './next-action-engine.ts';
import { QUESTIONS } from './questions.ts';

describe('SkillPilot Autonomous End-to-End Resilience & AI Assessment', () => {
  it('recovers questions missing top-level id using authoritative question_id fallback', () => {
    // Exact scenario from the reported error:
    // JSON prompt saved without id, but question_id exists in assessment_items row
    const malformedPrompt = {
      skill_slug: 'sql',
      level: 2,
      q: 'Which clause filters rows before aggregation in SQL?',
      options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'],
      answer: 0,
      why: 'WHERE filters rows before aggregation; HAVING filters after.',
    };

    // Without fallback, raw prompt was missing id:
    const rawRes = validateAssessmentQuestion(malformedPrompt);
    assert.equal(rawRes.valid, false);
    assert.match(rawRes.error, /missing a valid identifier/i);

    // With authoritative DB fallback question_id:
    const canonical = canonicalizeQuestion(malformedPrompt, 'authoritative-sql-q2', 'sql');
    assert.ok(canonical, 'Expected question to be successfully canonicalized');
    assert.equal(canonical.id, 'authoritative-sql-q2');
    assert.equal(canonical.skill, 'sql');
    assert.equal(canonical.level, 2);
    assert.equal(canonical.type, 'multiple_choice');
    assert.equal(canonical.options?.length, 4);
  });

  it('normalizes legacy field aliases (text, skill_id, difficulty) into canonical question contract', () => {
    const legacyTurn = {
      question_id: 'legacy-turn-42',
      skill_id: 'problem-solving',
      difficulty: 1,
      text: 'Explain the difference between a stack and a queue data structure.',
      question_type: 'conceptual',
      options: null,
    };

    const canonical = canonicalizeQuestion(legacyTurn);
    assert.ok(canonical);
    assert.equal(canonical.id, 'legacy-turn-42');
    assert.equal(canonical.skill, 'problem-solving');
    assert.equal(canonical.level, 1);
    assert.equal(canonical.q, 'Explain the difference between a stack and a queue data structure.');
    assert.equal(canonical.type, 'conceptual');
    assert.equal(canonical.options, null);
  });

  it('generates distinct, non-identical question IDs across LLM generation cycles', () => {
    const id1 = generateQuestionId('problem-solving', 2, 'llm-q');
    const id2 = generateQuestionId('problem-solving', 2, 'llm-q');

    assert.ok(id1.startsWith('llm-q-problem-solving-l2-'));
    assert.ok(id2.startsWith('llm-q-problem-solving-l2-'));
    assert.notEqual(id1, id2, 'Question IDs must be globally unique across generation cycles');
  });

  it('calibrates initial assessment plan differently for beginners vs experienced students', () => {
    // Profile 1: Complete beginner
    const beginnerPlan = planAssessmentSession({
      userId: 'student-beginner',
      profile: {
        programmingExperience: 'beginner',
        educationLevel: 'first_year',
        careerInterests: ['Frontend Engineer'],
      },
      evidence: [],
    });

    assert.deepEqual(beginnerPlan.skillsToAssess, ['problem-solving']);
    assert.equal(beginnerPlan.initialQuestions[0].skill, 'problem-solving');
    assert.equal(beginnerPlan.initialQuestions[0].level, 1);

    // Profile 2: Experienced student with projects
    const experiencedPlan = planAssessmentSession({
      userId: 'student-experienced',
      profile: {
        programmingExperience: 'built_projects',
        educationLevel: 'third_year',
        careerInterests: ['Frontend Engineer'],
        focusAreas: ['JavaScript'],
      },
      evidence: [],
    });

    assert.ok(
      experiencedPlan.skillsToAssess.includes('javascript'),
      'Experienced student aiming for frontend must be assessed in JavaScript'
    );
    const justifiedJsLevel = calculateJustifiedLevel('javascript', [], false);
    assert.equal(justifiedJsLevel, 2, 'Experienced student starts at justified level 2');
  });

  it('adaptive difficulty adjusts based on actual response evidence', () => {
    const q1 = QUESTIONS.find((q) => q.skill === 'problem-solving' && q.level === 1)!;
    assert.ok(q1);

    // 1. Correct answer elevates difficulty
    const correctEval = evaluateResponse(q1, { choice: q1.answer });
    assert.equal(correctEval.classification, 'CORRECT');
    assert.equal(correctEval.earnedPoints, 100);

    const elevatedQ = selectAdaptiveNextQuestion({
      skill: 'problem-solving',
      currentQuestion: q1,
      evalResult: correctEval,
      usedQuestionIds: new Set([q1.id]),
    });
    assert.ok(elevatedQ);
    assert.ok(elevatedQ.level >= q1.level, 'Elevated question must be >= current level');

    // 2. Incorrect answer steps down to diagnostic
    const incorrectEval = evaluateResponse(q1, { choice: (q1.answer + 1) % 4 });
    assert.equal(incorrectEval.classification, 'INCORRECT');
    assert.equal(incorrectEval.earnedPoints, 0);

    const diagnosticQ = selectAdaptiveNextQuestion({
      skill: 'problem-solving',
      currentQuestion: q1,
      evalResult: incorrectEval,
      usedQuestionIds: new Set([q1.id]),
    });
    assert.ok(diagnosticQ);
    assert.ok(diagnosticQ.level <= q1.level, 'Diagnostic question must be <= current level');
  });

  it('adaptive stopping rules terminate when decisive evidence criteria are satisfied', () => {
    const qLevel2 = {
      id: 'q-mastery-1',
      skill: 'problem-solving',
      level: 2,
      q: 'Mastery Q1',
      options: ['A', 'B', 'C', 'D'],
      answer: 0,
      why: 'Correct',
    };
    const qLevel3 = {
      id: 'q-mastery-2',
      skill: 'problem-solving',
      level: 3,
      q: 'Mastery Q2',
      options: ['A', 'B', 'C', 'D'],
      answer: 1,
      why: 'Correct',
    };

    // 2 consecutive correct answers at level >= 2
    const summary = computeSkillAdaptiveSummary({
      skill: 'problem-solving',
      items: [
        { question: qLevel2, response: { choice: 0 } },
        { question: qLevel3, response: { choice: 1 } },
      ],
    });

    assert.equal(summary.decisiveEvidenceReached, true);
    assert.ok(summary.proficiency >= 80);
    assert.ok(summary.confidence >= 0.7);
  });

  it('next-action engine reliably detects in-progress assessments with status "started"', async () => {
    const nextAction = await determineNextAction('user-test-active', {
      profile: {
        onboardingCompleted: true,
        primaryFocusSkill: 'problem-solving',
      },
      activeAssessment: {
        id: 'active-session-uuid',
        started_at: new Date(Date.now() - 5 * 60000).toISOString(),
      },
      evidenceCount: 0,
    });

    assert.equal(nextAction.type, 'ASSESSMENT');
    assert.equal(nextAction.route, 'assess');
    assert.equal(nextAction.buttonLabel, 'Resume Assessment');
    assert.match(nextAction.title, /Resume Your Adaptive Diagnostic/i);
  });
});
