import type { Question, Evidence } from './types.ts';
import { QUESTIONS } from './questions.ts';
import { PREREQUISITES } from './assessment-planner.ts';

/**
 * Classification of student responses for adaptive assessment.
 * Only CORRECT, INCORRECT, and INCOMPLETE count as proficiency evidence.
 * SKIPPED and TECHNICAL_FAILURE never penalize the student with zero scores.
 */
export type ResponseClassification =
  | 'CORRECT'
  | 'INCORRECT'
  | 'INCOMPLETE'
  | 'AMBIGUOUS'
  | 'SKIPPED'
  | 'TECHNICAL_FAILURE';

export interface EvaluatedItemResult {
  classification: ResponseClassification;
  earnedPoints: number; // 0 to 100
  weight: number;
  isEvidence: boolean; // true if counts towards score/evidence
  misconceptionIdentified?: string;
  verifiedConcept?: string;
  conceptNeedingEvidence?: string;
  explanation: string;
}

export interface SkillAdaptiveSummary {
  skill: string;
  proficiency: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  verifiedConcepts: string[];
  conceptsNeedingEvidence: string[];
  misconceptions: string[];
  totalAsked: number;
  decisiveEvidenceReached: boolean;
  nextRecommendedLevel: number;
  nextAction: string;
}

/**
 * Evaluates an individual response against the question and its misconceptions.
 */
export function evaluateResponse(
  question: Question,
  response: { choice?: number; action?: 'skip' | 'dont_know' | 'clarify'; isTechnicalFailure?: boolean }
): EvaluatedItemResult {
  if (response.isTechnicalFailure) {
    return {
      classification: 'TECHNICAL_FAILURE',
      earnedPoints: 0,
      weight: 0,
      isEvidence: false,
      explanation: 'Technical or network timeout; this attempt is not counted as evidence.',
    };
  }

  if (response.action === 'skip' || response.action === 'dont_know' || response.choice === -1) {
    return {
      classification: 'SKIPPED',
      earnedPoints: 0,
      weight: 0,
      isEvidence: false,
      conceptNeedingEvidence: question.prerequisiteConcept || `${question.skill}-level-${question.level}`,
      explanation: 'Skipped without penalty. Concept marked for foundational reinforcement.',
    };
  }

  if (response.action === 'clarify') {
    return {
      classification: 'AMBIGUOUS',
      earnedPoints: 50,
      weight: 0.5,
      isEvidence: false,
      explanation: 'Clarification requested. Presenting simplified guidance.',
    };
  }

  const choice = response.choice;
  const isCorrect = choice === question.answer;

  if (isCorrect) {
    const concept = question.prerequisiteConcept || `${question.skill}-level-${question.level}-mastery`;
    return {
      classification: 'CORRECT',
      earnedPoints: 100,
      weight: 1.0 + (question.level * 0.25),
      isEvidence: true,
      verifiedConcept: concept,
      explanation: question.why,
    };
  }

  // Incorrect: check for specific misconception
  const misconception =
    (choice !== undefined && question.misconceptions?.[choice]) ||
    `Misconception in ${question.skill} Level ${question.level} core concepts`;

  return {
    classification: 'INCORRECT',
    earnedPoints: 0,
    weight: 1.0 + (question.level * 0.25),
    isEvidence: true,
    misconceptionIdentified: misconception,
    conceptNeedingEvidence: question.prerequisiteConcept || `${question.skill}-level-${question.level}`,
    explanation: question.why,
  };
}

/**
 * Selects the next adaptive question based on previous performance and struggles.
 * 
 * Rules:
 * - Simplify on struggle and probe missing prerequisite.
 * - Raise difficulty ONLY on evidence (CORRECT answer at current level).
 * - Stay on the same skill until evidence is decisive or question limit is reached.
 */
