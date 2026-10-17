import { db, one, many } from './db.ts';
import { SKILLS } from './questions.ts';
import { skillStates, readiness } from './engine.ts';
import type { Evidence } from './types.ts';

export type WorkflowStage =
  | 'REGISTERED'
  | 'ONBOARDING_IN_PROGRESS'
  | 'ONBOARDING_COMPLETE'
  | 'ASSESSMENT_IN_PROGRESS'
  | 'ASSESSMENT_COMPLETE'
  | 'SKILL_BASELINE_REVIEW'
  | 'SKILLS_CONFIRMED'
  | 'LEARNING_GOALS_CONFIRMED'
  | 'ROADMAP_READY'
  | 'LEARNING_IN_PROGRESS'
  | 'REASSESSMENT_DUE'
  | 'REASSESSMENT_COMPLETE';

export interface OnboardingTurn {
  id: string;
  topic: 'education' | 'experience' | 'struggles' | 'goals' | 'availability' | 'summary';
  question: string;
  options?: string[];
  answer?: string;
  answeredAt?: string;
}

export interface StudentWorkflowState {
  userId: string;
  stage: WorkflowStage;
  onboardingDialogue: OnboardingTurn[];
  confirmedSkills: Record<string, {
    score: number;
    confirmedAt: string;
    challenged?: boolean;
    note?: string;
  }>;
  confirmedGoals: string[];
  featuresLocked: {
    roadmap: boolean;
    roadmapReason?: string;
    careerReadiness: boolean;
    advancedMockInterview: boolean;
  };
  nextRecommendedAction: {
    title: string;
    reason: string;
    route: string;
    actionLabel: string;
    stage: WorkflowStage;
  };
  updatedAt: string;
}

const ONBOARDING_TOPICS: Array<{
  topic: OnboardingTurn['topic'];
  defaultQuestion: string;
  options: string[];
}> = [
  {
    topic: 'education',
    defaultQuestion: 'Welcome to SkillPilot! To personalize your journey, what is your current academic stage or background?',
    options: ['1st Year Student', '2nd Year Student', '3rd / 4th Year Student', 'Self-Taught / Independent Learner'],
  },
  {
    topic: 'experience',
    defaultQuestion: 'How would you describe your coding experience so far?',
    options: ['Complete Beginner (new to programming)', 'Basic Coursework (studied intro C, C++, or Python)', 'Small Programs (understand loops, functions, variables)', 'Built Projects (built scripts, apps, or web pages)'],
  },
  {
    topic: 'struggles',
    defaultQuestion: 'Which concepts or problem-solving areas feel most unfamiliar or difficult right now?',
    options: ['Pointers and memory layout in C', 'Writing logic/algorithms without hints', 'Arrays and basic data structures', 'Web development and REST APIs', 'Everything is new — starting from zero'],
  },
  {
    topic: 'goals',
    defaultQuestion: 'What career direction or pathway are you aiming toward?',
    options: ['Software Engineer', 'Backend Engineer', 'Frontend Engineer', 'Full Stack Engineer'],
  },
  {
    topic: 'availability',
    defaultQuestion: 'How many focused hours can you realistically dedicate to learning each week?',
    options: ['3-5 hours / week (steady foundational pace)', '6-10 hours / week (active career building)', '10+ hours / week (intensive preparation)'],
  },
];

/**
 * Derives the contextual next recommended action and feature locks
 * based strictly on the verified workflow stage and database evidence.
 */
