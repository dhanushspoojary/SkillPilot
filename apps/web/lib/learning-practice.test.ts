import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS_CATALOG, getLessonById, getLessonsForSkill } from './lessons-catalog.ts';
import {
  computeQuestionFingerprint,
  validateQuestionSchema,
  generateTemplatedProblem,
  generateContinuousPracticeQuestion,
  submitExerciseAttempt,
} from './practice-engine.ts';
import { determineNextAction } from './next-action-engine.ts';

describe('Continuous AI Learning & Lessons Catalog', () => {
  it('loads catalog with required core tracks (Problem Solving, C, JS, SQL)', () => {
    assert.ok(LESSONS_CATALOG.length >= 4, 'Catalog should contain at least 4 comprehensive lessons');
    
    const skills = new Set(LESSONS_CATALOG.map((l) => l.skillSlug));
    assert.ok(skills.has('problem-solving'), 'Should include problem-solving/loops');
    assert.ok(skills.has('c-systems'), 'Should include C systems');
    assert.ok(skills.has('javascript'), 'Should include JavaScript');
    assert.ok(skills.has('sql'), 'Should include SQL databases');
  });

  it('validates lesson structural completeness (whyItMatters, walkthroughs, pitfalls, exercises)', () => {
    for (const lesson of LESSONS_CATALOG) {
      assert.ok(lesson.title.length > 5, `${lesson.id} should have a descriptive title`);
      assert.ok(lesson.whyItMatters.length > 15, `${lesson.id} should explain why it matters`);
      assert.ok(lesson.prerequisites.length > 0, `${lesson.id} should declare prerequisites`);
      assert.ok(lesson.keyDefinitions.length >= 2, `${lesson.id} should have key definitions`);
      assert.ok(lesson.codeWalkthrough || (lesson.walkthroughSteps && lesson.walkthroughSteps.length >= 2), `${lesson.id} should have code walkthrough steps`);
      assert.ok(lesson.commonPitfalls.length >= 2, `${lesson.id} should have common pitfalls`);
      assert.ok(lesson.exercises.length >= 2, `${lesson.id} should have interactive practice exercises`);

      // Check exercises
      for (const ex of lesson.exercises) {
        assert.ok(ex.prompt.length > 10, `${ex.id} must have a prompt`);
        assert.equal(ex.choices.length, 4, `${ex.id} must have exactly 4 choices`);
        assert.ok(ex.correctIndex >= 0 && ex.correctIndex <= 3, `${ex.id} correctIndex must be 0-3`);
        assert.ok(ex.hints.length >= 2, `${ex.id} must offer progressive hints`);
      }
    }
  });

  it('retrieves lesson by ID and returns undefined for unknown ID', () => {
    const l = getLessonById('ps-loop-tracing');
    assert.ok(l, 'Should find ps-loop-tracing');
    assert.equal(l?.id, 'ps-loop-tracing');

    const unknown = getLessonById('non-existent-lesson-id');
    assert.equal(unknown, undefined);
  });

  it('retrieves lessons filtered by skill slug', () => {
    const cLessons = getLessonsForSkill('c-systems');
    assert.ok(cLessons.length >= 1);
    assert.equal(cLessons[0].skillSlug, 'c-systems');
  });
});

describe('Continuous Practice Engine & Question Generation', () => {
  it('generates deterministic duplicate-detection fingerprints', () => {
    const fp1 = computeQuestionFingerprint('What is x after loop?', ['10', '20', '30', '40']);
    const fp2 = computeQuestionFingerprint('what is x after loop?   ', ['40', '30', '20', '10']);
    const fp3 = computeQuestionFingerprint('Different question?', ['10', '20', '30', '40']);

    assert.equal(fp1, fp2, 'Fingerprints should match regardless of whitespace and choice ordering');
    assert.notEqual(fp1, fp3, 'Fingerprints should differ for different prompts');
  });

  it('validates question schemas strictly', () => {
    const valid = {
      prompt: 'What does this pointer operation do in C?',
      choices: ['Dereferences pointer', 'Allocates stack', 'Causes UB', 'Frees memory'],
      correctIndex: 0,
      hints: ['Look at the asterisk operator', 'Think about memory addressing'],
      explanation: 'The * operator dereferences the address held by the pointer variable.',
    };
    assert.equal(validateQuestionSchema(valid), true);

    const invalidShortPrompt = { ...valid, prompt: 'Short' };
    assert.equal(validateQuestionSchema(invalidShortPrompt), false);

    const invalidChoices = { ...valid, choices: ['A', 'B'] };
    assert.equal(validateQuestionSchema(invalidChoices), false);

    const invalidIndex = { ...valid, correctIndex: 5 };
    assert.equal(validateQuestionSchema(invalidIndex), false);
  });

  it('generates algorithmic problem templates with varied inputs', () => {
    const p1 = generateTemplatedProblem('loop_tracing', 'problem-solving');
    assert.ok(p1.id.startsWith('tmpl-loop-'));
    assert.equal(p1.choices.length, 4);
    assert.ok(p1.prompt.includes('total'));
    assert.ok(p1.codeSnippet?.includes('for (int i ='));
    assert.ok(p1.correctIndex >= 0 && p1.correctIndex <= 3);
  });

  it('falls back to vetted template when LLM provider is inactive', async () => {
    const q = await generateContinuousPracticeQuestion('c-systems', 'c_pointers_basics', 'foundational');
    assert.ok(q);
    assert.equal(q.choices.length, 4);
    assert.ok(q.hints.length >= 1);
  });
});

