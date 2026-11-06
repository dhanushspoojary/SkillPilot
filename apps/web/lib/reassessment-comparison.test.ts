import test from 'node:test';
import assert from 'node:assert/strict';

export interface AssessmentComparison {
  previousScore: number;
  currentScore: number;
  delta: number;
  previousCapturedAt?: string;
}

export function computeReassessmentComparison(params: {
  currentScore: number;
  priorEvidence: Array<{ score: number | string; captured_at: string; kind?: string; source?: string }>;
}): AssessmentComparison | null {
  const { currentScore, priorEvidence } = params;
  const validPriors = priorEvidence
    .filter((e) => (e.kind === 'assessment' || e.source === 'assessment') && e.score !== null && !isNaN(Number(e.score)))
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at));

  if (validPriors.length === 0) {
    return null; // First-time assessment: handle gracefully without misleading comparison
  }

  const mostRecent = validPriors[0];
  const previousScore = Math.round(Number(mostRecent.score));
  const delta = currentScore - previousScore;

  return {
    previousScore,
    currentScore,
    delta,
    previousCapturedAt: mostRecent.captured_at,
  };
}

test('Reassessment Comparison — First-time assessment returns null (no misleading comparison)', () => {
  const comp = computeReassessmentComparison({
    currentScore: 80,
    priorEvidence: [],
  });
  assert.equal(comp, null, 'First-time assessment must return null without inventing prior scores');
});

test('Reassessment Comparison — Correctly compares same skill using most recent previous score', () => {
  const priorEvidence = [
    { source: 'assessment', score: 50, captured_at: '2026-11-01T10:00:00Z' },
    { source: 'assessment', score: 65, captured_at: '2026-11-03T14:30:00Z' }, // Most recent
    { source: 'practice', score: 90, captured_at: '2026-11-04T09:00:00Z' }, // Non-assessment ignored
  ];

  const comp = computeReassessmentComparison({
    currentScore: 85,
    priorEvidence,
  });

  assert.notEqual(comp, null);
  assert.equal(comp?.previousScore, 65, 'Must compare against the most recent assessment (65%), not older one (50%)');
  assert.equal(comp?.currentScore, 85);
  assert.equal(comp?.delta, 20, 'Delta must equal 85 - 65 = +20');
  assert.equal(comp?.previousCapturedAt, '2026-11-03T14:30:00Z');
});

test('Reassessment Comparison — Handles negative score shift and unchanged scores accurately', () => {
  const compDrop = computeReassessmentComparison({
    currentScore: 60,
    priorEvidence: [{ source: 'assessment', score: 75, captured_at: '2026-11-02T10:00:00Z' }],
  });
  assert.equal(compDrop?.delta, -15);

  const compSame = computeReassessmentComparison({
    currentScore: 75,
    priorEvidence: [{ source: 'assessment', score: 75, captured_at: '2026-11-02T10:00:00Z' }],
  });
  assert.equal(compSame?.delta, 0);
});

