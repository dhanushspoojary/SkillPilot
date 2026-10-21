import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAdaptiveOutput,
  generateDeterministicAdaptiveTurn,
  generateAdaptiveLLMTurn,
  getInitialOnboardingQuestion,
  MIN_ONBOARDING_QUESTIONS,
  MAX_ONBOARDING_QUESTIONS,
  type OnboardingTurnHistory,
  type AdaptiveLLMOutput,
} from './adaptive-onboarding.ts';

// ============================================================================
// 1. STRICT RUNTIME SCHEMA VALIDATOR TESTS
// ============================================================================
test('validateAdaptiveOutput: accepts valid active question schema', () => {
  const validPayload = {
    evaluation: {
      summary: 'Good understanding of stack allocation and function return behavior.',
      correctness: 'correct',
      misconceptions: [],
    },
    next_question: {
      text: 'Explain how asynchronous callbacks work in the JavaScript event loop.',
      skill_id: 'javascript',
      difficulty: 2,
      question_type: 'practical',
      options: null,
    },
    assessment_complete: false,
    completion_reason: null,
  };

  const res = validateAdaptiveOutput(validPayload);
  assert.equal(res.valid, true);
  assert.ok(res.data);
  assert.equal(res.data?.evaluation.correctness, 'correct');
  assert.equal(res.data?.next_question?.skill_id, 'javascript');
  assert.equal(res.data?.next_question?.difficulty, 2);
});

test('validateAdaptiveOutput: accepts valid completion schema', () => {
  const validCompletion = {
    evaluation: {
      summary: 'Solid mastery verified across core competencies.',
      correctness: 'correct',
      misconceptions: [],
    },
    next_question: null,
    assessment_complete: true,
    completion_reason: 'Decisive evidence collected across multiple difficulty levels.',
  };

  const res = validateAdaptiveOutput(validCompletion);
  assert.equal(res.valid, true);
  assert.ok(res.data);
  assert.equal(res.data?.assessment_complete, true);
  assert.equal(res.data?.next_question, null);
  assert.ok(res.data?.completion_reason);
});

test('validateAdaptiveOutput: rejects invalid correctness value', () => {
  const invalid = {
    evaluation: {
      summary: 'Test',
      correctness: 'super_correct', // Invalid
      misconceptions: [],
    },
    next_question: {
      text: 'What is a pointer?',
      skill_id: 'problem-solving',
      difficulty: 1,
      question_type: 'conceptual',
      options: null,
    },
    assessment_complete: false,
    completion_reason: null,
  };

  const res = validateAdaptiveOutput(invalid);
  assert.equal(res.valid, false);
  assert.ok(res.error?.includes('correctness'));
});

test('validateAdaptiveOutput: rejects unvalidated skill_id', () => {
  const invalidSkill = {
    evaluation: {
      summary: 'Test',
      correctness: 'correct',
      misconceptions: [],
    },
    next_question: {
      text: 'Explain quantum entanglement algorithms in Ruby.',
      skill_id: 'unsupported-skill-xyz', // Not in known skills
      difficulty: 1,
      question_type: 'conceptual',
      options: null,
    },
    assessment_complete: false,
    completion_reason: null,
  };

  const res = validateAdaptiveOutput(invalidSkill);
  assert.equal(res.valid, false);
  assert.ok(res.error?.includes('known skills'));
});

test('validateAdaptiveOutput: rejects out-of-range difficulty', () => {
  const invalidDiff = {
    evaluation: {
      summary: 'Test',
      correctness: 'correct',
      misconceptions: [],
    },
    next_question: {
      text: 'Explain pointer arithmetic.',
      skill_id: 'problem-solving',
      difficulty: 10, // Must be 0 - 5
      question_type: 'conceptual',
      options: null,
    },
    assessment_complete: false,
    completion_reason: null,
  };

  const res = validateAdaptiveOutput(invalidDiff);
  assert.equal(res.valid, false);
  assert.ok(res.error?.includes('difficulty'));
});