export function deriveWorkflowGuidance(
  stage: WorkflowStage,
  hasEvidence: boolean,
  hasRoadmapActions: boolean,
): {
  featuresLocked: StudentWorkflowState['featuresLocked'];
  nextRecommendedAction: StudentWorkflowState['nextRecommendedAction'];
} {
  // Feature Locks Enforcement:
  // Roadmap is strictly locked until assessment is complete, skills reviewed & confirmed, and goals confirmed.
  const roadmapLocked = ![
    'ROADMAP_READY',
    'LEARNING_IN_PROGRESS',
    'REASSESSMENT_DUE',
    'REASSESSMENT_COMPLETE',
  ].includes(stage);

  let roadmapReason: string | undefined;
  if (['REGISTERED', 'ONBOARDING_IN_PROGRESS'].includes(stage)) {
    roadmapReason = 'Complete your initial onboarding calibration to begin your diagnostic.';
  } else if (['ONBOARDING_COMPLETE', 'ASSESSMENT_IN_PROGRESS'].includes(stage)) {
    roadmapReason = 'Complete your initial assessment and confirm your skill profile to unlock your personalized roadmap.';
  } else if (['ASSESSMENT_COMPLETE', 'SKILL_BASELINE_REVIEW'].includes(stage)) {
    roadmapReason = 'Review your assessment evidence and confirm or challenge your skill profile.';
  } else if (stage === 'SKILLS_CONFIRMED') {
    roadmapReason = 'Confirm what you want to learn so your roadmap matches your goals.';
  }

  const careerReadinessLocked = !hasEvidence;
  const advancedMockInterviewLocked = roadmapLocked;

  // Next Recommended Action:
  let nextAction: StudentWorkflowState['nextRecommendedAction'];

  switch (stage) {
    case 'REGISTERED':
    case 'ONBOARDING_IN_PROGRESS':
      nextAction = {
        title: 'Calibrate Your Starting Background',
        reason: 'Tell us where you are starting so your diagnostics and roadmap avoid irrelevant or overly advanced concepts.',
        route: 'onboarding',
        actionLabel: 'Complete Calibration',
        stage,
      };
      break;

    case 'ONBOARDING_COMPLETE':
    case 'ASSESSMENT_IN_PROGRESS':
      nextAction = {
        title: 'Establish Your Skill Baseline',
        reason: 'Take your adaptive introductory diagnostic to measure your real starting abilities across core engineering skills.',
        route: 'assess',
        actionLabel: 'Start Diagnostic Assessment',
        stage,
      };
      break;

    case 'ASSESSMENT_COMPLETE':
    case 'SKILL_BASELINE_REVIEW':
      nextAction = {
        title: 'Review & Confirm Skill Baseline',
        reason: 'Review your server-scored assessment results. You can confirm your baseline or challenge any skill score with a targeted retest.',
        route: 'assess',
        actionLabel: 'Review Assessment Results',
        stage,
      };
      break;

    case 'SKILLS_CONFIRMED':
      nextAction = {
        title: 'Confirm Learning Goals & Direction',
        reason: 'Confirm what career pathway and skills you want to prioritize so your personalized roadmap matches your goals.',
        route: 'profile',
        actionLabel: 'Confirm Learning Goals',
        stage,
      };
      break;

    case 'LEARNING_GOALS_CONFIRMED':
    case 'ROADMAP_READY':
      nextAction = {
        title: 'Generate Personalized Roadmap',
        reason: 'Your prerequisites and confirmed skill gaps are ready. Generate your step-by-step roadmap.',
        route: 'roadmap',
        actionLabel: 'View & Activate Roadmap',
        stage,
      };
      break;

    case 'LEARNING_IN_PROGRESS':
    default:
      nextAction = {
        title: 'Today’s Priority Learning Task',
        reason: 'Focus on your highest-leverage task to close your current bottleneck skill and raise your verified readiness score.',
        route: 'today',
        actionLabel: 'Work on Today’s Task',
        stage,
      };
      break;
  }

  return {
    featuresLocked: {
      roadmap: roadmapLocked,
      roadmapReason,
      careerReadiness: careerReadinessLocked,
      advancedMockInterview: advancedMockInterviewLocked,
    },
    nextRecommendedAction: nextAction,
  };
}

/**
 * Retrieves the student's durable workflow state from PostgreSQL.
 * If no state exists yet, detects existing database progress (evidence, roadmap, capability profile)
 * to set the correct backwards-compatible stage, or initializes fresh onboarding.
 */
