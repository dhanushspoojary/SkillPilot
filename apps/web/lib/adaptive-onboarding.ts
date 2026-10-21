import { getActiveLLMProvider, sanitizePII, redactSecrets, type LLMMessage } from './llm-provider.ts';
import { SKILLS, QUESTIONS } from './questions.ts';
import type { Question } from './types.ts';
import { tx, one } from './db.ts';
import { saveStudentCapabilityProfile, getStudentCapabilityProfile } from './capability-profile.ts';
import { transitionWorkflowStage } from './workflow.ts';

export type EvaluationCorrectness = 'correct' | 'partial' | 'incorrect' | 'uncertain';
export type QuestionType = 'conceptual' | 'practical' | 'debugging';

export interface EvaluationResult {
  summary: string;
  correctness: EvaluationCorrectness;
  misconceptions: string[];
}

export interface NextQuestionData {
  text: string;
  skill_id: string;
  difficulty: number;
  question_type: QuestionType;
  options: string[] | null;
}

export interface AdaptiveLLMOutput {
  evaluation: EvaluationResult;
  next_question: NextQuestionData | null;
  assessment_complete: boolean;
  completion_reason: string | null;
}

export interface OnboardingTurnHistory {
  questionNumber: number;
  questionText: string;
  skillId: string;
  difficulty: number;
  questionType: QuestionType;
  studentAnswer: string;
  evaluation: EvaluationResult;
  provenance: 'llm' | 'deterministic';
}

export interface AdaptiveOnboardingState {
  sessionId: string;
  userId: string;
  targetRole: string;
  currentQuestion: NextQuestionData;
  history: OnboardingTurnHistory[];
  questionCount: number;
  minQuestions: number;
  maxQuestions: number;
  isComplete: boolean;
  completionReason?: string;
  assessedStrengths: string[];
  assessedGaps: string[];
  uncertainties: string[];
  scores: Record<string, number>;
  provenance: 'llm' | 'deterministic';
  createdAt: string;
  updatedAt: string;
}

export const MIN_ONBOARDING_QUESTIONS = 3;
export const MAX_ONBOARDING_QUESTIONS = 6;
export const KNOWN_SKILL_IDS = SKILLS.map((s) => s.id);

/**
 * Strict Runtime Schema Validator for LLM Adaptive Output.
 * Ensures the model conforms exactly to the output contract and never trusts
 * model-generated scores, unvalidated identifiers, or unbounded difficulty values.
 */
