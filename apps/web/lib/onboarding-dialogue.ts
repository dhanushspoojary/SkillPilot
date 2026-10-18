/**
 * Canonical onboarding dialogue types, topic definitions, ID generation,
 * topic inference, and sanitization utilities. Safe for both client and server runtime environments.
 */

export type OnboardingTopic =
  | 'education'
  | 'experience'
  | 'struggles'
  | 'goals'
  | 'availability'
  | 'summary';

export interface OnboardingTurn {
  id: string;
  topic: OnboardingTopic;
  question: string;
  options?: string[];
  answer?: string;
  answeredAt?: string;
}

export const ONBOARDING_TOPIC_CONFIGS: Array<{
  topic: 'education' | 'experience' | 'struggles' | 'goals' | 'availability';
  defaultQuestion: string;
  options: string[];
}> = [
  {
    topic: 'education',
    defaultQuestion: 'Welcome to SkillPilot! Which best describes your current college or learning stage?',
    options: [
      '1st Year Student (Just starting college)',
      '2nd Year Student (Core CS subjects)',
      '3rd / 4th Year (Placement prep)',
      'Self-taught / Bootcamp (Independent learner)',
    ],
  },
  {
    topic: 'experience',
    defaultQuestion: 'How would you describe your coding experience so far?',
    options: [
      'Complete Beginner (new to programming)',
      'Basic Coursework (studied intro C, C++, or Python)',
      'Small Programs (understand loops, functions, variables)',
      'Built Projects (built scripts, apps, or web pages)',
    ],
  },
  {
    topic: 'struggles',
    defaultQuestion: 'Which concepts or problem-solving areas feel most unfamiliar or difficult right now?',
    options: [
      'Pointers and memory layout in C',
      'Writing logic/algorithms without hints',
      'Arrays and basic data structures',
      'Web development and REST APIs',
      'Everything is new — starting from zero',
    ],
  },
  {
    topic: 'goals',
    defaultQuestion: 'What career direction or pathway are you aiming toward?',
    options: [
      'Software Engineer',
      'Backend Engineer',
      'Frontend Engineer',
      'Full Stack Engineer',
    ],
  },
  {
    topic: 'availability',
    defaultQuestion: 'How many focused hours can you realistically dedicate to learning each week?',
    options: [
      '3-5 hours / week (steady foundational pace)',
      '6-10 hours / week (active career building)',
      '10+ hours / week (intensive preparation)',
    ],
  },
];

/**
 * Generates a stable, unique turn ID with an informative topic prefix.
 * Avoids colliding sequential keys (e.g. static 'turn-1') in React rendering.
 */
export function generateTurnId(topic = 'step'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `turn-${topic}-${crypto.randomUUID().slice(0, 8)}`;
  }
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `turn-${topic}-${ts}-${rand}`;
}

/**
 * Infers an onboarding topic from raw metadata, question text, or sequence index.
 * Prevents legitimate separate questions from erroneously defaulting to the same topic.
 */
export function inferTopic(rawTopic: unknown, question?: string, index?: number): OnboardingTopic {
  const normTopic = typeof rawTopic === 'string' ? rawTopic.trim().toLowerCase() : '';
  const valid: OnboardingTopic[] = ['education', 'experience', 'struggles', 'goals', 'availability', 'summary'];
  if (valid.includes(normTopic as OnboardingTopic)) {
    return normTopic as OnboardingTopic;
  }
  const q = typeof question === 'string' ? question.toLowerCase() : '';
  if (/college|academic|stage|year/i.test(q)) return 'education';
  if (/experience|coding|programming|c\+\+|python|built/i.test(q)) return 'experience';
  if (/struggle|difficult|unfamiliar|pointers|memory|algorithms/i.test(q)) return 'struggles';
  if (/career|pathway|aiming|goal|software engineer/i.test(q)) return 'goals';
  if (/hour|week|availability|dedicate/i.test(q)) return 'availability';

  if (typeof index === 'number' && index >= 0 && index < ONBOARDING_TOPIC_CONFIGS.length) {
    return ONBOARDING_TOPIC_CONFIGS[index].topic;
  }
  return 'education';
}

/**
 * Validates and deduplicates dialogue turns from storage or network responses.
 * Reassigns unique keys to any duplicate or legacy 'turn-1' IDs without losing student responses.
 * Preserves distinct questions without prematurely merging them.
 */
export function sanitizeDialogueTurns(rawTurns: unknown): OnboardingTurn[] {
  if (!Array.isArray(rawTurns)) return [];

  const seenIds = new Set<string>();
  const seenAnsweredTopics = new Set<string>();
  const sanitized: OnboardingTurn[] = [];

  for (let idx = 0; idx < rawTurns.length; idx++) {
    const raw = rawTurns[idx];
    if (!raw || typeof raw !== 'object') continue;

    let topic = inferTopic((raw as any).topic, (raw as any).question, idx);
    const question = typeof (raw as any).question === 'string' ? (raw as any).question : '';
    const answer = typeof (raw as any).answer === 'string' && (raw as any).answer.trim()
      ? (raw as any).answer.trim()
      : undefined;
    const answeredAt = typeof (raw as any).answeredAt === 'string' ? (raw as any).answeredAt : undefined;
    const options = Array.isArray((raw as any).options)
      ? (raw as any).options.filter((o: unknown): o is string => typeof o === 'string')
      : undefined;

    // Deduplicate: if an answer for this topic was already recorded:
    if (answer && seenAnsweredTopics.has(topic)) {
      const existing = sanitized.find((t) => t.topic === topic);
      // Only merge if the questions are identical (an updated answer) or if the existing turn lacked an answer
      if (existing && (!existing.answer || existing.question === question || !question)) {
        existing.answer = answer;
        if (question) existing.question = question;
        if (options) existing.options = options;
        if (answeredAt) existing.answeredAt = answeredAt;
        continue;
      }
      // If the questions are distinct, preserve this as a separate question rather than merging
      topic = inferTopic(undefined, question, sanitized.length);
    }

    let id = typeof (raw as any).id === 'string' && (raw as any).id.trim()
      ? (raw as any).id.trim()
      : '';

    // If ID is missing or duplicate, assign a guaranteed unique ID
    if (!id || seenIds.has(id)) {
      id = generateTurnId(topic);
    }
    seenIds.add(id);

    if (answer) {
      seenAnsweredTopics.add(topic);
    }

    sanitized.push({
      id,
      topic,
      question,
      options,
      answer,
      answeredAt,
    });
  }

  return sanitized;
}

/**
 * Safely updates turns state in-place or appends without duplicate keys or duplicate topics.
 * Retains the existing turn's ID so React keys remain stable across updates.
 */
export function mergeOrAppendTurn(turns: OnboardingTurn[], turnToMerge: OnboardingTurn): OnboardingTurn[] {
  const existingIdx = turns.findIndex(
    (t) => t.id === turnToMerge.id || (Boolean(t.topic) && t.topic === turnToMerge.topic),
  );
  if (existingIdx >= 0) {
    const next = [...turns];
    next[existingIdx] = {
      ...turnToMerge,
      id: next[existingIdx].id || turnToMerge.id,
    };
    return next;
  }
  return [...turns, turnToMerge];
}
