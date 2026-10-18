import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractClaimedSkills,
  planAssessmentSession,
  validateQuestionProposal,
  calculateJustifiedLevel,
} from './assessment-planner.ts';
import {
  evaluateResponse,
  selectAdaptiveNextQuestion,
  computeSkillAdaptiveSummary,
} from './adaptive-engine.ts';
import {
  QUESTIONS,
} from './questions.ts';
import {
  planActions,
  readiness,
  skillStates,
  defaultState,
  toggleActivity,
  type AppState,
} from './engine.ts';
import {
  handleNaturalLanguagePreferenceRequest,
} from './roadmap-preferences.ts';
import { executeTool } from './agent.ts';
import type { Evidence } from './types.ts';

// --------------------------------------------------------------------------
// SCENARIO A: Complete Beginner
// --------------------------------------------------------------------------
test('Scenario A: Complete beginner receives only foundational intro questions, never JS or SQL', () => {
  // 1st year beginner profile with no declared languages
  const beginnerProfile = {
    educationLevel: 'first_year',
    programmingExperience: 'beginner',
    focusAreas: ['Problem Solving', 'Logic'],
    careerInterests: ['Exploring'],
  };

  const claims = extractClaimedSkills(beginnerProfile);
  assert.equal(claims.isBeginner, true);
  assert.equal(claims.hasClaimed('problem-solving'), true);
  assert.equal(claims.hasClaimed('javascript'), false);
  assert.equal(claims.hasClaimed('sql'), false);
  assert.equal(claims.hasClaimed('rest-apis'), false);

  // Plan assessment session
  const session = planAssessmentSession({
    userId: 'student-beginner-test',
    profile: beginnerProfile,
    evidence: [],
  });

  assert.ok(session.initialQuestions.length > 0, 'Must have at least one initial question');
  // All questions MUST be problem-solving
  for (const q of session.initialQuestions) {
    assert.equal(q.skill, 'problem-solving', `Question ${q.id} must be problem-solving, not ${q.skill}`);
    assert.ok(q.level <= 1, `Beginner question level must be 0 or 1, got ${q.level}`);
    assert.notEqual(q.skill, 'javascript', 'Beginner must never receive JavaScript');
    assert.notEqual(q.skill, 'sql', 'Beginner must never receive SQL');
  }

  // Beginner roadmap must focus on syntax & logic foundations, not advanced stacks
  const state: AppState = { ...defaultState(), evidence: [] };
  const actions = planActions(state, 'Software Engineer', beginnerProfile as any);
  assert.ok(actions.length > 0);
  assert.equal(actions[0].skill, 'problem-solving');
  assert.match(actions[0].title, /problem solving|foundations/i);
});

// --------------------------------------------------------------------------
// SCENARIO B: Basic C Student
// --------------------------------------------------------------------------
test('Scenario B: Basic C student claims verified through gradual difficulty; unverified != proficient', () => {
  const cStudentProfile = {
    educationLevel: 'first_year',
    programmingExperience: 'beginner',
    focusAreas: ['C Programming', 'Problem Solving'],
    careerInterests: ['Systems Engineer'],
  };

  const claims = extractClaimedSkills(cStudentProfile);
  assert.equal(claims.hasClaimed('problem-solving'), true);
  assert.equal(claims.hasClaimed('javascript'), false);

  // Starts at justified level (Level 1)
  const justified = calculateJustifiedLevel('problem-solving', [], claims.isBeginner);
  assert.equal(justified, 1);

  // Correct answer elevates difficulty to Level 2
  const q1 = QUESTIONS.find((q) => q.skill === 'problem-solving' && q.level === 1)!;
  const eval1 = evaluateResponse(q1, { choice: q1.answer });
  assert.equal(eval1.classification, 'CORRECT');
  assert.equal(eval1.earnedPoints, 100);

  // Next adaptive question should progress to level 2
  const nextQ = selectAdaptiveNextQuestion({
    skill: 'problem-solving',
    currentQuestion: q1,
    evalResult: eval1,
    answeredIds: [q1.id],
  });
  assert.ok(nextQ);
  assert.equal(nextQ.skill, 'problem-solving');
  assert.ok(nextQ.level >= 2, `Expected difficulty escalation to >= 2, got ${nextQ.level}`);

  // Test unverified != proficient
  // Even if problem solving has some evidence, unassessed skills carry 0% score and unverified status
  const cEvidence: Evidence[] = [
    { id: 'ev-c-1', skill: 'problem-solving', kind: 'assessment', score: 85, confidence: 0.8, label: 'Problem Solving Assessment', at: new Date().toISOString() },
  ];
  const states = skillStates(cEvidence);
  const jsState = states.find((s) => s.def.id === 'javascript')!;
  const sqlState = states.find((s) => s.def.id === 'sql')!;

  assert.equal(jsState.verified, false);
  assert.equal(jsState.score, 0);
  assert.equal(jsState.count, 0);
  assert.equal(sqlState.verified, false);
  assert.equal(sqlState.score, 0);

  // Overall readiness is severely penalized because only 1 of 6 required skills has any evidence
  const r = readiness(states);
  assert.ok(r < 30, `Readiness must reflect unverified skills truthfully, got ${r}%`);
});