describe('Socratic Feedback & Mastery-Based Progression', () => {
  it('evaluates incorrect answer with Socratic explanation without revealing answer', async () => {
    const testUserId = `test-user-incorrect-${Date.now()}`;
    const result = await submitExerciseAttempt({
      userId: testUserId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 1, // Wrong answer ('6', correct is index 0: '4')
      hintsUsed: 0,
    });

    assert.equal(result.isCorrect, false);
    assert.equal(result.chosenIndex, 1);
    assert.equal(result.correctIndex, 0);
    assert.ok(result.feedback.includes('incorrect') || result.feedback.includes('Not quite'));
    assert.equal(result.conceptMastery.level, 'novice');
    assert.equal(result.lessonProgress.isLessonCompleted, false);
  });

  it('evaluates correct answer and awards full credit when solved without hints', async () => {
    const testUserId = `test-user-correct-${Date.now()}`;
    const result = await submitExerciseAttempt({
      userId: testUserId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 0, // Correct answer
      hintsUsed: 0,
    });

    assert.equal(result.isCorrect, true);
    assert.ok(result.feedback.includes('Outstanding') || result.feedback.includes('zero hints'));
    assert.equal(result.conceptMastery.level, 'practicing');
    assert.equal(result.conceptMastery.score, 35);
  });

  it('applies hint penalty so solving with hints awards reduced mastery credit', async () => {
    const testUserId = `test-user-hints-${Date.now()}`;
    const result = await submitExerciseAttempt({
      userId: testUserId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 0, // Correct answer
      hintsUsed: 2,
    });

    assert.equal(result.isCorrect, true);
    assert.ok(result.feedback.includes('2 hints'));
    // Score with hints is 20 instead of 35
    assert.equal(result.conceptMastery.score, 20);
  });

  it('requires multiple distinct unassisted problems solved to earn "mastered" status', async () => {
    const testUserId = `test-mastery-${Date.now()}`;

    // Attempt 1: correct with 0 hints (+35 -> score 35, solved 1)
    const r1 = await submitExerciseAttempt({
      userId: testUserId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 0,
      hintsUsed: 0,
    });
    assert.equal(r1.conceptMastery.level, 'practicing');

    // Attempt 2: correct with 0 hints on same concept (+35 -> score 70, solved 2)
    const r2 = await submitExerciseAttempt({
      userId: testUserId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 0,
      hintsUsed: 0,
    });
    assert.equal(r2.conceptMastery.level, 'proficient');

    // Attempt 3: correct with 0 hints on same concept (+35 -> score 100, solved 3)
    const r3 = await submitExerciseAttempt({
      userId: testUserId,
      lessonId: 'ps-loop-tracing',
      exerciseId: 'ps-trace-q1',
      chosenIndex: 0,
      hintsUsed: 0,
    });
    assert.equal(r3.conceptMastery.level, 'mastered');
  });
});

describe('Automated Next-Action Engine', () => {
  it('determines the next recommended action with plain-language explanation', async () => {
    const testUserId = `test-na-${Date.now()}`;
    const nextAction = await determineNextAction(testUserId);

    assert.ok(nextAction.id);
    assert.ok(nextAction.title);
    assert.ok(nextAction.whatYouWillLearn);
    assert.ok(nextAction.whyItMatters);
    assert.ok(nextAction.whatToKnowBefore);
    assert.ok(nextAction.completionRequires);
    assert.ok(nextAction.route);
    assert.ok(nextAction.buttonLabel);
    assert.ok(nextAction.explanation);
    assert.ok(typeof nextAction.estimatedMinutes === 'number');
  });
});
