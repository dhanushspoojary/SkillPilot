import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackScore, parseScores } from './interview.ts';

test('parseScores parses a clean array', () => {
  const out = parseScores('[{"position":1,"score":70,"feedback":"ok"},{"position":2,"score":40,"feedback":"thin"}]', 2);
  assert.equal(out?.length, 2);
  assert.equal(out?.[0].score, 70);
});

test('parseScores clamps scores and rejects wrong count', () => {
  const out = parseScores('noise [{"position":1,"score":140,"feedback":"x"}] tail', 1);
  assert.equal(out?.[0].score, 100);
  assert.equal(parseScores('[{"position":1,"score":70}]', 2), null);
  assert.equal(parseScores('no scores here', 1), null);
});

test('parseScores rejects duplicate or reordered positions', () => {
  assert.equal(parseScores('[{"position":1,"score":70},{"position":1,"score":60}]', 2), null);
  assert.equal(parseScores('[{"position":2,"score":70},{"position":1,"score":60}]', 2), null);
});

test('fallbackScore gives structured answers more credit', () => {
  assert.ok(fallbackScore('').score <= 5);
  const strong = fallbackScore('First I would profile because the symptom is slow queries. For example, an index. However, trade-offs exist. Then I would measure.');
  assert.ok(strong.score > 30);
});