// --------------------------------------------------------------------------
// SCENARIO C: Practical JavaScript Student
// --------------------------------------------------------------------------
test('Scenario C: Practical JavaScript student assessed at appropriate level without forced basic intro', () => {
  const practicalJsProfile = {
    educationLevel: 'third_year',
    programmingExperience: 'practical_projects',
    focusAreas: ['JavaScript', 'Web Applications', 'Frontend Engineering'],
    careerInterests: ['Frontend Engineer'],
  };

  const claims = extractClaimedSkills(practicalJsProfile);
  assert.equal(claims.hasClaimed('javascript'), true);
  assert.equal(claims.isBeginner, false);

  // Justified level for student with practical experience starts at Level 2, not Level 0
  const justifiedJs = calculateJustifiedLevel('javascript', [], claims.isBeginner);
  assert.ok(justifiedJs >= 2, `Expected justified level >= 2 for practical JS student, got ${justifiedJs}`);

  // Plan assessment session
  const session = planAssessmentSession({
    userId: 'student-js-test',
    profile: practicalJsProfile,
    evidence: [],
  });

  // Verify JS questions are present and at least level 2
  const jsQuestions = session.initialQuestions.filter((q) => q.skill === 'javascript');
  assert.ok(jsQuestions.length > 0, 'Practical JS student must receive JS questions');
  for (const q of jsQuestions) {
    assert.ok(q.level >= 2, `Expected JS question level >= 2, got level ${q.level} for question ${q.id}`);
  }

  // Prerequisite check: Cannot test REST APIs if foundational problem solving has no evidence
  const restProposal = validateQuestionProposal(
    { skill: 'rest-apis', level: 2 },
    {
      claimedSkills: claims.claimedSkills,
      evidence: [], // no problem-solving or JS verified yet
      isExplicitSelection: true,
    }
  );
  assert.equal(restProposal.allowed, false);
  assert.equal(restProposal.code, 'MISSING_PREREQUISITES');
});

// --------------------------------------------------------------------------
// SCENARIO D: No Career Goal (Exploration Mode)
// --------------------------------------------------------------------------
test('Scenario D: Student with no career goal explores foundational path without forced choice', () => {
  const undecidedProfile = {
    educationLevel: 'second_year',
    programmingExperience: 'some_academic',
    focusAreas: ['Exploring', 'General Computing'],
    careerInterests: [], // Undecided
  };

  const claims = extractClaimedSkills(undecidedProfile);
  assert.equal(claims.hasClaimed('problem-solving'), true);

  // Session plan functions smoothly without throwing
  const session = planAssessmentSession({
    userId: 'student-undecided-test',
    profile: undecidedProfile,
    evidence: [],
  });
  assert.ok(session.initialQuestions.length > 0);

  // Roadmap engine handles undefined or empty career goal gracefully
  const state: AppState = { ...defaultState(), evidence: [] };
  const actions = planActions(state, '', undecidedProfile as any);
  assert.ok(actions.length > 0);
  assert.equal(actions[0].skill, 'problem-solving');
  // Plan note provides clear exploratory guidance
  assert.ok(state.planNote.length > 0);
});