export function selectAdaptiveNextQuestion(params: {
  skill: string;
  currentQuestion?: Question;
  currentLevel?: number;
  evalResult?: EvaluatedItemResult;
  usedQuestionIds?: Set<string>;
  answeredIds?: string[];
}): Question | null {
  const { skill, currentQuestion, evalResult } = params;
  const usedQuestionIds = params.usedQuestionIds || new Set(params.answeredIds || []);
  const currentLevel = currentQuestion?.level ?? params.currentLevel ?? 1;

  let targetLevel: number = currentLevel;

  if (evalResult) {
    if (evalResult.classification === 'CORRECT') {
      // Raise difficulty only on positive evidence (up to level 5)
      targetLevel = Math.min(5, currentLevel + 1);
    } else if (evalResult.classification === 'INCORRECT') {
      // Simplify on struggle and step down to probe prerequisite
      targetLevel = Math.max(0, currentLevel - 1);
    } else {
      // Skipped / Ambiguous: present same or slightly simpler concept
      targetLevel = Math.max(0, currentLevel - 1);
    }
  }

  const skillQuestions = QUESTIONS.filter(
    (q) => q.skill === skill && !usedQuestionIds.has(q.id)
  );

  if (skillQuestions.length === 0) return null;

  // Try exact target level first
  const exactMatch = skillQuestions.find((q) => q.level === targetLevel);
  if (exactMatch) return exactMatch;

  // If struggling, find lowest available level
  if (evalResult && evalResult.classification !== 'CORRECT') {
    return (
      skillQuestions.find((q) => q.level < currentLevel) ||
      skillQuestions.find((q) => q.level === currentLevel) ||
      skillQuestions[0]
    );
  }

  // If correct or initial probe, find next higher level
  return (
    skillQuestions.find((q) => q.level > currentLevel) ||
    skillQuestions.find((q) => q.level === currentLevel) ||
    skillQuestions[0]
  );
}

/**
 * Evaluates whether an assessment for a skill has reached sufficient decisive evidence.
 * Decisive evidence is reached when:
 * 1. 2 consecutive CORRECT answers at level >= 2 (mastery demonstrated)
 * 2. Or 2 consecutive struggles (foundational boundary identified)
 * 3. Or maximum questions for the skill (4 items) reached.
 */
export function computeSkillAdaptiveSummary(params: {
  skill: string;
  items: Array<{
    question: Question;
    response: { choice?: number; action?: 'skip' | 'dont_know'; isTechnicalFailure?: boolean };
  }>;
}): SkillAdaptiveSummary {
  const { skill, items } = params;
  const verifiedConcepts = new Set<string>();
  const conceptsNeedingEvidence = new Set<string>();
  const misconceptions = new Set<string>();

  let earnedWeighted = 0;
  let totalWeight = 0;
  let evidenceItemCount = 0;

  for (const item of items) {
    const evaluation = evaluateResponse(item.question, item.response);

    if (evaluation.verifiedConcept) {
      verifiedConcepts.add(evaluation.verifiedConcept);
    }
    if (evaluation.conceptNeedingEvidence) {
      conceptsNeedingEvidence.add(evaluation.conceptNeedingEvidence);
    }
    if (evaluation.misconceptionIdentified) {
      misconceptions.add(evaluation.misconceptionIdentified);
    }

    if (evaluation.isEvidence) {
      evidenceItemCount++;
      earnedWeighted += evaluation.earnedPoints * evaluation.weight;
      totalWeight += evaluation.weight;
    }
  }

  const proficiency = totalWeight > 0 ? Math.round(earnedWeighted / totalWeight) : 0;
  // Confidence scales with evidence count (0.45 baseline for 1 item, up to 0.85 for 4 items)
  const confidence = Math.min(0.85, 0.40 + evidenceItemCount * 0.15);

  const totalAsked = items.length;
  const lastTwo = items.slice(-2);
  const consecutiveCorrect =
    lastTwo.length === 2 &&
    lastTwo.every((it) => evaluateResponse(it.question, it.response).classification === 'CORRECT');
  const consecutiveStruggles =
    lastTwo.length === 2 &&
    lastTwo.every((it) => evaluateResponse(it.question, it.response).classification === 'INCORRECT');

  const decisiveEvidenceReached =
    totalAsked >= 4 ||
    (totalAsked >= 2 && consecutiveCorrect && lastTwo[1].question.level >= 2) ||
    (totalAsked >= 2 && consecutiveStruggles);

  const lastItem = items[items.length - 1];
  const lastLevel = lastItem ? lastItem.question.level : 1;
  const nextRecommendedLevel =
    proficiency >= 80 ? Math.min(5, lastLevel + 1) : proficiency < 50 ? Math.max(0, lastLevel - 1) : lastLevel;

  let nextAction = `Continue practice in ${skill} fundamentals.`;
  if (proficiency >= 80) {
    nextAction = `Ready for practical project verification in ${skill}.`;
  } else if (misconceptions.size > 0) {
    nextAction = `Review identified misconception: ${Array.from(misconceptions)[0]}`;
  }

  return {
    skill,
    proficiency,
    confidence,
    verifiedConcepts: Array.from(verifiedConcepts),
    conceptsNeedingEvidence: Array.from(conceptsNeedingEvidence),
    misconceptions: Array.from(misconceptions),
    totalAsked,
    decisiveEvidenceReached,
    nextRecommendedLevel,
    nextAction,
  };
}
