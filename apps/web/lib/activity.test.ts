import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActionId, activityFromSource } from './activity.ts';

test('only BUILD actions for known skills and MENTOR:feedback are client-reportable', () => {
  assert.deepEqual(parseActionId('BUILD:rest-apis'), { kind: 'BUILD', skill: 'rest-apis' });
  assert.deepEqual(parseActionId('MENTOR:feedback'), { kind: 'MENTOR', skill: 'communication' });
  for (const bad of ['PROVE:sql', 'BUILD:nope', 'MENTOR:other', 'BUILD:', '', 'build:sql', 'BUILD:sql; drop', 42, null, undefined]) {
    assert.equal(parseActionId(bad), null, String(bad));
  }
});

test('stored sources map back to engine activity rows', () => {
  assert.deepEqual(activityFromSource('BUILD:sql', 't'), { id: 'BUILD:sql', skill: 'sql', kind: 'BUILD', at: 't' });
  assert.deepEqual(activityFromSource('MENTOR:feedback', 't'), { id: 'MENTOR:feedback', skill: 'communication', kind: 'MENTOR', at: 't' });
  assert.equal(activityFromSource('PROVE:sql', 't')?.kind, 'PROVE');
  assert.equal(activityFromSource('garbage', 't'), null);
});
