/**
 * Question Contract and Runtime Validation for SkillPilot Assessments.
 *
 * Implements strict discriminated unions for question types and comprehensive
 * runtime validation at API, database, LLM, and client rendering boundaries.
 */

export type QuestionType =
  | 'multiple_choice'
  | 'conceptual'
  | 'code_tracing'
  | 'debugging'
  | 'practical';

export interface BaseQuestionData {
  id: string;
  skill: string;
  level: number;
  q: string; // question text
  why?: string;
  prerequisiteConcept?: string;
  misconceptions?: Record<number, string>;
}

export interface MultipleChoiceQuestion extends BaseQuestionData {
  type: 'multiple_choice';
  options: string[];
  answer?: number;
}

export interface OpenEndedQuestion extends BaseQuestionData {
  type: 'conceptual' | 'code_tracing' | 'debugging' | 'practical';
  options?: null;
  codeSnippet?: string;
  expectedOutput?: string;
  starterCode?: string;
  sampleSolution?: string;
  rubric?: string;
}

export type ValidatedAssessmentQuestion = MultipleChoiceQuestion | OpenEndedQuestion;

export type QuestionValidationResult =
  | {
      valid: true;
      question: ValidatedAssessmentQuestion;
    }
  | {
      valid: false;
      error: string;
      raw: unknown;
    };

/**
 * Validates any raw question payload received from API, database, or LLM.
 * Accepts optional fallbackId and fallbackSkill (such as from assessment_items table).
 * Guarantees that multiple-choice questions have non-null, non-empty options arrays (>= 2 strings),
 * and that other supported types use their appropriate contracts.
 */
