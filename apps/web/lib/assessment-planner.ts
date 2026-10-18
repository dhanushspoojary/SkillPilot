import type { Evidence, Question } from './types.ts';
import type { StudentCapabilityProfile } from './capability-profile.ts';
import type { OnboardingTurn } from './onboarding-dialogue.ts';
import { QUESTIONS, SKILLS } from './questions.ts';
import { skillStates } from './engine.ts';

/**
 * Prerequisite dependency graph for skills.
 * A skill cannot be planned or tested unless all its prerequisites
 * have baseline evidence or verification.
 */
export const PREREQUISITES: Record<string, string[]> = {
  'rest-apis': ['javascript', 'problem-solving'],
  'sql': [],
  'javascript': [],
  'problem-solving': [],
  'git': [],
  'communication': [],
};

export interface QuestionValidationResult {
  allowed: boolean;
  reason: string;
  code: 'OK' | 'UNCLAIMED_SKILL' | 'MISSING_PREREQUISITES' | 'LEVEL_TOO_HIGH';
  suggestedSkill?: string;
  suggestedLevel?: number;
}

export interface StudentSkillClaims {
  claimedSkills: string[];
  selfReportedBackground: string;
  isBeginner: boolean;
  hasClaimed(skill: string): boolean;
}

/**
 * Extracts self-reported claimed skills from the student profile and dialogue.
 * Completely separate from verified evidence: claims establish what is eligible
 * for assessment, but carry zero score and zero readiness credit.
 */
export function extractClaimedSkills(
  profile?: Partial<StudentCapabilityProfile>,
  dialogue?: OnboardingTurn[]
): StudentSkillClaims {
  const claimedSet = new Set<string>();

  const exp = (profile?.programmingExperience || '').toLowerCase();
  const edu = (profile?.educationLevel || '').toLowerCase();
  const focusAreas = Array.isArray(profile?.focusAreas) ? profile.focusAreas : [];
  const careerInterests = Array.isArray(profile?.careerInterests) ? profile.careerInterests : [];

  // Inspect dialogue answers if provided
  const dialogueAnswers = (dialogue || []).map((t) => (t.answer || '').toLowerCase());
  const combinedAnswers = dialogueAnswers.join(' ');

  const isBeginner =
    exp === 'beginner' ||
    edu === 'first_year' ||
    combinedAnswers.includes('complete beginner') ||
    combinedAnswers.includes('new to programming');

  // Foundational skills eligible for any learner
  claimedSet.add('problem-solving');

  // Check explicit focus areas
  for (const fa of focusAreas) {
    const fLower = fa.toLowerCase();
    if (fLower.includes('javascript') || fLower.includes('js') || fLower.includes('frontend')) {
      claimedSet.add('javascript');
    }
    if (fLower.includes('sql') || fLower.includes('database')) {
      claimedSet.add('sql');
    }
    if (fLower.includes('api') || fLower.includes('backend') || fLower.includes('rest')) {
      claimedSet.add('rest-apis');
    }
    if (fLower.includes('git') || fLower.includes('github') || fLower.includes('tools')) {
      claimedSet.add('git');
    }
    if (fLower.includes('communication') || fLower.includes('mentor')) {
      claimedSet.add('communication');
    }
    if (fLower.includes('c programming') || fLower.includes('pointer') || fLower.includes('logic')) {
      claimedSet.add('problem-solving');
    }
  }

  // Check dialogue text for language or skill mentions
  if (combinedAnswers.includes('javascript') || combinedAnswers.includes('web development')) {
    claimedSet.add('javascript');
  }
  if (combinedAnswers.includes('sql') || combinedAnswers.includes('database')) {
    claimedSet.add('sql');
  }
  if (combinedAnswers.includes('rest api') || combinedAnswers.includes('rest apis')) {
    claimedSet.add('rest-apis');
  }
  if (combinedAnswers.includes('git') || combinedAnswers.includes('github')) {
    claimedSet.add('git');
  }

  // Check experience levels
  if (exp === 'projects' || exp === 'small_programs' || exp === 'experienced') {
    // If student claims project experience, check if career interest implies specific skills
    if (careerInterests.some((c) => /frontend|web/i.test(c))) {
      claimedSet.add('javascript');
    }
    if (careerInterests.some((c) => /backend|data/i.test(c))) {
      claimedSet.add('sql');
    }
  }

  const claimedSkills = Array.from(claimedSet);

  return {
    claimedSkills,
    selfReportedBackground: exp || (isBeginner ? 'beginner' : 'intermediate'),
    isBeginner,
    hasClaimed(skill: string) {
      return claimedSet.has(skill);
    },
  };
}

