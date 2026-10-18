import { db, one, many } from './db.ts';
import { getStudentCapabilityProfile } from './capability-profile.ts';
import { LESSONS_CATALOG, getLessonById, type LessonDefinition } from './lessons-catalog.ts';
import { getStudentLessonProgress } from './practice-engine.ts';
import { PROJECT_CATALOG } from './project-catalog.ts';

export interface ActionableLearningTask {
  id: string;
  type: 'ONBOARDING' | 'ASSESSMENT' | 'LESSON' | 'PRACTICE' | 'PROJECT' | 'REASSESSMENT';
  title: string;
  whatYouWillLearn: string;
  whyItMatters: string;
  whatToKnowBefore: string;
  estimatedMinutes: number;
  completionRequires: string;
  route: 'calibration' | 'assess' | 'learn' | 'projects' | 'roadmap' | 'passport';
  lessonId?: string;
  skillId?: string;
  conceptId?: string;
  projectSlug?: string;
  buttonLabel: string;
  explanation: string;
  progressPercentage?: number;
}

/**
 * Evaluates the student's actual learning progress, concept mastery, recent mistakes,
 * and roadmap milestones to determine the single highest-leverage next action.
 *
 * The recommendation is strictly computed from persistent server state and database evidence.
 */
export async function determineNextAction(userId: string): Promise<ActionableLearningTask> {
  // 1. Check Onboarding Completion
  let profile = await getStudentCapabilityProfile(userId);
  if (!profile || !profile.onboardingCompleted) {
    return {
      id: 'task-onboarding',
      type: 'ONBOARDING',
      title: 'Complete Background & Learning Goals Onboarding',
      whatYouWillLearn: 'Calibrate your academic background, current coding experience, and skills you want to master.',
      whyItMatters: 'Ensures diagnostics, lesson exercises, and pacing match your exact starting point without assuming prior knowledge.',
      whatToKnowBefore: 'No technical prerequisites needed.',
      estimatedMinutes: 3,
      completionRequires: 'Answer guided questions about your education, background, and goals.',
      route: 'calibration',
      buttonLabel: 'Start Discovery',
      explanation: 'Welcome to SkillPilot! First, let us calibrate your background so we never give you questions that are too easy or assume skills you have not learned.',
      progressPercentage: 10,
    };
  }

  // 2. Check Baseline Diagnostic Evidence
  let evidenceCount = 0;
  try {
    const row = await one<{ count: string | number }>(
      `select count(*) as count from user_skill_evidence where user_id = $1`,
      [userId]
    );
    evidenceCount = Number(row?.count || 0);
  } catch {
    evidenceCount = 0;
  }

  const focusSkill = profile.primaryFocusSkill || 'problem-solving';

  if (evidenceCount === 0) {
    return {
      id: `task-assess-${focusSkill}`,
      type: 'ASSESSMENT',
      title: `Establish Baseline: ${focusSkill.replace(/-/g, ' ').toUpperCase()}`,
      whatYouWillLearn: 'Measure your real starting capabilities with an adaptive diagnostic (Levels 0–5).',
      whyItMatters: 'Self-reported claims carry zero score weight. Objective testing creates authentic proof and discovers gaps without testing unearned topics.',
      whatToKnowBefore: 'Foundational syntax or logical reasoning.',
      estimatedMinutes: 8,
      completionRequires: 'Answer 5 adaptive questions. Difficulty adjusts dynamically based on your answers.',
      route: 'assess',
      skillId: focusSkill,
      buttonLabel: 'Start Adaptive Diagnostic',
      explanation: 'Your background is calibrated. Now establish your verified baseline so your roadmap focuses only on real gaps.',
      progressPercentage: 25,
    };
  }

  // 3. Check for Weak Concepts Requiring Remedial Practice
  // Look for any concept in student_concept_mastery that is 'novice' or had recent failed attempts
  try {
    const weakConcept = await one<{
      concept: string;
      skill_slug: string;
      mastery_status: string;
      problems_attempted: number;
      problems_solved: number;
    }>(
      `select concept, skill_slug, status as mastery_status, problems_attempted, problems_solved
       from student_concept_mastery
       where user_id = $1 and (status = 'novice' or (problems_attempted > problems_solved and problems_attempted >= 2))
       order by last_practiced_at desc
       limit 1`,
      [userId]
    );

    if (weakConcept) {
      // Find matching lesson
      const matchingLesson = LESSONS_CATALOG.find((l) =>
        l.exercises.some((e) => e.concept === weakConcept.concept) || l.skillSlug === weakConcept.skill_slug
      );

      const conceptReadable = weakConcept.concept.replace(/_/g, ' ');
      return {
        id: `task-remedial-${weakConcept.concept}`,
        type: 'PRACTICE',
        title: `Remedial Practice: ${conceptReadable.toUpperCase()}`,
        whatYouWillLearn: `Correct common misunderstandings in ${conceptReadable} through Socratic step-by-step reasoning.`,
        whyItMatters: `Solidifying this weak concept will prevent compounding errors in downstream lessons and project code.`,
        whatToKnowBefore: matchingLesson?.prerequisites.join(', ') || 'Prior introductory concepts',
        estimatedMinutes: 6,
        completionRequires: 'Solve 2 practice questions correctly with 0 hints to elevate mastery from Novice to Practicing.',
        route: 'learn',
        lessonId: matchingLesson?.id || 'ps-loop-tracing',
        conceptId: weakConcept.concept,
        buttonLabel: 'Practice Weak Concept',
        explanation: `You had difficulty with ${conceptReadable} on your recent attempts (${weakConcept.problems_solved}/${weakConcept.problems_attempted} passed). Let's practice with targeted hints before moving on so the gap does not snowball.`,
        progressPercentage: 45,
      };
    }
  } catch {}

  // 4. Check for In-Progress Lessons
  try {
    const inProgressLesson = await one<{ lesson_id: string; exercises_completed: number }>(
      `select lesson_id, exercises_completed from student_lesson_progress where user_id = $1 and status = 'in_progress' order by last_attempted_at desc limit 1`,
      [userId]
    );

    if (inProgressLesson) {
      const lesson = getLessonById(inProgressLesson.lesson_id);
      if (lesson) {
        const estMins = parseInt(String(lesson.estimatedMinutes).replace(/\D/g, '') || '15', 10);
        return {
          id: `task-resume-${lesson.id}`,
          type: 'LESSON',
          title: `Resume Lesson: ${lesson.title}`,
          whatYouWillLearn: lesson.summary || lesson.subtitle || lesson.introduction,
          whyItMatters: lesson.whyItMatters,
          whatToKnowBefore: lesson.prerequisites.join(', '),
          estimatedMinutes: Math.max(5, estMins - (inProgressLesson.exercises_completed * 3)),
          completionRequires: `Complete the interactive code tracing walkthrough and finish remaining practice exercises (${inProgressLesson.exercises_completed}/${lesson.exercises.length} complete).`,
          route: 'learn',
          lessonId: lesson.id,
          buttonLabel: 'Resume Lesson',
          explanation: `You started "${lesson.title}". Resume where you left off to complete the interactive walkthrough and lock in your concept mastery.`,
          progressPercentage: Math.round((inProgressLesson.exercises_completed / lesson.exercises.length) * 100),
        };
      }
    }
  } catch {}

  // 5. Check Next Unstarted Lesson in Curriculum
  try {
    const completedLessonIds = new Set<string>();
    const completedRows = await many<{ lesson_id: string }>(
      `select lesson_id from student_lesson_progress where user_id = $1 and status = 'completed'`,
      [userId]
    );
    for (const r of completedRows) {
      completedLessonIds.add(r.lesson_id);
    }

    // Find first uncompleted lesson from catalog
    const nextLesson = LESSONS_CATALOG.find((l) => !completedLessonIds.has(l.id));
    if (nextLesson) {
      const estMins = parseInt(String(nextLesson.estimatedMinutes).replace(/\D/g, '') || '15', 10);
      return {
        id: `task-start-${nextLesson.id}`,
        type: 'LESSON',
        title: `Start Lesson: ${nextLesson.title}`,
        whatYouWillLearn: nextLesson.summary || nextLesson.subtitle || nextLesson.introduction,
        whyItMatters: nextLesson.whyItMatters,
        whatToKnowBefore: nextLesson.prerequisites.join(', '),
        estimatedMinutes: estMins,
        completionRequires: `Walk through annotated execution traces and pass ${nextLesson.exercises.length} interactive exercises.`,
        route: 'learn',
        lessonId: nextLesson.id,
        buttonLabel: 'Start Learning',
        explanation: `Great progress! Based on your roadmap and verified evidence, your next high-impact milestone is "${nextLesson.title}".`,
        progressPercentage: 60,
      };
    }
  } catch {}

  // 6. When Core Lessons are Completed, Recommend a Practical Project
  const sampleProject = PROJECT_CATALOG[0] || {
    slug: 'c-cli-calculator',
    title: 'C CLI Calculator & Expression Parser',
    description: 'Build a modular CLI calculator with pointer-based memory allocation and error parsing.',
  };

  return {
    id: `task-project-${sampleProject.slug}`,
    type: 'PROJECT',
    title: `Build Project: ${sampleProject.title}`,
    whatYouWillLearn: sampleProject.description || 'Hands-on practical system implementation',
    whyItMatters: 'Demonstrating concepts inside an integrated project creates authentic passport evidence that employers value far beyond quiz scores.',
    whatToKnowBefore: 'All foundational lessons in this competency track.',
    estimatedMinutes: 45,
    completionRequires: 'Implement core requirements, run test verification, and record authentic ledger proof.',
    route: 'projects',
    projectSlug: sampleProject.slug,
    buttonLabel: 'Open Project Workspace',
    explanation: `You have completed the foundational lessons! Now apply what you know by building "${sampleProject.title}" to turn your learning into verified passport proof.`,
    progressPercentage: 85,
  };
}