export function validateAssessmentQuestion(
  raw: unknown,
  fallbackId?: string,
  fallbackSkill?: string,
): QuestionValidationResult {
  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      error: 'Question payload is null, undefined, or not an object',
      raw,
    };
  }

  const obj = raw as Record<string, unknown>;

  // Extract question ID with fallback support
  const id =
    typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : typeof obj.question_id === 'string' && obj.question_id.trim()
      ? obj.question_id.trim()
      : typeof obj.questionId === 'string' && obj.questionId.trim()
      ? obj.questionId.trim()
      : fallbackId && typeof fallbackId === 'string' && fallbackId.trim()
      ? fallbackId.trim()
      : '';

  if (!id) {
    return {
      valid: false,
      error: 'Question is missing a valid identifier (id or question_id)',
      raw,
    };
  }

  // Extract skill with fallback support
  const skill =
    typeof obj.skill === 'string' && obj.skill.trim()
      ? obj.skill.trim()
      : typeof obj.skill_slug === 'string' && obj.skill_slug.trim()
      ? obj.skill_slug.trim()
      : typeof obj.skill_id === 'string' && obj.skill_id.trim()
      ? obj.skill_id.trim()
      : typeof obj.skillSlug === 'string' && obj.skillSlug.trim()
      ? obj.skillSlug.trim()
      : fallbackSkill && typeof fallbackSkill === 'string' && fallbackSkill.trim()
      ? fallbackSkill.trim()
      : '';

  if (!skill) {
    return {
      valid: false,
      error: 'Question is missing a valid skill identifier (skill or skill_slug)',
      raw,
    };
  }

  // Extract question text
  const q =
    typeof obj.q === 'string' && obj.q.trim()
      ? obj.q.trim()
      : typeof obj.text === 'string' && obj.text.trim()
      ? obj.text.trim()
      : typeof obj.prompt === 'string' && obj.prompt.trim()
      ? obj.prompt.trim()
      : typeof obj.question === 'string' && obj.question.trim()
      ? obj.question.trim()
      : '';

  if (!q) {
    return {
      valid: false,
      error: 'Question is missing question prompt text (q, text, or prompt)',
      raw,
    };
  }

  // Extract level / difficulty
  const levelRaw = obj.level ?? obj.difficulty;
  const level =
    typeof levelRaw === 'number' && Number.isFinite(levelRaw)
      ? Math.max(0, Math.min(5, Math.round(levelRaw)))
      : 1;

  // Extract optional metadata
  const why = typeof obj.why === 'string' ? obj.why.trim() : undefined;
  const prerequisiteConcept =
    typeof obj.prerequisiteConcept === 'string' ? obj.prerequisiteConcept.trim() : undefined;
  const codeSnippet =
    typeof obj.codeSnippet === 'string'
      ? obj.codeSnippet
      : typeof obj.code === 'string'
      ? obj.code
      : undefined;
  const starterCode = typeof obj.starterCode === 'string' ? obj.starterCode : undefined;

  // Determine question type (defaults to multiple_choice if empty)
  const rawType =
    typeof obj.type === 'string'
      ? obj.type.toLowerCase().trim()
      : typeof obj.question_type === 'string'
      ? obj.question_type.toLowerCase().trim()
      : '';

  const supportedTypes = [
    '',
    'multiple_choice',
    'conceptual',
    'code_tracing',
    'debugging',
    'practical',
    'open_ended',
  ];

  if (rawType && !supportedTypes.includes(rawType)) {
    return {
      valid: false,
      error: `Unsupported question type: "${rawType}"`,
      raw,
    };
  }

  const isOpenEndedType =
    rawType === 'conceptual' ||
    rawType === 'code_tracing' ||
    rawType === 'debugging' ||
    rawType === 'practical' ||
    rawType === 'open_ended';

  const rawOptions = obj.options;
  const hasOptionsArray = Array.isArray(rawOptions);

  // If explicit open-ended question without options:
  if (isOpenEndedType && (rawOptions === null || rawOptions === undefined)) {
    return {
      valid: true,
      question: {
        type: rawType === 'open_ended' ? 'conceptual' : (rawType as 'conceptual' | 'code_tracing' | 'debugging' | 'practical'),
        id,
        skill,
        level,
        q,
        why,
        prerequisiteConcept,
        codeSnippet,
        starterCode,
        options: null,
      },
    };
  }

  // If options array is provided: validate as multiple-choice options
  if (hasOptionsArray) {
    if (rawOptions.length < 2) {
      return {
        valid: false,
        error: `Multiple choice question has insufficient options (${rawOptions.length}); minimum 2 required`,
        raw,
      };
    }

    const sanitizedOptions: string[] = [];
    for (let i = 0; i < rawOptions.length; i++) {
      const opt = rawOptions[i];
      if (typeof opt !== 'string' || opt.trim().length === 0) {
        return {
          valid: false,
          error: `Multiple choice option at index ${i} is invalid or empty`,
          raw,
        };
      }
      sanitizedOptions.push(opt.trim());
    }

    const answer =
      typeof obj.answer === 'number' && obj.answer >= 0 && obj.answer < sanitizedOptions.length
        ? obj.answer
        : undefined;

    return {
      valid: true,
      question: {
        type: 'multiple_choice',
        id,
        skill,
        level,
        q,
        options: sanitizedOptions,
        answer,
        why,
        prerequisiteConcept,
      },
    };
  }

  // Options was null or undefined or non-array
  if (rawOptions === null) {
    return {
      valid: false,
      error: 'Multiple choice question has options defined as null',
      raw,
    };
  }

  if (rawOptions === undefined) {
    return {
      valid: false,
      error: 'Multiple choice question is missing options array',
      raw,
    };
  }

  return {
    valid: false,
    error: `Question options is of type ${typeof rawOptions}; expected Array of strings`,
    raw,
  };
}

/**
 * Returns a canonicalized, fully validated question or null if invalid.
 */
export function canonicalizeQuestion(
  raw: unknown,
  fallbackId?: string,
  fallbackSkill?: string,
): ValidatedAssessmentQuestion | null {
  const result = validateAssessmentQuestion(raw, fallbackId, fallbackSkill);
  return result.valid ? result.question : null;
}

/**
 * Generates a stable, unique question identifier for LLM or dynamic questions.
 */
export function generateQuestionId(skill: string, level: number, prefix: string = 'q'): string {
  const normSkill = skill.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16);
  return `${prefix}-${normSkill}-l${level}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