/**
 * Determines whether a student has demonstrated sufficient baseline proficiency
 * in a prerequisite skill (either score >= 50, or verified status).
 */
export function hasPrerequisiteMet(
  prereqSkill: string,
  evidence: Evidence[]
): boolean {
  const items = evidence.filter((e) => e.skill === prereqSkill);
  if (items.length === 0) return false;

  const states = skillStates(evidence);
  const state = states.find((s) => s.def.id === prereqSkill);
  if (!state) return false;

  return state.verified || state.score >= 50;
}

/**
 * Calculates the justified question level for a skill based on verified evidence.
 * 
 * Levels:
 * 0 - Concept recognition
 * 1 - Basic syntax / code comprehension
 * 2 - Simple application
 * 3 - Independent problem solving
 * 4 - Debugging / implementation edge cases
 * 5 - Advanced architecture / concurrency
 */
export function calculateJustifiedLevel(
  skill: string,
  evidence: Evidence[],
  isBeginner = false
): number {
  const items = evidence.filter((e) => e.skill === skill);
  if (items.length === 0) {
    // No evidence yet: start at level 1 for beginner, level 2 for experienced
    return isBeginner ? 1 : 2;
  }

  const states = skillStates(evidence);
  const state = states.find((s) => s.def.id === skill);
  const score = state?.score ?? 0;

  if (score >= 90 && state?.verified) return 4;
  if (score >= 75) return 3;
  if (score >= 50) return 2;
  return 1;
}

/**
 * Deterministically validates any proposed question (whether generated by AI,
 * suggested by client, or selected from a bank).
 * 
 * REJECTS:
 * 1. Any question for a skill the student has not claimed or explicitly chosen.
 * 2. Any question where prerequisite skills lack baseline evidence.
 * 3. Any question with difficulty above the student's justified level.
 */
export function validateQuestionProposal(
  question: { skill: string; level: number; id?: string },
  context: {
    claimedSkills: string[];
    evidence: Evidence[];
    isExplicitSelection?: boolean;
    isBeginner?: boolean;
  }
): QuestionValidationResult {
  const { skill, level } = question;

  // 1. Never test a skill the student hasn't claimed or explicitly chosen
  const isClaimed = context.claimedSkills.includes(skill);
  if (!isClaimed && !context.isExplicitSelection) {
    return {
      allowed: false,
      code: 'UNCLAIMED_SKILL',
      reason: `Skill '${skill}' is unclaimed by the student. Assessments are restricted to claimed skills and declared goals.`,
      suggestedSkill: context.claimedSkills[0] || 'problem-solving',
      suggestedLevel: 1,
    };
  }

  // 2. Prerequisite check
  const requiredPrereqs = PREREQUISITES[skill] || [];
  for (const prereq of requiredPrereqs) {
    if (!hasPrerequisiteMet(prereq, context.evidence)) {
      return {
        allowed: false,
        code: 'MISSING_PREREQUISITES',
        reason: `Cannot assess '${skill}' before establishing prerequisite '${prereq}'. Demonstrate prerequisite baseline first.`,
        suggestedSkill: prereq,
        suggestedLevel: calculateJustifiedLevel(prereq, context.evidence, context.isBeginner),
      };
    }
  }

  // 3. Level check
  const justifiedLevel = calculateJustifiedLevel(skill, context.evidence, context.isBeginner);
  const maxAllowedLevel = justifiedLevel + 1; // At most 1 level above justified for adaptive stretch

  if (level > maxAllowedLevel) {
    return {
      allowed: false,
      code: 'LEVEL_TOO_HIGH',
      reason: `Question level ${level} exceeds justified level ${justifiedLevel} for '${skill}'.`,
      suggestedSkill: skill,
      suggestedLevel: justifiedLevel,
    };
  }

  return {
    allowed: true,
    code: 'OK',
    reason: `Question meets prerequisite, claim, and difficulty criteria.`,
  };
}

