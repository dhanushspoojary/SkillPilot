import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, planActions, readiness, skillStates, toggleActivity, parseState, parseStateStrict } from './engine.ts';
test('new accounts start with no seeded evidence', () => { assert.equal(defaultState().evidence.length, 0); assert.equal(defaultState().requests.length, 0); });
test('readiness is derived from evidence, not clicks', () => { const base = defaultState(); const r0 = readiness(skillStates(base.evidence)); const a = planActions(base)[0]; const done = toggleActivity(base, a, '2026-02-01T00:00:00.000Z'); assert.equal(readiness(skillStates(done.evidence)), r0); });
test('a build action never creates evidence', () => { const s = defaultState(); const a = planActions(s).find(x => x.kind === 'BUILD')!; const n = toggleActivity(s, a, new Date().toISOString()); assert.equal(n.evidence.length, 0); });
test('strict parser accepts an empty authoritative profile', () => { assert.ok(parseStateStrict(JSON.stringify(defaultState()))); assert.equal(parseStateStrict('{"v":2,"evidence":[]}'), null); });
test('malformed browser state falls back to an empty profile', () => { assert.equal(parseState('{bad').evidence.length, 0); assert.equal(parseState(JSON.stringify({ ...defaultState(), name: 'Asha' })).name, 'Asha'); });
test('weighted readiness rises only after evidence is present', () => { const s = defaultState(); const before = readiness(skillStates(s.evidence)); const after = { ...s, evidence: [{ id: 'server-e1', skill: 'rest-apis', kind: 'assessment' as const, score: 80, confidence: .55, at: new Date().toISOString(), label: 'Server scored' }] }; assert.ok(readiness(skillStates(after.evidence)) > before); });
test('repeated assessment evidence is capped to the latest two signals', () => {
    const evidence = [1, 2, 3, 4].map((n) => ({ id: `uuid-${n}`, skill: 'sql', kind: 'assessment' as const, score: n === 4 ? 100 : 0, confidence: .55, at: `2026-10-0${n}T00:00:00Z`, label: 'assessment', metadata: { assessmentId: `a-${n}` } }));
    const state = skillStates(evidence).find((s) => s.def.id === 'sql')!;
    assert.equal(state.count, 2);
    assert.equal(state.score, 50);
});
test('numeric strings and Date objects from the database do not corrupt scores', () => {
    const mk = (id: string, kind: string, score: unknown, confidence: unknown, at: unknown) => ({ id, skill: 'sql', kind, score, confidence, at, label: 'x' }) as any;
    const one = [mk('1', 'assessment', '80.00', '0.550', '2026-10-01T00:00:00Z')];
    const two = [...one, mk('2', 'mentor', '90.00', '0.650', new Date('2026-10-02T00:00:00Z'))];
    const sql = (ev: any[]) => skillStates(ev).find((s) => s.def.id === 'sql')!;
    assert.equal(sql(one).score, 80);
    assert.equal(sql(two).score, Math.round((80 * 0.55 + 90 * 0.65) / 1.2));
    assert.equal(sql(two).count, 2);
});