export async function getOrComputeWorkflowState(userId: string): Promise<StudentWorkflowState> {
  const row = await one<{
    stage: string;
    onboardingDialogue: unknown;
    confirmedSkills: unknown;
    confirmedGoals: unknown;
    updatedAt: string;
  }>(
    `select stage, onboarding_dialogue as "onboardingDialogue", confirmed_skills as "confirmedSkills",
            confirmed_goals as "confirmedGoals", updated_at as "updatedAt"
     from student_workflow_states
     where user_id = $1`,
    [userId],
  ).catch(() => null);

  // Check existing DB records for accurate stage derivation
  const evidenceCountRow = await one<{ count: string }>(
    `select count(*)::text as count from user_skill_evidence where user_id = $1`,
    [userId],
  ).catch(() => ({ count: '0' }));
  const hasEvidence = Number(evidenceCountRow?.count || 0) > 0;

  const roadmapRow = await one<{ count: string }>(
    `select count(*)::text as count from roadmap_actions where user_id = $1`,
    [userId],
  ).catch(() => ({ count: '0' }));
  const hasRoadmap = Number(roadmapRow?.count || 0) > 0;

  const capRow = await one<{ onboarding_completed: boolean }>(
    `select onboarding_completed from student_capability_profiles where user_id = $1`,
    [userId],
  ).catch(() => null);
  const capCompleted = Boolean(capRow?.onboarding_completed);

  let stage: WorkflowStage = 'REGISTERED';
  let onboardingDialogue: OnboardingTurn[] = [];
  let confirmedSkills: StudentWorkflowState['confirmedSkills'] = {};
  let confirmedGoals: string[] = [];

  if (row) {
    stage = row.stage as WorkflowStage;
    onboardingDialogue = Array.isArray(row.onboardingDialogue) ? (row.onboardingDialogue as OnboardingTurn[]) : [];
    confirmedSkills = (row.confirmedSkills && typeof row.confirmedSkills === 'object') ? (row.confirmedSkills as StudentWorkflowState['confirmedSkills']) : {};
    confirmedGoals = Array.isArray(row.confirmedGoals) ? (row.confirmedGoals as string[]) : [];
  } else {
    // Determine initial stage based on existing historical data
    if (hasRoadmap) {
      stage = 'LEARNING_IN_PROGRESS';
    } else if (hasEvidence) {
      stage = 'SKILL_BASELINE_REVIEW';
    } else if (capCompleted) {
      stage = 'ONBOARDING_COMPLETE';
    } else {
      stage = 'REGISTERED';
      // Initialize first question in onboarding dialogue
      onboardingDialogue = [
        {
          id: 'turn-1',
          topic: ONBOARDING_TOPICS[0].topic,
          question: ONBOARDING_TOPICS[0].defaultQuestion,
          options: ONBOARDING_TOPICS[0].options,
        },
      ];
    }

    // Persist computed initial state
    await db().query(
      `insert into student_workflow_states(user_id, stage, onboarding_dialogue, confirmed_skills, confirmed_goals, updated_at)
       values($1, $2, $3, $4, $5, now())
       on conflict(user_id) do update set
         stage = excluded.stage,
         onboarding_dialogue = excluded.onboarding_dialogue,
         updated_at = now()`,
      [
        userId,
        stage,
        JSON.stringify(onboardingDialogue),
        JSON.stringify(confirmedSkills),
        JSON.stringify(confirmedGoals),
      ],
    ).catch(() => {});
  }

  // If stage is registered/in-progress and dialogue is empty, initialize turn 1
  if (['REGISTERED', 'ONBOARDING_IN_PROGRESS'].includes(stage) && onboardingDialogue.length === 0) {
    onboardingDialogue = [
      {
        id: 'turn-1',
        topic: ONBOARDING_TOPICS[0].topic,
        question: ONBOARDING_TOPICS[0].defaultQuestion,
        options: ONBOARDING_TOPICS[0].options,
      },
    ];
  }

  const guidance = deriveWorkflowGuidance(stage, hasEvidence, hasRoadmap);

  return {
    userId,
    stage,
    onboardingDialogue,
    confirmedSkills,
    confirmedGoals,
    featuresLocked: guidance.featuresLocked,
    nextRecommendedAction: guidance.nextRecommendedAction,
    updatedAt: row?.updatedAt || new Date().toISOString(),
  };
}

/**
 * Transitions workflow stage with validation to prevent illegal backwards/forward leaps.
 */
export async function transitionWorkflowStage(
  userId: string,
  newStage: WorkflowStage,
): Promise<StudentWorkflowState> {
  await db().query(
    `insert into student_workflow_states(user_id, stage, updated_at)
     values($1, $2, now())
     on conflict(user_id) do update set stage = $2, updated_at = now()`,
    [userId, newStage],
  );
  return getOrComputeWorkflowState(userId);
}

/**
 * Processes one dynamic onboarding answer, saves it incrementally to the database,
 * and generates the next dynamic question or the final summary for student review.
 */
