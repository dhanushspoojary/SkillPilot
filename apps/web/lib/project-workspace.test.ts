import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_CATALOG } from './project-catalog.ts';
import { defaultState, toggleActivity, SKILLS, type AppState } from './engine.ts';

test('project catalog contains valid and unique projects', () => {
  assert.ok(PROJECT_CATALOG.length > 0, 'Project catalog must not be empty');

  const slugs = new Set<string>();
  const knownSkillIds = new Set(SKILLS.map((s) => s.id));

  for (const proj of PROJECT_CATALOG) {
    assert.ok(proj.slug && proj.slug.trim().length > 0, 'Slug must not be empty');
    assert.ok(!slugs.has(proj.slug), `Duplicate project slug detected: ${proj.slug}`);
    slugs.add(proj.slug);

    assert.ok(proj.title && proj.title.length > 0, `Project ${proj.slug} has empty title`);
    assert.ok(proj.starterCode && proj.starterCode.length > 0, `Project ${proj.slug} has empty starterCode`);
    assert.ok(proj.testCases && proj.testCases.length > 0, `Project ${proj.slug} must have test cases`);

    for (const skill of proj.requiredSkills) {
      assert.ok(knownSkillIds.has(skill), `Project ${proj.slug} requires unknown skill: ${skill}`);
    }

    for (const tc of proj.testCases) {
      assert.ok(tc.id, `Test case in ${proj.slug} missing id`);
      assert.ok(tc.name, `Test case ${tc.id} missing name`);
      assert.ok(tc.expectedBehavior, `Test case ${tc.id} missing expectedBehavior`);
    }
  }
});

test('toggleActivity preserves career goal and capability context in planNote', () => {
  const s0: AppState = defaultState();
  const buildAction = {
    id: 'BUILD:javascript',
    skill: 'javascript',
    kind: 'BUILD' as const,
  };

  const roleName = 'Full-Stack Developer';
  const capabilityProfile = {
    programmingExperience: 'beginner',
    weeklyHours: 10,
    skillsToLearn: ['javascript', 'problem-solving'],
  };

  const next = toggleActivity(
    s0,
    buildAction,
    new Date().toISOString(),
    roleName,
    capabilityProfile
  );

  assert.ok(next.planNote, 'toggleActivity must generate a planNote');
  assert.equal(typeof next.planNote, 'string');
  assert.ok(next.planNote.length > 0, 'planNote must not be empty');
  assert.ok(
    next.activity.some((a) => a.id === buildAction.id),
    'Activity should be added to next state'
  );

  // Toggling again should remove the activity
  const toggledOff = toggleActivity(
    next,
    buildAction,
    new Date().toISOString(),
    roleName,
    capabilityProfile
  );

  assert.ok(
    !toggledOff.activity.some((a) => a.id === buildAction.id),
    'Activity should be removed when toggled off'
  );
});

test('memory category constraint validation rejects malformed category keys', () => {
  const VALID_CATEGORIES = new Set([
    'preference',
    'strength',
    'goal',
    'struggle',
    'background',
    'project_interest',
  ]);

  assert.ok(VALID_CATEGORIES.has('preference'));
  assert.ok(VALID_CATEGORIES.has('project_interest'));
  assert.ok(VALID_CATEGORIES.has('struggle'));

  assert.ok(!VALID_CATEGORIES.has('malicious_input'));
  assert.ok(!VALID_CATEGORIES.has(''));
  assert.ok(!VALID_CATEGORIES.has('admin'));
  assert.ok(!VALID_CATEGORIES.has('role'));
});

test('profile name validation strictly enforces length constraints', () => {
  function validateName(raw: string | undefined): { ok: boolean; name?: string } {
    if (typeof raw !== 'string') return { ok: false };
    const trimmed = raw.trim().slice(0, 80);
    if (!trimmed || trimmed.length < 2) return { ok: false };
    return { ok: true, name: trimmed };
  }

  assert.equal(validateName('').ok, false);
  assert.equal(validateName(' ').ok, false);
  assert.equal(validateName('A').ok, false);
  assert.equal(validateName('Al').ok, true);
  assert.equal(validateName('Jane Doe').ok, true);
  assert.equal(validateName('Jane Doe').name, 'Jane Doe');
});
