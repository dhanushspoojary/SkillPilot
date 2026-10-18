import test from 'node:test';
import assert from 'node:assert/strict';
import { handleNaturalLanguagePreferenceRequest } from './roadmap-preferences.ts';
import { defaultState, planActions, toggleActivity } from './engine.ts';

test('natural language: "explain simpler" adjusts difficulty preference', async () => {
  const state = defaultState();
  const res = await handleNaturalLanguagePreferenceRequest('00000000-0000-0000-0000-000000000001', 'Please explain simpler to me', state);
  assert.equal(res.applied, true);
  assert.equal(res.changeType, 'difficulty');
  assert.equal(res.details.updated.difficultyPreference, 'simpler_explanations');
});

test('natural language: "I have 20 minutes" calibrates daily practice minutes', async () => {
  const state = defaultState();
  const res = await handleNaturalLanguagePreferenceRequest('00000000-0000-0000-0000-000000000001', 'I have 20 minutes available daily', state);
  assert.equal(res.applied, true);
  assert.equal(res.changeType, 'daily_minutes');
  assert.equal(res.details.updated.dailyMinutes, 20);
});

test('natural language: "focus on C first" prioritizes problem-solving', async () => {
  const state = defaultState();
  const res = await handleNaturalLanguagePreferenceRequest('00000000-0000-0000-0000-000000000001', 'I want to focus on C first', state);
  assert.equal(res.applied, true);
  assert.equal(res.changeType, 'focus_skill');
  assert.equal(res.details.updated.primaryFocusSkill, 'problem-solving');
  assert.ok(res.newTopAction?.skill === 'problem-solving');
});

test('natural language: "harder challenge" elevates difficulty', async () => {
  const state = defaultState();
  const res = await handleNaturalLanguagePreferenceRequest('00000000-0000-0000-0000-000000000001', 'Give me a harder challenge', state);
  assert.equal(res.applied, true);
  assert.equal(res.changeType, 'difficulty');
  assert.equal(res.details.updated.difficultyPreference, 'harder_challenge');
});

test('natural language: "fewer questions" adjusts pace to relaxed', async () => {
  const state = defaultState();
  const res = await handleNaturalLanguagePreferenceRequest('00000000-0000-0000-0000-000000000001', 'Can I get fewer questions in diagnostics?', state);
  assert.equal(res.applied, true);
  assert.equal(res.changeType, 'pace');
  assert.equal(res.details.updated.preferredPace, 'fewer_questions_relaxed');
});

test('natural language: prerequisite conflict is caught and explained with alternatives', async () => {
  // Student has no evidence in problem-solving or javascript, but asks to focus on REST APIs
  const state = defaultState();
  const res = await handleNaturalLanguagePreferenceRequest('00000000-0000-0000-0000-000000000001', 'I want to focus on REST APIs first', state);
  assert.equal(res.applied, true);
  assert.ok(res.conflictWarning && res.conflictWarning.includes('prerequisite'));
  assert.ok(res.recommendedAlternative && res.recommendedAlternative.includes('Problem Solving'));
  assert.equal(res.details.updated.primaryFocusSkill, 'problem-solving');
});

test('natural language: "why this?" provides prerequisite and gap justification without mutating', async () => {
  const state = defaultState();
  const res = await handleNaturalLanguagePreferenceRequest('00000000-0000-0000-0000-000000000001', 'Why this action?', state);
  assert.equal(res.applied, false);
  assert.equal(res.changeType, 'explanation');
  assert.ok(res.summary.includes('Why'));
});

test('natural language: roadmap preference changes preserve completed progress', async () => {
  const s0 = defaultState();
  const initialAction = planActions(s0).find((a) => a.kind === 'BUILD')!;
  const sWithCompleted = toggleActivity(s0, initialAction, new Date().toISOString());

  // Confirm action is recorded as completed
  assert.ok(sWithCompleted.activity.some((a) => a.id === initialAction.id));

  // Change preference to 20 minutes
  const res = await handleNaturalLanguagePreferenceRequest('00000000-0000-0000-0000-000000000001', 'I have 20 minutes', sWithCompleted);
  assert.equal(res.applied, true);

  // The completed action must still remain completed in the state and not be re-recommended
  const remainingActions = planActions(sWithCompleted);
  assert.ok(!remainingActions.some((a) => a.id === initialAction.id), 'Completed action should remain completed and excluded from new plan');
});