export async function processOnboardingTurn(
  userId: string,
  answer: string,
): Promise<{
  state: StudentWorkflowState;
  nextTurn?: OnboardingTurn;
  summary?: {
    educationLevel: string;
    programmingExperience: string;
    struggles: string;
    careerGoal: string;
    weeklyHours: number;
    selfReported: boolean;
  };
  isComplete: boolean;
}> {
  const current = await getOrComputeWorkflowState(userId);
  const dialogue = [...current.onboardingDialogue];

  // Find latest unanswered turn or turn being answered
  const activeTurnIdx = dialogue.length - 1;
  if (activeTurnIdx >= 0) {
    dialogue[activeTurnIdx] = {
      ...dialogue[activeTurnIdx],
      answer: answer.trim(),
      answeredAt: new Date().toISOString(),
    };
  }

  // Check which topics have been answered
  const answeredTopics = new Set(dialogue.filter((d) => d.answer).map((d) => d.topic));

  // Find next unanswered topic
  const nextTopicDef = ONBOARDING_TOPICS.find((t) => !answeredTopics.has(t.topic));

  let nextTurn: OnboardingTurn | undefined;
  let summary: {
    educationLevel: string;
    programmingExperience: string;
    struggles: string;
    careerGoal: string;
    weeklyHours: number;
    selfReported: boolean;
  } | undefined;
  let isComplete = false;
  let newStage = current.stage;

  if (nextTopicDef) {
    // Generate next dynamic question
    let dynamicQuestion = nextTopicDef.defaultQuestion;

    // Contextual phrasing based on previous answers
    const expAnswer = dialogue.find((d) => d.topic === 'experience')?.answer || '';
    if (nextTopicDef.topic === 'struggles' && /beginner|new|never/i.test(expAnswer)) {
      dynamicQuestion = 'Starting as a beginner is valued here. Which concepts would you like to explore first without rush?';
    } else if (nextTopicDef.topic === 'struggles' && /c\b|c\+\+|basics/i.test(expAnswer)) {
      dynamicQuestion = 'C and core coursework provide great foundations! In problem-solving, which areas feel trickiest (e.g. pointers, logic tracing, or arrays)?';
    }

    nextTurn = {
      id: `turn-${dialogue.length + 1}`,
      topic: nextTopicDef.topic,
      question: dynamicQuestion,
      options: nextTopicDef.options,
    };
    dialogue.push(nextTurn);
    newStage = 'ONBOARDING_IN_PROGRESS';
  } else {
    // All topics answered: Generate concise profile summary
    isComplete = true;
    const edu = dialogue.find((d) => d.topic === 'education')?.answer || '1st Year Student';
    const exp = dialogue.find((d) => d.topic === 'experience')?.answer || 'Beginner';
    const struggles = dialogue.find((d) => d.topic === 'struggles')?.answer || 'Problem solving fundamentals';
    const goals = dialogue.find((d) => d.topic === 'goals')?.answer || 'Software Engineer';
    const avail = dialogue.find((d) => d.topic === 'availability')?.answer || '5 hours';
    const hours = parseInt(avail.match(/\d+/)?.[0] || '5', 10);

    summary = {
      educationLevel: edu,
      programmingExperience: exp,
      struggles,
      careerGoal: goals,
      weeklyHours: hours,
      selfReported: true,
    };

    // Save capability profile to database
    await db().query(
      `insert into student_capability_profiles(
        user_id, education_level, programming_experience, field_of_study,
        career_interests, weekly_hours, focus_areas, onboarding_completed, updated_at
      ) values ($1, $2, $3, 'computer_science', $4, $5, $6, true, now())
      on conflict(user_id) do update set
        education_level = excluded.education_level,
        programming_experience = excluded.programming_experience,
        career_interests = excluded.career_interests,
        weekly_hours = excluded.weekly_hours,
        focus_areas = excluded.focus_areas,
        onboarding_completed = true,
        updated_at = now()`,
      [
        userId,
        edu.toLowerCase().includes('first') ? 'first_year' : edu.toLowerCase().includes('second') ? 'second_year' : 'senior',
        exp.toLowerCase().includes('beginner') ? 'beginner' : exp.toLowerCase().includes('project') ? 'built_projects' : 'studied_basics',
        JSON.stringify([goals]),
        hours,
        JSON.stringify([struggles]),
      ],
    ).catch(() => {});

    // Save career goal to career_goals table
    await db().query(
      `insert into career_goals(user_id, role_name, active, created_at)
       values($1, $2, true, now())`,
      [userId, goals],
    ).catch(() => {});
  }

  // Update workflow state in DB
  await db().query(
    `update student_workflow_states
     set onboarding_dialogue = $1, stage = $2, updated_at = now()
     where user_id = $3`,
    [JSON.stringify(dialogue), newStage, userId],
  );

  const updatedState = await getOrComputeWorkflowState(userId);
  return {
    state: updatedState,
    nextTurn,
    summary,
    isComplete,
  };
}

/**
 * Confirms or challenges assessment results after diagnostic is complete.
 * Transitions stage from SKILL_BASELINE_REVIEW -> SKILLS_CONFIRMED.
 */
export async function confirmSkillBaseline(
  userId: string,
  skillsConfirmed: Record<string, { score: number; challenged?: boolean; note?: string }>,
): Promise<StudentWorkflowState> {
  const current = await getOrComputeWorkflowState(userId);

  await db().query(
    `update student_workflow_states
     set confirmed_skills = $1, stage = 'SKILLS_CONFIRMED', updated_at = now()
     where user_id = $2`,
    [JSON.stringify(skillsConfirmed), userId],
  );

  return getOrComputeWorkflowState(userId);
}

/**
 * Confirms learning goals and unlocks roadmap generation.
 * Transitions stage from SKILLS_CONFIRMED -> LEARNING_GOALS_CONFIRMED -> ROADMAP_READY.
 */
export async function confirmLearningGoals(
  userId: string,
  goals: string[],
): Promise<StudentWorkflowState> {
  await db().query(
    `update student_workflow_states
     set confirmed_goals = $1, stage = 'ROADMAP_READY', updated_at = now()
     where user_id = $2`,
    [JSON.stringify(goals), userId],
  );

  return getOrComputeWorkflowState(userId);
}