export function validateAdaptiveOutput(
  raw: unknown,
  knownSkills: string[] = KNOWN_SKILL_IDS
): { valid: boolean; data?: AdaptiveLLMOutput; error?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Output must be a JSON object' };
  }

  const obj = raw as Record<string, unknown>;

  // 1. Validate evaluation
  if (!obj.evaluation || typeof obj.evaluation !== 'object' || Array.isArray(obj.evaluation)) {
    return { valid: false, error: 'evaluation object is required' };
  }

  const evalObj = obj.evaluation as Record<string, unknown>;
  const summary = typeof evalObj.summary === 'string' ? evalObj.summary.trim() : '';
  if (!summary) {
    return { valid: false, error: 'evaluation.summary must be a non-empty string' };
  }

  const rawCorrectness = typeof evalObj.correctness === 'string' ? evalObj.correctness.toLowerCase().trim() : '';
  const validCorrectness: EvaluationCorrectness[] = ['correct', 'partial', 'incorrect', 'uncertain'];
  if (!validCorrectness.includes(rawCorrectness as EvaluationCorrectness)) {
    return { valid: false, error: `evaluation.correctness must be one of: ${validCorrectness.join(', ')}` };
  }
  const correctness = rawCorrectness as EvaluationCorrectness;

  const rawMisconceptions = Array.isArray(evalObj.misconceptions) ? evalObj.misconceptions : [];
  const misconceptions = rawMisconceptions
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .map((m) => m.trim());

  // 2. Validate assessment_complete
  const assessment_complete = Boolean(obj.assessment_complete);

  // 3. Validate completion_reason vs next_question
  if (assessment_complete) {
    const rawReason = typeof obj.completion_reason === 'string' ? obj.completion_reason.trim() : '';
    if (!rawReason) {
      return { valid: false, error: 'completion_reason is required when assessment_complete is true' };
    }
    if (obj.next_question !== null && obj.next_question !== undefined) {
      return { valid: false, error: 'next_question must be null when assessment_complete is true' };
    }

    return {
      valid: true,
      data: {
        evaluation: { summary, correctness, misconceptions },
        next_question: null,
        assessment_complete: true,
        completion_reason: rawReason,
      },
    };
  }

  // assessment_complete is false: next_question is required
  if (!obj.next_question || typeof obj.next_question !== 'object' || Array.isArray(obj.next_question)) {
    return { valid: false, error: 'next_question object is required when assessment_complete is false' };
  }

  const qObj = obj.next_question as Record<string, unknown>;
  const text = typeof qObj.text === 'string' ? qObj.text.trim() : '';
  if (text.length < 5) {
    return { valid: false, error: 'next_question.text must be a descriptive question (at least 5 chars)' };
  }

  const rawSkillId = typeof qObj.skill_id === 'string' ? qObj.skill_id.toLowerCase().trim() : '';
  // Check against known skills
  const matchedSkill = knownSkills.find((s) => s.toLowerCase() === rawSkillId);
  if (!matchedSkill) {
    return {
      valid: false,
      error: `next_question.skill_id '${rawSkillId}' is not in known skills [${knownSkills.join(', ')}]`,
    };
  }

  const rawDifficulty = Number(qObj.difficulty);
  if (isNaN(rawDifficulty) || rawDifficulty < 0 || rawDifficulty > 5) {
    return { valid: false, error: 'next_question.difficulty must be an integer between 0 and 5' };
  }
  const difficulty = Math.round(rawDifficulty);

  const rawType = typeof qObj.question_type === 'string' ? qObj.question_type.toLowerCase().trim() : '';
  const validTypes: QuestionType[] = ['conceptual', 'practical', 'debugging'];
  const question_type: QuestionType = validTypes.includes(rawType as QuestionType)
    ? (rawType as QuestionType)
    : 'conceptual';

  let options: string[] | null = null;
  if (Array.isArray(qObj.options)) {
    options = qObj.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0);
    if (options.length < 2) options = null;
  }

  return {
    valid: true,
    data: {
      evaluation: { summary, correctness, misconceptions },
      next_question: {
        text,
        skill_id: matchedSkill,
        difficulty,
        question_type,
        options,
      },
      assessment_complete: false,
      completion_reason: null,
    },
  };
}

/**
 * Deterministic Initial Question for an Onboarding Diagnostic.
 */
export function getInitialOnboardingQuestion(targetRole: string = 'Software Engineer'): NextQuestionData {
  return {
    text: `In software development, explain what happens to local variables inside a function when that function finishes executing and returns. What is the execution stack's role?`,
    skill_id: 'problem-solving',
    difficulty: 1,
    question_type: 'conceptual',
    options: null,
  };
}

/**
 * Deterministic Fallback Generator.
 * Used whenever LLM is unavailable, rate-limited, timed out, or generates malformed output.
 */
