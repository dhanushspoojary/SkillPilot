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

test('natural conversation: greeting receives natural reply without forced task proposal', async () => {
    const r = await handleAgentRequest({ question: 'Hello! Good morning', state: defaultState() }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    assert.match(body.answer, /Career Companion/i);
    assert.equal(body.proposals.length, 0); // No premature assignment for simple greeting!
});

test('natural conversation: first-year beginner receives foundational encouragement', async () => {
    const r = await handleAgentRequest({ question: 'Hi, I am a first-year CSE student starting from scratch.', state: defaultState() }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    assert.match(body.answer, /first year|beginner/i);
    assert.equal(body.proposals[0].type, 'start_retest');
});

test('natural conversation: weak in problem-solving guides structured practice', async () => {
    const r = await handleAgentRequest({ question: 'I know basic C, but I am weak in problem-solving.', state: defaultState() }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    assert.match(body.answer, /problem-solving/i);
});

test('agent tools: get_career_readiness_summary and prepare_passport_share', () => {
    const s = defaultState();
    const r1 = executeTool('get_career_readiness_summary', {}, s);
    assert.match(r1.result, /computedReadiness/);
    const r2 = executeTool('prepare_passport_share', {}, s);
    assert.equal(r2.proposal?.type, 'share_passport');
});

test('teaching AI: explains C programming from scratch', async () => {
    const r = await handleAgentRequest({ question: 'Teach me C from scratch.', state: defaultState() }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    assert.match(body.answer, /#include <stdio\.h>/);
    assert.match(body.answer, /int main\(\)/);
    assert.equal(body.proposals.length, 0); // Pure teaching does not modify roadmap!
});

test('teaching AI: explains pointers with simple addresses and dereference', async () => {
    const r = await handleAgentRequest({ question: 'Explain pointers in simple words.', state: defaultState() }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    assert.match(body.answer, /address/i);
    assert.match(body.answer, /dereference|\*ptr/i);
    assert.equal(body.proposals.length, 0);
});

test('teaching AI: explains arrays with zero-indexing and contiguous memory', async () => {
    const r = await handleAgentRequest({ question: 'I don\'t understand arrays.', state: defaultState() }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    assert.match(body.answer, /zero-index|contiguous/i);
    assert.equal(body.proposals.length, 0);
});

test('system capabilities: explains what SkillPilot can do without unsolicited tasks', async () => {
    const r = await handleAgentRequest({ question: 'What can you do?', state: defaultState() }, { model: 'm', fetchImpl: fetch });
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    assert.match(body.answer, /core capabilities|Concept Teaching|Adaptive Diagnostics/i);
    assert.equal(body.proposals.length, 0);
});

test('extended agent tools: inspects verified skills, skill gaps, and next step', () => {
    const s = defaultState();
    const r1 = executeTool('get_my_verified_skills', {}, s);
    assert.match(r1.summary, /verified skills/i);
    const r2 = executeTool('get_my_skill_gaps', {}, s);
    assert.match(r2.summary, /skill gaps/i);
    const r3 = executeTool('get_my_next_step', {}, s);
    assert.match(r3.result, /nextAction/);
    const r4 = executeTool('get_current_roadmap', {}, s);
    assert.match(r4.summary, /roadmap items/i);
});

test('multi-provider: OpenAI integration adapter', async () => {
    const mockOpenAiFetch = (async () => new Response(JSON.stringify({
        choices: [{ message: { content: 'OpenAI teaching response.' } }],
    }), { status: 200 })) as typeof fetch;

    const r = await handleAgentRequest(
        { question: 'Help me understand recursion.', state: defaultState() },
        { apiKey: 'sk-proj-test1234', provider: 'openai', model: 'gpt-4o', fetchImpl: mockOpenAiFetch }
    );
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'ai');
    assert.equal(body.provider, 'openai');
    assert.equal(body.answer, 'OpenAI teaching response.');
});

test('multi-provider: Gemini integration adapter', async () => {
    const mockGeminiFetch = (async () => new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Gemini career guidance response.' }] } }],
    }), { status: 200 })) as typeof fetch;

    const r = await handleAgentRequest(
        { question: 'How do I start backend engineering?', state: defaultState() },
        { apiKey: 'AIzaSyTest1234', provider: 'gemini', model: 'gemini-1.5-flash', fetchImpl: mockGeminiFetch }
    );
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'ai');
    assert.equal(body.provider, 'gemini');
    assert.equal(body.answer, 'Gemini career guidance response.');
});

test('intelligent learning tools: learning plan, practice questions, and code evaluation', () => {
    const s = defaultState();
    
    // 1. Learning Plan
    const r1 = executeTool('generate_learning_plan', { skill_id: 'rest-apis', target_hours: 12 }, s);
    assert.match(r1.summary, /12h learning plan/i);
    const plan = JSON.parse(r1.result);
    assert.equal(plan.skill, 'REST APIs');
    assert.equal(plan.milestones.length, 3);

    // 2. Practice Questions
    const r2 = executeTool('generate_practice_questions', { skill_id: 'problem-solving', difficulty: 'beginner' }, s);
    assert.match(r2.summary, /practice questions/i);
    const qData = JSON.parse(r2.result);
    assert.ok(qData.questions.length >= 1);
    assert.ok(qData.questions[0].snippet);

    // 3. Evaluate Submission
    const r3 = executeTool('evaluate_submission', { skill_id: 'problem-solving', submission: 'int *p = &x; if (p != NULL) { *p = 5; }' }, s);
    assert.match(r3.summary, /Evaluated code submission/i);
    const evalData = JSON.parse(r3.result);
    assert.ok(evalData.comprehensionCheck);

    // 4. Learning Resources
    const r4 = executeTool('search_learning_resources', { query: 'pointers' }, s);
    assert.match(r4.summary, /curated resources/i);
});

test('practical project tools: project plan generation and submission verification', () => {
    const s = defaultState();

    // 1. Project Plan
    const r1 = executeTool('generate_project_plan', { project_slug: 'rest-bookstore-service' }, s);
    assert.match(r1.summary, /Authenticated RESTful Bookstore API/i);
    assert.equal(r1.proposal?.type, 'start_project');

    // 2. Verify Project Submission (valid starter/working implementation)
    const validCode = `
      class BookstoreService {
        constructor() { this.books = [{ id: "1", title: "Clean Code", author: "Martin" }]; }
        listBooks() { return this.books; }
        getBookById(id) { return this.books.find(b => b.id === id) || null; }
        addBook(data) {
          if (!data.title || !data.author) throw new Error("Invalid payload");
          this.books.push(data);
          return data;
        }
        deleteBook(id) {
          const idx = this.books.findIndex(b => b.id === id);
          if (idx >= 0) { this.books.splice(idx, 1); return true; }
          return false;
        }
      }
    `;
    const r2 = executeTool('verify_project_submission', { project_slug: 'rest-bookstore-service', code: validCode }, s);
    assert.match(r2.summary, /checks passed/i);
    const verifyData = JSON.parse(r2.result);
    assert.equal(verifyData.verified, true);
    assert.equal(verifyData.passedCount, 4);
});

test('deterministic career intelligence: practical project inquiry and learning plan', async () => {
    // 1. Practical Project Query
    const r1 = await handleAgentRequest(
        { question: 'Tell me about the practical projects I can build.', state: defaultState() },
        { model: 'm', fetchImpl: fetch }
    );
    assert.equal(r1.status, 200);
    const body1 = r1.body as any;
    assert.match(body1.answer, /Practical Projects/i);
    assert.equal(body1.proposals[0].type, 'start_project');

    // 2. Learning Plan Query
    const r2 = await handleAgentRequest(
        { question: 'Create a learning plan for REST APIs', state: defaultState() },
        { model: 'm', fetchImpl: fetch }
    );
    assert.equal(r2.status, 200);
    const body2 = r2.body as any;
    assert.match(body2.answer, /3-phase learning plan/i);
});

test('multi-step scenario: 30 minutes daily C pointers inquiry retrieves context, gaps, plan, and proposal', async () => {
    const r = await handleAgentRequest(
        { question: 'I have 30 minutes each day and want to improve my C programming. I struggle with pointers.', state: defaultState() },
        { model: 'm', fetchImpl: fetch }
    );
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    // 1. Tool execution steps
    assert.ok(body.steps.some((s: any) => s.tool === 'get_student_context'));
    assert.ok(body.steps.some((s: any) => s.tool === 'get_my_skill_gaps'));
    assert.ok(body.steps.some((s: any) => s.tool === 'generate_learning_plan'));
    // 2. Realistic 30-min plan and Socratic explanation
    assert.match(body.answer, /30-minute daily schedule/i);
    assert.match(body.answer, /street address/i);
    assert.match(body.answer, /Comprehension Check/i);
    // 3. Actionable proposal with student approval permission
    assert.equal(body.proposals.length, 1);
    assert.equal(body.proposals[0].permission, 'approval_required');
    assert.equal(body.proposals[0].skill, 'problem-solving');
});

test('comprehension check evaluation: evaluates student answer and emits evaluatedPractice', async () => {
    const r = await handleAgentRequest(
        { question: 'The value of a is 20 because *p dereferences the address and directly mutates the value', state: defaultState() },
        { model: 'm', fetchImpl: fetch }
    );
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.mode, 'fallback');
    assert.ok(body.steps.some((s: any) => s.tool === 'evaluate_submission'));
    assert.match(body.answer, /Verification Succeeded: 100% Correct/i);
    assert.ok(body.evaluatedPractice);
    assert.equal(body.evaluatedPractice.passed, true);
    assert.equal(body.evaluatedPractice.skillId, 'problem-solving');
    assert.equal(body.proposals.length, 1);
    assert.equal(body.proposals[0].label, 'Continue to Array Pointer Tracing');
});



