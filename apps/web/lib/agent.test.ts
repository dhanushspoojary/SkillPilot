import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTool, handleAgentRequest, runAgent, MAX_STEPS, type ModelCall } from './agent.ts';
import { defaultState } from './engine.ts';
const use = (id: string, name: string, input: unknown = {}) => ({ content: [{ type: 'tool_use' as const, id, name, input }], stop_reason: 'tool_use' });
const say = (text: string) => ({ content: [{ type: 'text' as const, text }], stop_reason: 'end_turn' });
const scripted = (...turns: Awaited<ReturnType<ModelCall>>[]): ModelCall => { let i = 0; return async () => turns[i++]; };
test('agent reads tools, proposes, and never mutates state', async () => {
    const state = defaultState();
    const before = JSON.stringify(state);
    const out = await runAgent(state, 'what next?', scripted(use('1', 'get_profile'), use('2', 'propose_retest', { skill_id: 'rest-apis', reason: 'largest gap' }), say('Retest REST APIs.')));
    assert.equal(JSON.stringify(state), before);
    assert.equal(out.steps.length, 2);
    assert.equal(out.proposals[0].type, 'start_retest');
    assert.equal(out.proposals[0].permission, 'approval_required');
});
test('there is no tool that can change a score or send a message', () => {
    for (const name of ['set_score', 'verify_skill', 'send_message', 'publish_passport']) {
        const r = executeTool(name, { skill_id: 'rest-apis', score: 100 }, defaultState());
        assert.match(r.result, /unknown tool/);
        assert.equal(r.proposal, undefined);
    }
});
test('invalid tool arguments are rejected, not trusted', () => {
    const s = defaultState();
    assert.equal(executeTool('propose_retest', { skill_id: 'javascript', reason: 'x' }, s).proposal, undefined);
    assert.equal(executeTool('propose_action', { action_id: 'FAKE:1', reason: 'x' }, s).proposal, undefined);
    assert.equal(executeTool('propose_mentor_request', { mentor_id: 'zz', message: 'hi' }, s).proposal, undefined);
    assert.equal(executeTool('propose_mentor_request', { mentor_id: 'an', message: 'x'.repeat(601) }, s).proposal, undefined);
});
test('a looping model is stopped at the step cap', async () => {
    const loop: ModelCall = async () => use('x', 'get_profile');
    await assert.rejects(runAgent(defaultState(), 'hi', loop), /step_limit/);
    assert.ok(MAX_STEPS <= 8);
});
test('without an API key the deterministic plan is returned', async () => {
    const r = await handleAgentRequest({ question: 'help', state: defaultState() }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
    assert.equal((r.body as any).mode, 'fallback');
    assert.equal((r.body as any).proposals[0].permission, 'approval_required');
});
test('provider failure degrades to fallback; success returns ai mode', async () => {
    const bad = (async () => new Response('x', { status: 529 })) as typeof fetch;
    const r1 = await handleAgentRequest({ question: 'help', state: defaultState() }, { apiKey: 'k', model: 'm', fetchImpl: bad });
    assert.equal((r1.body as any).mode, 'fallback');
    assert.equal((r1.body as any).fallbackReason, 'provider_529');
    const ok = (async () => new Response(JSON.stringify(say('All good.')), { status: 200 })) as typeof fetch;
    const r2 = await handleAgentRequest({ question: 'help', state: defaultState() }, { apiKey: 'k', model: 'm', fetchImpl: ok });
    assert.equal((r2.body as any).mode, 'ai');
});
test('bad input is rejected and tampered state falls back to defaults', async () => {
    assert.equal((await handleAgentRequest({ question: '' }, { model: 'm', fetchImpl: fetch })).status, 400);
    assert.equal((await handleAgentRequest({ question: 'x'.repeat(501) }, { model: 'm', fetchImpl: fetch })).status, 400);
    const r = await handleAgentRequest({ question: 'hi', state: { v: 1, evidence: [{ skill: 'sql', score: 9999, confidence: 'x' }], activity: [], requests: [] } }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
});