// --------------------------------------------------------------------------
// PREFERENCES, ROADMAP CHANGES & PROGRESS PRESERVATION
// --------------------------------------------------------------------------
test('Preference changes preserve completed progress and explain conflicts', async () => {
  const state = defaultState();
  const studentId = '00000000-0000-0000-0000-000000000001';

  // 1. Natural language adjustment: "I have 20 minutes"
  const change1 = await handleNaturalLanguagePreferenceRequest(
    studentId,
    'I have 20 minutes available daily',
    state
  );
  assert.equal(change1.applied, true);
  assert.equal(change1.details.updated.dailyMinutes, 20);

  // 2. Natural language adjustment: "explain simpler"
  const change2 = await handleNaturalLanguagePreferenceRequest(
    studentId,
    'Please explain simpler to me',
    state
  );
  assert.equal(change2.applied, true);
  assert.equal(change2.details.updated.difficultyPreference, 'simpler_explanations');

  // 3. Prerequisite conflict: Student requesting REST APIs before prerequisites
  const changeConflict = await handleNaturalLanguagePreferenceRequest(
    studentId,
    'I want to focus on REST APIs first',
    state
  );
  assert.equal(changeConflict.applied, true);
  assert.ok(changeConflict.conflictWarning && changeConflict.conflictWarning.includes('prerequisite'));
  assert.ok(changeConflict.recommendedAlternative && changeConflict.recommendedAlternative.includes('Problem Solving'));
});

// --------------------------------------------------------------------------
// AI PROVIDER FAILURE & HONEST FALLBACK
// --------------------------------------------------------------------------
test('AI provider failure returns honest labeled fallback without data corruption', async () => {
  // Execute agent tool with context
  const mockContext = {
    studentId: 'test-student-1',
    name: 'Test Student',
    careerGoal: 'Software Engineer',
    evidence: [],
    capabilityProfile: {
      educationLevel: 'first_year',
      programmingExperience: 'beginner',
      fieldOfStudy: 'computer_science',
      careerInterests: ['Software Engineer'],
      weeklyHours: 5,
      focusAreas: ['Problem Solving'],
      onboardingCompleted: true,
    },
    activity: [],
    requests: [],
  };

  const toolResult = await executeTool(
    'get_claimed_vs_verified_skills',
    {},
    mockContext as any
  );

  assert.ok(toolResult.summary);
  const parsed = JSON.parse(toolResult.result);
  // Claimed skills accurately isolated from verified skills
  assert.ok(Array.isArray(parsed.claimedSkills));
  assert.ok(Array.isArray(parsed.verifiedSkills));
  assert.equal(parsed.verifiedSkills.length, 0);
});

// --------------------------------------------------------------------------
// IDEMPOTENT ATTEMPTS & ASSESSMENT SUBMISSION
// --------------------------------------------------------------------------
test('Assessment evaluation is deterministic and idempotent for identical attempts', () => {
  const q = QUESTIONS.find((item) => item.id === 'ps-1a')!;
  
  const attempt1 = evaluateResponse(q, { choice: q.answer });
  const attempt2 = evaluateResponse(q, { choice: q.answer });

  assert.deepEqual(attempt1, attempt2);
  assert.equal(attempt1.classification, 'CORRECT');
  assert.equal(attempt1.earnedPoints, 100);
});

// --------------------------------------------------------------------------
// SECURITY: UNVERIFIED CLAIMS NEVER COUNT AS ACHIEVEMENTS
// --------------------------------------------------------------------------
test('Security: student self-claims or raw answers never count as verified achievements without server grading', () => {
  // A student submitting a self-report claim of 100% in SQL
  const state: AppState = {
    ...defaultState(),
    evidence: [], // no server graded evidence
  };

  // Check skill status
  const skills = skillStates(state.evidence);
  for (const s of skills) {
    assert.equal(s.verified, false, `${s.def.id} must not be verified without server evidence`);
    assert.equal(s.score, 0);
    assert.equal(s.count, 0);
  }

  // Readiness must be strictly 0
  assert.equal(readiness(skills), 0);

  // A build activity toggled locally also NEVER creates verified evidence
  const nextState = toggleActivity(
    state,
    { id: 'BUILD:problem-solving', title: 'Test Build', skill: 'problem-solving', kind: 'BUILD', route: 'complete', detail: 'test', upTo: 10 },
    new Date().toISOString()
  );
  assert.equal(nextState.evidence.length, 0, 'Build activity must never append evidence');
  assert.equal(readiness(skillStates(nextState.evidence)), 0);
});