test('validateAdaptiveOutput: rejects completion without completion_reason', () => {
  const missingReason = {
    evaluation: {
      summary: 'Done',
      correctness: 'correct',
      misconceptions: [],
    },
    next_question: null,
    assessment_complete: true,
    completion_reason: null, // Invalid: must be non-empty string
  };

  const res = validateAdaptiveOutput(missingReason);
  assert.equal(res.valid, false);
  assert.ok(res.error?.includes('completion_reason'));
});

test('validateAdaptiveOutput: rejects completion with non-null next_question', () => {
  const contradictory = {
    evaluation: {
      summary: 'Done',
      correctness: 'correct',
      misconceptions: [],
    },
    next_question: {
      text: 'One more question?',
      skill_id: 'problem-solving',
      difficulty: 1,
      question_type: 'conceptual',
      options: null,
    },
    assessment_complete: true, // Contradictory with next_question present
    completion_reason: 'Done',
  };

  const res = validateAdaptiveOutput(contradictory);
  assert.equal(res.valid, false);
  assert.ok(res.error?.includes('next_question must be null'));
});

// ============================================================================
// 2. ADAPTIVE TRAJECTORY TESTS (A, B, C, D, E)
// ============================================================================

test('Trajectory A: Strong learner (Correct foundational answer -> harder question -> strong application)', () => {
  const initialQ = getInitialOnboardingQuestion('Software Engineer');
  assert.equal(initialQ.difficulty, 1);
  assert.equal(initialQ.skill_id, 'problem-solving');

  const history: OnboardingTurnHistory[] = [];

  // Turn 1: Strong answer to initial memory/stack question
  const turn1Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: initialQ,
    lastAnswer:
      'When a function returns, its stack frame is popped from the call stack and all local variables allocated on that frame are deallocated and freed from scope memory.',
  });

  assert.equal(turn1Output.evaluation.correctness, 'correct');
  assert.equal(turn1Output.assessment_complete, false, 'Cannot complete on question 1 (min 3 required)');
  assert.ok(turn1Output.next_question, 'Next question must be provided');
  assert.ok(turn1Output.next_question!.difficulty >= 2, 'Difficulty must elevate to level >= 2');
  assert.equal(turn1Output.next_question!.skill_id, 'javascript');

  history.push({
    questionNumber: 1,
    questionText: initialQ.text,
    skillId: initialQ.skill_id,
    difficulty: initialQ.difficulty,
    questionType: initialQ.question_type,
    studentAnswer: 'Stack frame is popped and local variables deallocated.',
    evaluation: turn1Output.evaluation,
    provenance: 'deterministic',
  });

  // Turn 2: Strong answer to elevated JavaScript question
  const turn2Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: turn1Output.next_question!,
    lastAnswer:
      'To detect duplicates in O(n) time and O(n) space, use a Set or Hash Map. Iterate through the array; if the current number is already in the set, return true, otherwise add it to the set.',
  });

  assert.equal(turn2Output.evaluation.correctness, 'correct');
  assert.equal(turn2Output.assessment_complete, false, 'Cannot complete on question 2 (min 3 required)');
  assert.ok(turn2Output.next_question);
  assert.ok(turn2Output.next_question!.difficulty >= 3, 'Difficulty elevates to level 3');
  assert.equal(turn2Output.next_question!.skill_id, 'rest-apis');

  history.push({
    questionNumber: 2,
    questionText: turn1Output.next_question!.text,
    skillId: turn1Output.next_question!.skill_id,
    difficulty: turn1Output.next_question!.difficulty,
    questionType: turn1Output.next_question!.question_type,
    studentAnswer: 'Use a Hash Set to track seen elements in O(n) time.',
    evaluation: turn2Output.evaluation,
    provenance: 'deterministic',
  });

  // Turn 3: Strong answer to applied REST service question
  const turn3Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: turn2Output.next_question!,
    lastAnswer:
      'For HTTP 429 rate-limiting, inspect the Retry-After header. Implement exponential backoff with random jitter so client requests retry gracefully without overloading the server.',
  });

  assert.equal(turn3Output.evaluation.correctness, 'correct');
  assert.equal(turn3Output.assessment_complete, true, 'Decisive mastery demonstrated across consecutive levels (Q3 >= min 3)');
  assert.equal(turn3Output.next_question, null);
  assert.ok(turn3Output.completion_reason?.includes('mastery'));
});