export function generateDeterministicAdaptiveTurn(params: {
  targetRole: string;
  history: OnboardingTurnHistory[];
  lastAnswer: string;
  currentQuestion?: NextQuestionData;
}): AdaptiveLLMOutput {
  const { history, lastAnswer, currentQuestion } = params;
  const activeQ = currentQuestion || (history.length > 0 ? history[history.length - 1] : getInitialOnboardingQuestion(params.targetRole));

  // Heuristic evaluation of student's text answer
  const answerLower = (lastAnswer || '').toLowerCase().trim();
  const isStruggle =
    !answerLower ||
    answerLower === 'skip' ||
    answerLower === 'pass' ||
    answerLower.includes('do not know') ||
    answerLower.includes("don't know") ||
    answerLower.includes('not sure') ||
    answerLower.includes('never coded') ||
    answerLower.includes('no idea');

  let correctness: EvaluationCorrectness = 'uncertain';
  let summary = 'Evaluation recorded. Assessing next technical competency.';
  let misconceptions: string[] = [];

  if (isStruggle) {
    correctness = 'incorrect';
    summary = 'Question skipped or concept unfamiliar. Routing to foundational diagnostic probe.';
    misconceptions = ['Foundational concept unfamiliar or skipped; foundation marked for reinforcement'];
  } else if (
    (answerLower.includes('pop') || answerLower.includes('deallocated') || answerLower.includes('freed') || (answerLower.includes('stack') && answerLower.includes('frame'))) ||
    (answerLower.includes('set') || answerLower.includes('hash') || answerLower.includes('o(n)')) ||
    (answerLower.includes('429') || answerLower.includes('backoff') || answerLower.includes('retry'))
  ) {
    correctness = 'correct';
    summary = 'Strong explanation identifying core state transitions, data structures, and edge cases.';
  } else if (answerLower.length >= 15 && !answerLower.includes('not')) {
    correctness = 'partial';
    summary = 'Partial understanding demonstrated; exploring application depth.';
  } else {
    correctness = 'incorrect';
    summary = 'Incomplete explanation; diagnosing foundational concepts.';
    misconceptions = ['Struggle explaining memory scope or algorithmic transitions'];
  }

  // Question count including this turn
  const currentQNumber = history.length + 1;
  const currentDiff = activeQ ? activeQ.difficulty : 1;
  const currentSkill = activeQ ? ('skill_id' in activeQ ? activeQ.skill_id : (activeQ as OnboardingTurnHistory).skillId) : 'problem-solving';

  // Check server-side stopping conditions:
  // Requires at least MIN_ONBOARDING_QUESTIONS
  if (currentQNumber >= MIN_ONBOARDING_QUESTIONS) {
    const prevTurn = history[history.length - 1];
    const prevCorrectness = prevTurn?.evaluation?.correctness;

    if (currentQNumber >= MAX_ONBOARDING_QUESTIONS) {
      return {
        evaluation: { summary, correctness, misconceptions },
        next_question: null,
        assessment_complete: true,
        completion_reason: 'Maximum assessment question budget reached; comprehensive capability profile synthesized.',
      };
    }

    if (correctness === 'correct' && prevCorrectness === 'correct' && currentDiff >= 2) {
      return {
        evaluation: { summary, correctness, misconceptions },
        next_question: null,
        assessment_complete: true,
        completion_reason: 'Decisive technical mastery demonstrated across multiple consecutive levels.',
      };
    }

    if (correctness === 'incorrect' && prevCorrectness === 'incorrect' && currentDiff <= 1) {
      return {
        evaluation: { summary, correctness, misconceptions },
        next_question: null,
        assessment_complete: true,
        completion_reason: 'Foundational baseline boundaries decisively mapped.',
      };
    }
  }

  // Generate next question
  let nextDifficulty = currentDiff;
  let nextSkill = currentSkill;
  let nextType: QuestionType = 'conceptual';
  let nextText = '';

  if (correctness === 'correct') {
    // Elevate difficulty
    nextDifficulty = Math.min(5, currentDiff + 1);
    nextType = nextDifficulty >= 3 ? 'debugging' : 'practical';
    if (nextSkill === 'problem-solving' && nextDifficulty >= 2) {
      nextSkill = 'javascript';
      nextText = `Given an array of integers, how would you detect whether any number appears more than once in O(n) time and O(n) space in JavaScript?`;
    } else if (nextSkill === 'javascript' && nextDifficulty >= 3) {
      nextSkill = 'rest-apis';
      nextText = `In an asynchronous REST service, how do you handle rate-limiting errors (HTTP 429) gracefully on the client without crashing or causing request storms?`;
    } else {
      nextText = `Describe how you would structure an immutable state update in an application with multiple concurrent actions.`;
    }
  } else if (correctness === 'incorrect') {
    // Step down to diagnostic
    nextDifficulty = Math.max(0, currentDiff - 1);
    nextType = 'conceptual';
    nextSkill = 'problem-solving';
    nextText = `What is the difference between an assignment statement (like x = 5) and an equality check (like x == 5)? Why do off-by-one errors often occur in while loops?`;
  } else {
    // Inconsistent / partial / uncertain: probe clarifying depth
    nextText = `Can you provide a short code snippet or step-by-step trace illustrating your answer to the previous question?`;
    nextType = 'practical';
  }

  return {
    evaluation: { summary, correctness, misconceptions },
    next_question: {
      text: nextText,
      skill_id: nextSkill,
      difficulty: nextDifficulty,
      question_type: nextType,
      options: null,
    },
    assessment_complete: false,
    completion_reason: null,
  };
}

