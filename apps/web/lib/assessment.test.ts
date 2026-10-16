import test from 'node:test';
import assert from 'node:assert/strict';
import { answeredCount, nextUnanswered, totalQuestions } from './assessment.ts';

const items = [
  { skill_slug: 'sql', prompt: { id: 'a' }, response: { choice: 1 } },
  { skill_slug: 'rest-apis', prompt: { id: 'b' }, response: null },
  { skill_slug: 'sql', prompt: { id: 'c' }, response: null },
];

test('resume picks the first unanswered item in position order', () => {
  assert.deepEqual(nextUnanswered(items)?.prompt, { id: 'b' });
  assert.equal(answeredCount(items), 1);
});

test('total is two questions per distinct skill and stays fixed as follow-ups are added', () => {
  assert.equal(totalQuestions(items.slice(0, 2)), 4);
  assert.equal(totalQuestions(items), 4);
});

test('a finished assessment has nothing left to resume', () => {
  assert.equal(nextUnanswered(items.map((i) => ({ ...i, response: { choice: 0 } }))), undefined);
});