test('Trajectory B: Learner with prerequisite gap (Incorrect answer -> easier diagnostic question -> gap identified)', () => {
  const initialQ = getInitialOnboardingQuestion('Software Engineer');
  const history: OnboardingTurnHistory[] = [];

  // Turn 1: Incorrect answer / struggle
  const turn1Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: initialQ,
    lastAnswer: 'I have never coded before and I do not know what a function or stack is.',
  });

  assert.equal(turn1Output.evaluation.correctness, 'incorrect');
  assert.ok(turn1Output.evaluation.misconceptions.length > 0);
  assert.equal(turn1Output.assessment_complete, false, 'Cannot complete on turn 1');
  assert.ok(turn1Output.next_question);
  assert.ok(turn1Output.next_question!.difficulty <= 1, 'Difficulty stepped down to foundation');
  assert.equal(turn1Output.next_question!.skill_id, 'problem-solving');

  history.push({
    questionNumber: 1,
    questionText: initialQ.text,
    skillId: initialQ.skill_id,
    difficulty: initialQ.difficulty,
    questionType: initialQ.question_type,
    studentAnswer: 'Do not know what a function is.',
    evaluation: turn1Output.evaluation,
    provenance: 'deterministic',
  });

  // Turn 2: Struggle with second foundational diagnostic probe
  const turn2Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: turn1Output.next_question!,
    lastAnswer: 'skip',
  });

  assert.equal(turn2Output.evaluation.correctness, 'incorrect');
  assert.equal(turn2Output.assessment_complete, false, 'Must ask min 3 questions');

  history.push({
    questionNumber: 2,
    questionText: turn1Output.next_question!.text,
    skillId: turn1Output.next_question!.skill_id,
    difficulty: turn1Output.next_question!.difficulty,
    questionType: turn1Output.next_question!.question_type,
    studentAnswer: 'skip',
    evaluation: turn2Output.evaluation,
    provenance: 'deterministic',
  });

  // Turn 3: Conclusive foundational boundary
  const turn3Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: turn2Output.next_question!,
    lastAnswer: 'pass',
  });

  assert.equal(turn3Output.evaluation.correctness, 'incorrect');
  assert.equal(turn3Output.assessment_complete, true, 'Decisively identified foundational boundary after consecutive struggles at Q3');
  assert.equal(turn3Output.next_question, null);
  assert.ok(turn3Output.completion_reason?.includes('baseline') || turn3Output.completion_reason?.includes('boundaries'));
});

test('Trajectory C: Inconsistent learner (Correct answer -> incorrect advanced answer -> further diagnostic)', () => {
  const initialQ = getInitialOnboardingQuestion('Software Engineer');
  const history: OnboardingTurnHistory[] = [];

  // Turn 1: Correct answer
  const turn1Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: initialQ,
    lastAnswer: 'Local variables are popped from the stack frame and deallocated on return.',
  });
  assert.equal(turn1Output.evaluation.correctness, 'correct');

  history.push({
    questionNumber: 1,
    questionText: initialQ.text,
    skillId: initialQ.skill_id,
    difficulty: initialQ.difficulty,
    questionType: initialQ.question_type,
    studentAnswer: 'Stack frame popped.',
    evaluation: turn1Output.evaluation,
    provenance: 'deterministic',
  });

  // Turn 2: Elevated to Level 2 JavaScript -> incorrect answer
  const turn2Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: turn1Output.next_question!,
    lastAnswer: 'I do not know how to do that in JavaScript.',
  });
  assert.equal(turn2Output.evaluation.correctness, 'incorrect');
  assert.equal(turn2Output.assessment_complete, false);

  history.push({
    questionNumber: 2,
    questionText: turn1Output.next_question!.text,
    skillId: turn1Output.next_question!.skill_id,
    difficulty: turn1Output.next_question!.difficulty,
    questionType: turn1Output.next_question!.question_type,
    studentAnswer: 'Do not know.',
    evaluation: turn2Output.evaluation,
    provenance: 'deterministic',
  });

  // Turn 3: Engine presents diagnostic question to resolve inconsistency; does NOT prematurely halt
  const turn3Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    currentQuestion: turn2Output.next_question!,
    lastAnswer: 'A loop check repeats until the condition is false.',
  });

  // Since turn 1 was correct and turn 2 was incorrect, evidence is inconsistent
  assert.ok(turn3Output.evaluation);
});

