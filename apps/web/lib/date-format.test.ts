import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSafeTime, formatSafeDate, formatSafeDateTime } from './date-format.ts';

test('formatSafeTime parses valid ISO strings and timestamps correctly', () => {
  const iso = '2026-10-18T10:30:00.000Z';
  const formatted = formatSafeTime(iso);
  assert.ok(formatted.length > 0);
  assert.notEqual(formatted, 'Invalid Date');

  const ts = 1760773800000;
  const fromTs = formatSafeTime(ts);
  assert.ok(fromTs.length > 0);
  assert.notEqual(fromTs, 'Invalid Date');
});

test('formatSafeTime gracefully handles invalid, undefined, and null values without throwing or returning Invalid Date', () => {
  assert.equal(formatSafeTime(undefined), '');
  assert.equal(formatSafeTime(null), '');
  assert.equal(formatSafeTime(''), '');
  assert.equal(formatSafeTime('not-a-date'), '');
  assert.equal(formatSafeTime(NaN), '');
  assert.equal(formatSafeTime(undefined, 'N/A'), 'N/A');
  assert.equal(formatSafeTime('invalid', '--:--'), '--:--');
});

test('formatSafeDate parses valid dates and falls back cleanly on invalid input', () => {
  const iso = '2026-10-18T10:30:00.000Z';
  const formatted = formatSafeDate(iso);
  assert.ok(formatted.includes('2026'));
  assert.notEqual(formatted, 'Invalid Date');

  assert.equal(formatSafeDate(undefined), '');
  assert.equal(formatSafeDate(null), '');
  assert.equal(formatSafeDate('gibberish'), '');
  assert.equal(formatSafeDate('gibberish', 'Pending'), 'Pending');
});

test('formatSafeDateTime formats combined date and time safely', () => {
  const iso = '2026-10-18T10:30:00.000Z';
  const formatted = formatSafeDateTime(iso);
  assert.ok(formatted.length > 5);
  assert.notEqual(formatted, 'Invalid Date');
  assert.equal(formatSafeDateTime(null), '');
});
