import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { determineNextAction } from './next-action-engine.ts';
import { LESSONS_CATALOG } from './lessons-catalog.ts';

describe('Next Best Action Engine', () => {
  it('Scenario 1: First-time student with incomplete onboarding is guided to Onboarding Discovery', async () => {
    const action = await determineNextAction('user-1', {
      profile: null,
    });

    assert.equal(action.type, 'ONBOARDING');
    assert.equal(action.route, 'calibration');
    assert.equal(action.buttonLabel, 'Start Discovery');
    assert.equal(action.journeyStage, 'DISCOVERY');
    assert.equal(action.journeyStep, 1);
    assert.equal(action.estimatedMinutes, 3);
    // Answers 6 core questions:
    assert.ok(action.title, 'What to do next');
    assert.ok(action.whyItMatters, 'Why to do it');
    assert.ok(action.estimatedMinutes > 0, 'How long it will take');
    assert.ok(action.whatHappensWhenFinished, 'What happens when I finish');
    assert.ok(action.howItHelpsGoal, 'How it helps my goal');
  });

  it('Scenario 2: Student with active assessment in progress is guided to resume diagnostic', async () => {
    const action = await determineNextAction('user-2', {
      profile: {
        userId: 'user-2',
        onboardingCompleted: true,
        primaryFocusSkill: 'problem-solving',
      },
      activeAssessment: {
        id: 'assess-active-1',
        started_at: new Date().toISOString(),
      },
    });

    assert.equal(action.type, 'ASSESSMENT');
    assert.equal(action.route, 'assess');
    assert.equal(action.buttonLabel, 'Resume Assessment');
    assert.equal(action.journeyStage, 'DIAGNOSTIC');
    assert.ok(action.title.includes('Resume Your Adaptive Diagnostic'));
    assert.ok(action.whatHappensWhenFinished.includes('roadmap'));
  });

  it('Scenario 3: Calibrated student with zero verified evidence is guided to baseline diagnostic', async () => {
    const action = await determineNextAction('user-3', {
      profile: {
        userId: 'user-3',
        onboardingCompleted: true,
        primaryFocusSkill: 'problem-solving',
      },
      activeAssessment: null,
      evidenceCount: 0,
    });

    assert.equal(action.type, 'ASSESSMENT');
    assert.equal(action.route, 'assess');
    assert.equal(action.buttonLabel, 'Start Adaptive Diagnostic');
    assert.equal(action.journeyStage, 'DIAGNOSTIC');
    assert.equal(action.journeyStep, 2);
    assert.ok(action.howItHelpsGoal.includes('never waste time'));
  });

  it('Scenario 4: Student with weak concepts is guided to remedial practice', async () => {
    const action = await determineNextAction('user-4', {
      profile: {
        userId: 'user-4',
        onboardingCompleted: true,
        primaryFocusSkill: 'problem-solving',
      },
      activeAssessment: null,
      evidenceCount: 5,
      weakConcept: {
        concept: 'loop_tracing',
        skill_slug: 'problem-solving',
        mastery_status: 'novice',
        problems_attempted: 3,
        problems_solved: 1,
      },
    });

    assert.equal(action.type, 'PRACTICE');
    assert.equal(action.route, 'learn');
    assert.equal(action.buttonLabel, 'Practice Weak Concept');
    assert.equal(action.conceptId, 'loop_tracing');
    assert.equal(action.journeyStage, 'SKILLS');
    assert.ok(action.explanation.includes('difficulty with loop tracing'));
  });

  it('Scenario 5: Student with an in-progress lesson is guided to resume the lesson', async () => {
    const action = await determineNextAction('user-5', {
      profile: {
        userId: 'user-5',
        onboardingCompleted: true,
        primaryFocusSkill: 'problem-solving',
      },
      activeAssessment: null,
      evidenceCount: 5,
      weakConcept: null,
      inProgressLesson: {
        lesson_id: 'ps-loop-tracing',
        exercises_completed: 1,
      },
    });

    assert.equal(action.type, 'LESSON');
    assert.equal(action.route, 'learn');
    assert.equal(action.buttonLabel, 'Resume Lesson');
    assert.equal(action.lessonId, 'ps-loop-tracing');
    assert.equal(action.journeyStage, 'SKILLS');
  });

  it('Scenario 6: Student with completed lessons is guided to practical project implementation', async () => {
    const action = await determineNextAction('user-6', {
      profile: {
        userId: 'user-6',
        onboardingCompleted: true,
        primaryFocusSkill: 'problem-solving',
      },
      activeAssessment: null,
      evidenceCount: 12,
      weakConcept: null,
      inProgressLesson: null,
      completedLessonIds: LESSONS_CATALOG.map((l) => l.id),
    });

    assert.equal(action.type, 'PROJECT');
    assert.equal(action.route, 'projects');
    assert.equal(action.buttonLabel, 'Open Project Workspace');
    assert.equal(action.journeyStage, 'READINESS');
    assert.equal(action.journeyStep, 5);
    assert.ok(action.whatHappensWhenFinished.includes('Passport'));
  });
});