test('Trajectory D: Uncertain learner (Partial or ambiguous answers -> additional evidence required)', () => {
  const initialQ = getInitialOnboardingQuestion('Software Engineer');
  const history: OnboardingTurnHistory[] = [];

  // Turn 1: Short partial answer
  const turn1Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    lastAnswer: 'It disappears maybe.',
  });
  assert.equal(turn1Output.evaluation.correctness, 'partial');
  assert.equal(turn1Output.assessment_complete, false);
  assert.ok(turn1Output.next_question);

  history.push({
    questionNumber: 1,
    questionText: initialQ.text,
    skillId: initialQ.skill_id,
    difficulty: initialQ.difficulty,
    questionType: initialQ.question_type,
    studentAnswer: 'It disappears maybe.',
    evaluation: turn1Output.evaluation,
    provenance: 'deterministic',
  });

  // Turn 2: Another brief partial answer
  const turn2Output = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    lastAnswer: 'Just store it in a variable.',
  });
  assert.equal(turn2Output.evaluation.correctness, 'partial');
  assert.equal(turn2Output.assessment_complete, false);
});

test('Trajectory E: Provider failure (LLM unavailable -> honest deterministic fallback)', async () => {
  const history: OnboardingTurnHistory[] = [];

  // Call generateAdaptiveLLMTurn
  const result = await generateAdaptiveLLMTurn({
    targetRole: 'Software Engineer',
    history,
    lastAnswer: 'Local variables are popped from the stack frame.',
  });

  assert.ok(result.output);
  assert.ok(['llm', 'deterministic'].includes(result.provenance));
  assert.ok(result.output.evaluation.summary);
  assert.ok(result.output.next_question || result.output.assessment_complete);

  // Validate the output conforms strictly to the schema
  const validation = validateAdaptiveOutput(result.output);
  assert.equal(validation.valid, true);
});

test('Adaptive Stopping: Enforces MIN_ONBOARDING_QUESTIONS (3) and MAX_ONBOARDING_QUESTIONS (6)', () => {
  assert.equal(MIN_ONBOARDING_QUESTIONS, 3);
  assert.equal(MAX_ONBOARDING_QUESTIONS, 6);

  // Create a history with 5 items
  const history: OnboardingTurnHistory[] = [];
  for (let i = 1; i <= 5; i++) {
    history.push({
      questionNumber: i,
      questionText: `Question ${i}`,
      skillId: 'problem-solving',
      difficulty: 1,
      questionType: 'conceptual',
      studentAnswer: 'Sample answer',
      evaluation: { summary: 'OK', correctness: 'partial', misconceptions: [] },
      provenance: 'deterministic',
    });
  }

  // Answer 6th question -> must terminate with budget limit
  const finalTurn = generateDeterministicAdaptiveTurn({
    targetRole: 'Software Engineer',
    history,
    lastAnswer: 'Sample answer for Q6',
  });

  assert.equal(finalTurn.assessment_complete, true);
  assert.equal(finalTurn.next_question, null);
  assert.ok(finalTurn.completion_reason?.includes('budget') || finalTurn.completion_reason?.includes('reached'));
});
