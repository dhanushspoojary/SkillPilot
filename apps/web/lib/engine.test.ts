import test from 'node:test';
import assert from 'node:assert/strict';
import {
    defaultState,
    planActions,
    readiness,
    skillStates,
    toggleActivity,
    parseState,
    parseStateStrict,
    getCareerGoal,
    resolveSkillOrder,
    SKILLS,
    type Evidence,
} from './engine.ts';

test('new accounts start with no seeded evidence', () => {
    assert.equal(defaultState().evidence.length, 0);
    assert.equal(defaultState().requests.length, 0);
});

test('readiness is derived from evidence, not clicks', () => {
    const base = defaultState();
    const r0 = readiness(skillStates(base.evidence));
    const a = planActions(base)[0];
    const done = toggleActivity(base, a, '2026-02-01T00:00:00.000Z');
    assert.equal(readiness(skillStates(done.evidence)), r0);
});

test('a build action never creates evidence', () => {
    const s = defaultState();
    const a = planActions(s).find((x) => x.kind === 'BUILD')!;
    const n = toggleActivity(s, a, new Date().toISOString());
    assert.equal(n.evidence.length, 0);
});

test('strict parser accepts an empty authoritative profile', () => {
    assert.ok(parseStateStrict(JSON.stringify(defaultState())));
    assert.equal(parseStateStrict('{"v":2,"evidence":[]}'), null);
});

test('malformed browser state falls back to an empty profile', () => {
    assert.equal(parseState('{bad').evidence.length, 0);
    assert.equal(parseState(JSON.stringify({ ...defaultState(), name: 'Asha' })).name, 'Asha');
});

test('weighted readiness rises only after evidence is present', () => {
    const s = defaultState();
    const before = readiness(skillStates(s.evidence));
    const after = {
        ...s,
        evidence: [
            {
                id: 'server-e1',
                skill: 'rest-apis',
                kind: 'assessment' as const,
                score: 80,
                confidence: 0.55,
                at: new Date().toISOString(),
                label: 'Server scored',
            },
        ],
    };
    assert.ok(readiness(skillStates(after.evidence)) > before);
});

test('repeated assessment evidence is capped to the latest two signals', () => {
    const evidence = [1, 2, 3, 4].map((n) => ({
        id: `uuid-${n}`,
        skill: 'sql',
        kind: 'assessment' as const,
        score: n === 4 ? 100 : 0,
        confidence: 0.55,
        at: `2026-10-0${n}T00:00:00Z`,
        label: 'assessment',
        metadata: { assessmentId: `a-${n}` },
    }));
    const state = skillStates(evidence).find((s) => s.def.id === 'sql')!;
    assert.equal(state.count, 2);
    assert.equal(state.score, 50);
});

test('numeric strings and Date objects from the database do not corrupt scores', () => {
    const mk = (id: string, kind: string, score: unknown, confidence: unknown, at: unknown) =>
        ({ id, skill: 'sql', kind, score, confidence, at, label: 'x' }) as any;
    const one = [mk('1', 'assessment', '80.00', '0.550', '2026-10-01T00:00:00Z')];
    const two = [...one, mk('2', 'mentor', '90.00', '0.650', new Date('2026-10-02T00:00:00Z'))];
    const sql = (ev: any[]) => skillStates(ev).find((s) => s.def.id === 'sql')!;
    assert.equal(sql(one).score, 80);
    assert.equal(sql(two).score, Math.round((80 * 0.55 + 90 * 0.65) / 1.2));
    assert.equal(sql(two).count, 2);
});

// --- Phase 8 Required Unit Tests ---

test('roadmap engine: no assessment completed recommends diagnostic or foundational actions', () => {
    const s = defaultState();
    const actions = planActions(s);
    assert.ok(actions.length > 0, 'Plan should contain initial recommended actions');
    // Without evidence, readiness should be 0
    assert.equal(readiness(skillStates(s.evidence)), 0);
    // Highest priority should be an assessable action
    assert.ok(actions.some((a) => a.kind === 'BUILD' || a.kind === 'PROVE'));
});

test('roadmap engine: all required skills already strong produces empty or clear plan', () => {
    // Verified requires 3+ items from 2+ distinct source kinds
    const strongEvidence: Evidence[] = [];
    for (const skill of SKILLS) {
        strongEvidence.push(
            { id: `e1-${skill.id}`, skill: skill.id, kind: 'assessment', score: 100, confidence: 0.55, at: '2026-10-01T00:00:00Z', label: 'Diagnostic' },
            { id: `e2-${skill.id}`, skill: skill.id, kind: 'mentor', score: 95, confidence: 0.65, at: '2026-10-02T00:00:00Z', label: 'Mentor Review' },
            { id: `e3-${skill.id}`, skill: skill.id, kind: 'project', score: 90, confidence: 0.5, at: '2026-10-03T00:00:00Z', label: 'Project Evidence' }
        );
    }
    const s = { ...defaultState(), evidence: strongEvidence };
    const actions = planActions(s);
    assert.equal(actions.length, 0, 'No actions needed when all required skills are strong and verified');
    assert.ok(readiness(skillStates(s.evidence)) >= 90, 'Readiness should be near 100%');
});