/**
 * Call the configured LLM provider to evaluate student answer and generate next adaptive question.
 */
export async function generateAdaptiveLLMTurn(params: {
  targetRole: string;
  history: OnboardingTurnHistory[];
  lastAnswer: string;
}): Promise<{ output: AdaptiveLLMOutput; provenance: 'llm' | 'deterministic' }> {
  const { targetRole, history, lastAnswer } = params;
  const { provider, isReal } = getActiveLLMProvider();

  if (!provider || !isReal) {
    return {
      output: generateDeterministicAdaptiveTurn(params),
      provenance: 'deterministic',
    };
  }

  const lastTurn = history[history.length - 1];
  const questionNumber = history.length;
  const remainingBudget = MAX_ONBOARDING_QUESTIONS - questionNumber;

  const systemPrompt = `You are SkillPilot's expert technical diagnostic interviewer.
Your task is to conduct an adaptive technical baseline assessment for a learner aiming to become a "${targetRole}".

CRITICAL INSTRUCTIONS:
1. One Question at a Time: Do not generate full quizzes. Evaluate the student's answer and produce the single next question.
2. Truly Adaptive:
   - If the student answers correctly with solid reasoning, elevate difficulty (+1) or ask a practical/debugging question in an applied skill.
   - If the student struggles, gives an incorrect answer, or skips, step down difficulty (-1) to diagnose missing prerequisite concepts.
   - If the answer is partial or ambiguous, ask a clarifying diagnostic question.
3. Skill Validation: Valid skills are ONLY: ${KNOWN_SKILL_IDS.join(', ')}.
4. Question Count Limits:
   - Current question number being evaluated: ${questionNumber}.
   - Minimum questions before assessment can complete: ${MIN_ONBOARDING_QUESTIONS}.
   - Maximum questions allowed: ${MAX_ONBOARDING_QUESTIONS}.
   - NEVER set "assessment_complete": true if question number is less than ${MIN_ONBOARDING_QUESTIONS}.
   - Set "assessment_complete": true if you have collected decisive evidence (2 consecutive strong answers at difficulty >= 2, or 2 consecutive struggles at foundation), OR if remaining budget is 0.
   - When assessment_complete is true: next_question MUST be null, and completion_reason MUST be provided.
5. Response Format: You MUST reply with valid JSON ONLY. No markdown wrappers, no conversational filler, no backticks.

STRICT JSON SCHEMA:
{
  "evaluation": {
    "summary": "Brief learner-facing feedback (1-2 sentences)",
    "correctness": "correct | partial | incorrect | uncertain",
    "misconceptions": ["array of validated misconception labels, if any"]
  },
  "next_question": {
    "text": "The next question text",
    "skill_id": "validated skill identifier from list",
    "difficulty": 1,
    "question_type": "conceptual | practical | debugging",
    "options": null
  },
  "assessment_complete": false,
  "completion_reason": null
}`;

  const userPrompt = `TARGET ROLE: ${targetRole}
HISTORY:
${JSON.stringify(
  history.map((h) => ({
    qNum: h.questionNumber,
    skill: h.skillId,
    diff: h.difficulty,
    question: h.questionText,
    answer: sanitizePII(h.studentAnswer),
    eval: h.evaluation.correctness,
  })),
  null,
  2
)}

LATEST ANSWER TO EVALUATE:
Question was: "${lastTurn ? lastTurn.questionText : 'Initial'}" (Skill: ${lastTurn ? lastTurn.skillId : 'problem-solving'}, Difficulty: ${lastTurn ? lastTurn.difficulty : 1})
Student Answer: "${sanitizePII(lastAnswer)}"
Remaining Question Budget: ${remainingBudget}

Evaluate this answer and determine the next adaptive step. Return JSON only:`;

  try {
    const responseText = await provider.generateText(userPrompt, {
      systemPrompt,
      temperature: 0.2,
      maxTokens: 1000,
      timeoutMs: 12000,
    });

    // Clean JSON text of any stray markdown code fences
    const cleanText = responseText.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    const validation = validateAdaptiveOutput(parsed, KNOWN_SKILL_IDS);
    if (!validation.valid || !validation.data) {
      console.warn('Adaptive LLM output failed schema validation:', validation.error, cleanText);
      return {
        output: generateDeterministicAdaptiveTurn(params),
        provenance: 'deterministic',
      };
    }

    // Server-side enforcement of stopping safety rules:
    const validatedData = validation.data;

    // Rule 1: Never complete before MIN_ONBOARDING_QUESTIONS
    if (questionNumber < MIN_ONBOARDING_QUESTIONS && validatedData.assessment_complete) {
      const fallback = generateDeterministicAdaptiveTurn(params);
      validatedData.assessment_complete = false;
      validatedData.completion_reason = null;
      validatedData.next_question = fallback.next_question;
    }

    // Rule 2: Force completion if at or exceeding MAX_ONBOARDING_QUESTIONS
    if (questionNumber >= MAX_ONBOARDING_QUESTIONS) {
      validatedData.assessment_complete = true;
      validatedData.next_question = null;
      validatedData.completion_reason =
        validatedData.completion_reason || 'Maximum assessment question budget reached; baseline synthesized.';
    }

    return {
      output: validatedData,
      provenance: 'llm',
    };
  } catch (err) {
    console.warn('Adaptive LLM call failed or timed out; falling back to deterministic engine:', err);
    return {
      output: generateDeterministicAdaptiveTurn(params),
      provenance: 'deterministic',
    };
  }
}