export interface PlannedAssessment {
  skillsToAssess: string[];
  initialQuestions: Question[];
  resumed: boolean;
  explanation: string;
}

/**
 * Central server-side assessment session planner.
 * Determines the exact, valid set of skills and initial questions to assess.
 * Guaranteed never to assign JS/SQL to students who haven't claimed them or lack prerequisites.
 */
export function planAssessmentSession(params: {
  userId: string;
  focus?: string;
  profile?: Partial<StudentCapabilityProfile>;
  dialogue?: OnboardingTurn[];
  evidence: Evidence[];
}): PlannedAssessment {
  const claims = extractClaimedSkills(params.profile, params.dialogue);
  const { focus, evidence } = params;

  let selectedSkills: string[] = [];
  let explanation = '';

  if (focus) {
    // If student explicitly requested a focus skill
    const validation = validateQuestionProposal(
      { skill: focus, level: 1 },
      {
        claimedSkills: claims.claimedSkills,
        evidence,
        isExplicitSelection: true,
        isBeginner: claims.isBeginner,
      }
    );

    if (validation.allowed) {
      selectedSkills = [focus];
      explanation = `Assessing explicitly chosen skill '${focus}'.`;
    } else if (validation.code === 'MISSING_PREREQUISITES' && validation.suggestedSkill) {
      // Divert gracefully to the missing prerequisite
      selectedSkills = [validation.suggestedSkill];
      explanation = `Diverted to prerequisite '${validation.suggestedSkill}' before assessing '${focus}'.`;
    } else {
      selectedSkills = ['problem-solving'];
      explanation = `Focus '${focus}' is invalid; defaulted to foundational 'problem-solving'.`;
    }
  } else {
    // Filter claimed skills whose prerequisites are satisfied
    const eligible = claims.claimedSkills.filter((s) => {
      const prereqs = PREREQUISITES[s] || [];
      return prereqs.every((p) => hasPrerequisiteMet(p, evidence));
    });

    if (claims.isBeginner || eligible.length === 0) {
      // Complete beginners start with foundational problem-solving
      selectedSkills = ['problem-solving'];
      explanation = 'Beginner assessment focused strictly on core logic and problem-solving.';
    } else {
      // Limit to at most 2 eligible claimed skills per session for focused diagnostics
      selectedSkills = eligible.slice(0, 2);
      explanation = `Assessing eligible claimed skills: ${selectedSkills.join(', ')}.`;
    }
  }

  const initialQuestions: Question[] = [];

  for (const skill of selectedSkills) {
    const justifiedLevel = calculateJustifiedLevel(skill, evidence, claims.isBeginner);
    const pool = QUESTIONS.filter((q) => q.skill === skill);
    // Find closest question at justified level
    const match =
      pool.find((q) => q.level === justifiedLevel) ??
      pool.find((q) => q.level === 1) ??
      pool[0];

    if (match) {
      initialQuestions.push(match);
    }
  }

  return {
    skillsToAssess: selectedSkills,
    initialQuestions,
    resumed: false,
    explanation,
  };
}