test('roadmap engine: unknown career goal falls back gracefully to default goal', () => {
    const fallback = getCareerGoal('Nonexistent Architect Role');
    assert.equal(fallback.role, 'Software Engineer', 'Should fall back to default role');
    assert.ok(fallback.requiredSkills.includes('javascript'));
    assert.ok(fallback.requiredSkills.includes('rest-apis'));

    const s = defaultState();
    const actionsWithUnknown = planActions(s, 'Nonexistent Role');
    const actionsWithDefault = planActions(s, 'Software Engineer');
    assert.deepEqual(actionsWithUnknown, actionsWithDefault);
});

test('roadmap engine: missing skill dependencies are handled safely', () => {
    // Prerequisite map references skills that are not in the requested list
    const order = resolveSkillOrder(['rest-apis'], { 'rest-apis': ['missing-dep-skill'] });
    assert.deepEqual(order, ['rest-apis'], 'Missing prerequisite should not break resolution');
});

test('roadmap engine: circular dependencies are broken gracefully without infinite recursion', () => {
    const circular = {
        skillA: ['skillB'],
        skillB: ['skillC'],
        skillC: ['skillA'],
    };
    const order = resolveSkillOrder(['skillA', 'skillB', 'skillC'], circular);
    assert.equal(order.length, 3, 'All skills should be returned despite cycle');
    assert.ok(new Set(order).size === 3, 'All skills must be unique');
});

test('roadmap engine: incomplete roadmap tasks remain in plan until completed', () => {
    const s = defaultState();
    const actionsBefore = planActions(s);
    const buildTask = actionsBefore.find((a) => a.kind === 'BUILD')!;
    assert.ok(buildTask, 'Should have at least one BUILD task');

    // Toggle activity to completed
    const sDone = toggleActivity(s, buildTask, new Date().toISOString());
    const actionsAfter = planActions(sDone);
    assert.ok(!actionsAfter.some((a) => a.id === buildTask.id), 'Completed task should be removed from future plan');

    // Untoggle / incomplete task
    const sIncomplete = toggleActivity(sDone, buildTask, new Date().toISOString());
    const actionsRestored = planActions(sIncomplete);
    assert.ok(actionsRestored.some((a) => a.id === buildTask.id), 'Incomplete task should reappear in the plan');
});

test('roadmap engine: new assessment results adjust gaps and roadmap priorities', () => {
    const s = defaultState();
    const initialActions = planActions(s);
    const initialTop = initialActions[0];

    // Add high score evidence for the initial top priority skill
    const newEvidence: Evidence = {
        id: 'new-diag',
        skill: initialTop.skill,
        kind: 'assessment',
        score: 95,
        confidence: 0.55,
        at: new Date().toISOString(),
        label: 'Assessment',
    };

    const sUpdated = { ...s, evidence: [newEvidence] };
    const updatedSkills = skillStates(sUpdated.evidence);
    const updatedSkillState = updatedSkills.find((k) => k.def.id === initialTop.skill)!;

    assert.ok(updatedSkillState.gap < updatedSkillState.def.target, 'Skill gap should shrink after high score');
    const updatedActions = planActions(sUpdated);
    // The previous skill gap has reduced, so priority changes or shifts to remaining gaps
    assert.notDeepEqual(initialActions, updatedActions, 'Plan should adapt to new assessment evidence');
});

test('roadmap engine: changed skill levels reflect in readiness calculation', () => {
    const s0 = defaultState();
    const r0 = readiness(skillStates(s0.evidence));

    const sLow = {
        ...s0,
        evidence: [{ id: 'e-low', skill: 'sql', kind: 'assessment' as const, score: 30, confidence: 0.55, at: '2026-10-01T00:00:00Z', label: 'Diagnostic' }],
    };
    const rLow = readiness(skillStates(sLow.evidence));

    const sHigh = {
        ...s0,
        evidence: [{ id: 'e-high', skill: 'sql', kind: 'assessment' as const, score: 95, confidence: 0.55, at: '2026-10-01T00:00:00Z', label: 'Diagnostic' }],
    };
    const rHigh = readiness(skillStates(sHigh.evidence));

    assert.ok(rLow > r0, 'Any evidence increases readiness above zero baseline');
    assert.ok(rHigh > rLow, 'Higher skill level must produce higher readiness');
});

test('roadmap engine: reassessment after previously completed tasks triggers retest action', () => {
    // Student has a baseline assessment with a low score
    const s0 = {
        ...defaultState(),
        evidence: [
            { id: 'diag-1', skill: 'javascript', kind: 'assessment' as const, score: 40, confidence: 0.55, at: '2026-10-01T10:00:00Z', label: 'Diagnostic' }
        ],
    };

    // Completing a BUILD task for javascript after the assessment
    const buildAction = { id: 'BUILD:javascript', skill: 'javascript', kind: 'BUILD' as const, at: '2026-10-01T12:00:00Z' };
    const sWorked = toggleActivity(s0, buildAction, buildAction.at);

    const actions = planActions(sWorked);
    const retestAction = actions.find((a) => a.id === 'PROVE:javascript');

    assert.ok(retestAction, 'Should recommend PROVE:javascript after doing the build work');
    assert.ok(retestAction.title.includes('Retest'), 'Action should specifically be a Retest action');
    assert.equal(retestAction.route, 'assess');
});