/**
 * Server-side Authoritative Session Management & Persistence.
 */
export async function startAdaptiveOnboardingSession(params: {
  userId: string;
  targetRole?: string;
}): Promise<AdaptiveOnboardingState> {
  const { userId, targetRole = 'Software Engineer' } = params;

  return await tx(async (client) => {
    // Advisory lock to serialize concurrent starts
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`onboarding-start:${userId}`]);

    // Check for existing active assessment
    const active = await client.query<{ id: string; target_role?: string; started_at: string }>(
      `select id, started_at from assessments where user_id = $1 and kind = 'onboarding_adaptive' and status = 'started' order by started_at desc limit 1`,
      [userId]
    );

    if (active.rowCount && active.rows[0]) {
      const aid = active.rows[0].id;
      const items = await client.query<{
        id: string;
        question_id: string;
        skill_slug: string;
        prompt: string | Record<string, unknown>;
        response: string | Record<string, unknown> | null;
        score: number | null;
        position: number;
      }>(
        `select id, question_id, skill_slug, prompt, response, score, position
         from assessment_items where assessment_id = $1 order by position asc`,
        [aid]
      );

      // Reconstruct history
      const history: OnboardingTurnHistory[] = [];
      let lastPrompt: NextQuestionData | null = null;

      for (const item of items.rows) {
        const promptObj = typeof item.prompt === 'string' ? JSON.parse(item.prompt) : item.prompt;
        if (item.response) {
          const respObj = typeof item.response === 'string' ? JSON.parse(item.response) : item.response;
          history.push({
            questionNumber: item.position,
            questionText: promptObj.text || promptObj.q || '',
            skillId: item.skill_slug,
            difficulty: Number(promptObj.difficulty ?? 1),
            questionType: (promptObj.question_type as QuestionType) || 'conceptual',
            studentAnswer: respObj.answer || '',
            evaluation: respObj.evaluation || {
              summary: 'Recorded',
              correctness: 'correct',
              misconceptions: [],
            },
            provenance: respObj.provenance || 'deterministic',
          });
        } else {
          lastPrompt = {
            text: promptObj.text || promptObj.q || '',
            skill_id: item.skill_slug,
            difficulty: Number(promptObj.difficulty ?? 1),
            question_type: (promptObj.question_type as QuestionType) || 'conceptual',
            options: promptObj.options || null,
          };
        }
      }

      if (lastPrompt) {
        return {
          sessionId: aid,
          userId,
          targetRole,
          currentQuestion: lastPrompt,
          history,
          questionCount: history.length,
          minQuestions: MIN_ONBOARDING_QUESTIONS,
          maxQuestions: MAX_ONBOARDING_QUESTIONS,
          isComplete: false,
          assessedStrengths: [],
          assessedGaps: [],
          uncertainties: [],
          scores: {},
          provenance: 'deterministic',
          createdAt: active.rows[0].started_at,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    // Create fresh assessment session
    const firstQ = getInitialOnboardingQuestion(targetRole);
    const newAss = await client.query<{ id: string; started_at: string }>(
      `insert into assessments (user_id, kind, version, status) values ($1, 'onboarding_adaptive', 'v2.1', 'started') returning id, started_at`,
      [userId]
    );
    const aid = newAss.rows[0].id;

    await client.query(
      `insert into assessment_items (assessment_id, question_id, skill_slug, prompt, position) values ($1, $2, $3, $4, $5)`,
      [aid, `onboarding-q-1`, firstQ.skill_id, JSON.stringify(firstQ), 1]
    );

    return {
      sessionId: aid,
      userId,
      targetRole,
      currentQuestion: firstQ,
      history: [],
      questionCount: 0,
      minQuestions: MIN_ONBOARDING_QUESTIONS,
      maxQuestions: MAX_ONBOARDING_QUESTIONS,
      isComplete: false,
      assessedStrengths: [],
      assessedGaps: [],
      uncertainties: [],
      scores: {},
      provenance: 'deterministic',
      createdAt: newAss.rows[0].started_at,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Submit an answer to the active onboarding question, evaluate with LLM / fallback,
 * persist authoritative state, and advance or complete the assessment.
 */
export async function submitAdaptiveOnboardingAnswer(params: {
  sessionId: string;
  userId: string;
  answer: string;
  targetRole?: string;
}): Promise<AdaptiveOnboardingState> {
  const { sessionId, userId, answer, targetRole = 'Software Engineer' } = params;

  return await tx(async (client) => {
    // Lock assessment record and verify ownership
    const assRow = await client.query<{
      id: string;
      user_id: string;
      status: string;
      started_at: string;
    }>(`select id, user_id, status, started_at from assessments where id = $1 and user_id = $2 for update`, [
      sessionId,
      userId,
    ]);

    if (!assRow.rowCount || !assRow.rows[0]) {
      throw new Error('Assessment session not found or unauthorized');
    }

    if (assRow.rows[0].status === 'completed') {
      throw new Error('Assessment is already completed');
    }

    // Retrieve existing items
    const items = await client.query<{
      id: string;
      question_id: string;
      skill_slug: string;
      prompt: string | Record<string, unknown>;
      response: string | Record<string, unknown> | null;
      position: number;
    }>(
      `select id, question_id, skill_slug, prompt, response, position from assessment_items where assessment_id = $1 order by position asc`,
      [sessionId]
    );

    const history: OnboardingTurnHistory[] = [];
    let pendingItem: typeof items.rows[0] | null = null;

    for (const item of items.rows) {
      const promptObj = typeof item.prompt === 'string' ? JSON.parse(item.prompt) : item.prompt;
      if (item.response) {
        const respObj = typeof item.response === 'string' ? JSON.parse(item.response) : item.response;
        history.push({
          questionNumber: item.position,
          questionText: promptObj.text || promptObj.q || '',
          skillId: item.skill_slug,
          difficulty: Number(promptObj.difficulty ?? 1),
          questionType: (promptObj.question_type as QuestionType) || 'conceptual',
          studentAnswer: respObj.answer || '',
          evaluation: respObj.evaluation || {
            summary: 'Recorded',
            correctness: 'correct',
            misconceptions: [],
          },
          provenance: respObj.provenance || 'deterministic',
        });
      } else {
        pendingItem = item;
      }
    }

    if (!pendingItem) {
      throw new Error('No pending unanswered question found for this assessment');
    }

    const currentPromptObj =
      typeof pendingItem.prompt === 'string' ? JSON.parse(pendingItem.prompt) : pendingItem.prompt;

    const currentQuestionData: NextQuestionData = {
      text: currentPromptObj.text || currentPromptObj.q || '',
      skill_id: pendingItem.skill_slug,
      difficulty: Number(currentPromptObj.difficulty ?? 1),
      question_type: (currentPromptObj.question_type as QuestionType) || 'conceptual',
      options: currentPromptObj.options || null,
    };

    // Add current turn to history for evaluation
    const evalInputHistory = [...history, {
      questionNumber: pendingItem.position,
      questionText: currentQuestionData.text,
      skillId: currentQuestionData.skill_id,
      difficulty: currentQuestionData.difficulty,
      questionType: currentQuestionData.question_type,
      studentAnswer: answer,
      evaluation: { summary: '', correctness: 'uncertain' as EvaluationCorrectness, misconceptions: [] },
      provenance: 'deterministic' as const,
    }];

    // Generate adaptive evaluation and next question
    const { output, provenance } = await generateAdaptiveLLMTurn({
      targetRole,
      history: evalInputHistory,
      lastAnswer: answer,
    });

    // Authoritative score calculation for this item
    const earnedPoints =
      output.evaluation.correctness === 'correct'
        ? 100
        : output.evaluation.correctness === 'partial'
        ? 60
        : output.evaluation.correctness === 'uncertain'
        ? 40
        : 10;

    // Save student response to assessment_items
    await client.query(
      `update assessment_items set response = $1, score = $2 where id = $3`,
      [
        JSON.stringify({
          answer,
          evaluation: output.evaluation,
          provenance,
        }),
        earnedPoints,
        pendingItem.id,
      ]
    );

    // Update history with evaluated turn
    history.push({
      questionNumber: pendingItem.position,
      questionText: currentQuestionData.text,
      skillId: currentQuestionData.skill_id,
      difficulty: currentQuestionData.difficulty,
      questionType: currentQuestionData.question_type,
      studentAnswer: answer,
      evaluation: output.evaluation,
      provenance,
    });

    const isComplete = output.assessment_complete || history.length >= MAX_ONBOARDING_QUESTIONS;

    if (isComplete) {
      // Complete the assessment session
      // Compute skill proficiencies and baseline
      const skillGroups = new Map<string, number[]>();
      for (const h of history) {
        const list = skillGroups.get(h.skillId) || [];
        const pts =
          h.evaluation.correctness === 'correct'
            ? 100
            : h.evaluation.correctness === 'partial'
            ? 60
            : h.evaluation.correctness === 'uncertain'
            ? 40
            : 10;
        list.push(pts);
        skillGroups.set(h.skillId, list);
      }

      const scores: Record<string, number> = {};
      const assessedStrengths: string[] = [];
      const assessedGaps: string[] = [];
      const uncertainties: string[] = [];

      for (const [sId, ptsList] of skillGroups.entries()) {
        const avg = Math.round(ptsList.reduce((a, b) => a + b, 0) / ptsList.length);
        scores[sId] = avg;

        if (avg >= 70) {
          assessedStrengths.push(sId);
        } else if (avg <= 40) {
          assessedGaps.push(sId);
        } else {
          uncertainties.push(sId);
        }
      }

      const overall =
        Object.values(scores).length > 0
          ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length)
          : 50;

      // Mark assessment completed
      await client.query(
        `update assessments set status = 'completed', completed_at = now(), server_score = $1 where id = $2`,
        [overall, sessionId]
      );

      // Insert authentic verified evidence into user_skill_evidence (append-only)
      for (const [sId, score] of Object.entries(scores)) {
        // Find skill uuid in skills table
        const skillRow = await client.query<{ id: string }>(`select id from skills where slug = $1`, [sId]);
        if (skillRow.rowCount && skillRow.rows[0]) {
          await client.query(
            `insert into user_skill_evidence (user_id, skill_id, score, confidence, source, captured_at)
             values ($1, $2, $3, $4, 'assessment', now())`,
            [userId, skillRow.rows[0].id, score, 0.75]
          );
        }
      }

      // Update capability profile
      await saveStudentCapabilityProfile(userId, {
        onboardingCompleted: true,
        skillsKnown: assessedStrengths,
        focusAreas: assessedGaps.length > 0 ? assessedGaps : ['Problem Solving'],
      });

      // Transition workflow stage to SKILL_BASELINE_REVIEW
      await transitionWorkflowStage(userId, 'SKILL_BASELINE_REVIEW');

      return {
        sessionId,
        userId,
        targetRole,
        currentQuestion: {
          text: '',
          skill_id: '',
          difficulty: 0,
          question_type: 'conceptual',
          options: null,
        },
        history,
        questionCount: history.length,
        minQuestions: MIN_ONBOARDING_QUESTIONS,
        maxQuestions: MAX_ONBOARDING_QUESTIONS,
        isComplete: true,
        completionReason:
          output.completion_reason ||
          'Adaptive diagnostic complete. Skill baseline recorded in evidence ledger.',
        assessedStrengths,
        assessedGaps,
        uncertainties,
        scores,
        provenance,
        createdAt: assRow.rows[0].started_at,
        updatedAt: new Date().toISOString(),
      };
    }

    // Assessment is NOT complete: insert next question into assessment_items
    const nextQ = output.next_question!;
    const nextPosition = history.length + 1;

    await client.query(
      `insert into assessment_items (assessment_id, question_id, skill_slug, prompt, position)
       values ($1, $2, $3, $4, $5)`,
      [sessionId, `onboarding-q-${nextPosition}`, nextQ.skill_id, JSON.stringify(nextQ), nextPosition]
    );

    return {
      sessionId,
      userId,
      targetRole,
      currentQuestion: nextQ,
      history,
      questionCount: history.length,
      minQuestions: MIN_ONBOARDING_QUESTIONS,
      maxQuestions: MAX_ONBOARDING_QUESTIONS,
      isComplete: false,
      assessedStrengths: [],
      assessedGaps: [],
      uncertainties: [],
      scores: {},
      provenance,
      createdAt: assRow.rows[0].started_at,
      updatedAt: new Date().toISOString(),
    };
  });
}
