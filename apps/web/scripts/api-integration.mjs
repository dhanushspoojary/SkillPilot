// End-to-end checks against a running server and database (CI: npm start + Postgres).
const base = process.env.API_URL || 'http://127.0.0.1:3000';
const origin = base;
const stamp = Date.now();
const check = (cond, msg) => {
    if (!cond)
        throw new Error(msg);
};
async function call(path, { method = 'GET', headers = {}, body } = {}) {
    const res = await fetch(`${base}${path}`, {
        method,
        headers: { origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = {};
    try {
        data = JSON.parse(text);
    }
    catch { /* non-JSON */ }
    return { res, status: res.status, data };
}
// --- signup, profile, agent -------------------------------------------------------------
const email = `integration-${stamp}@example.test`;
const signup = await call('/api/auth/signup', { method: 'POST', body: { email, name: 'API Integration Student', password: 'integration-password-123', role: 'student' } });
check(signup.status === 201 || signup.status === 202, `signup failed: ${signup.status}`);
check(signup.status === 201, 'signup should create a session when email verification is off (CI has no mail provider)');
const cookie = signup.res.headers.get('set-cookie')?.split(';')[0];
check(cookie, 'signup did not issue a session cookie');
const auth = { cookie };
const profile = await call('/api/profile', { headers: auth });
check(profile.status === 200, `profile route failed: ${profile.status}`);
const agent = await call('/api/agent', { method: 'POST', headers: auth, body: { question: 'What should I do next?' } });
check(agent.status === 200, `agent route failed: ${agent.status}`);
// --- assessment: start, resume, validation ----------------------------------------------
const first = await call('/api/assess/start', { method: 'POST', headers: auth, body: {} });
check(first.status === 201, `assessment start failed: ${first.status}`);
check((first.data.total === 12 || first.data.total === 6) && first.data.index === 0, 'assessment should report total and start at index 0');
check(first.data.question && !('answer' in first.data.question), 'answer key must not be sent to the browser');
const again = await call('/api/assess/start', { method: 'POST', headers: auth, body: {} });
check(again.status === 200 && again.data.resumed === true, `restarting should resume, got ${again.status}`);
check(again.data.assessmentId === first.data.assessmentId, 'resume must return the same assessment');
check(again.data.question.id === first.data.question.id, 'resume must return the same pending question');
const answer = await call('/api/assess/submit', { method: 'POST', headers: auth, body: { assessmentId: first.data.assessmentId, questionId: first.data.question.id, choice: 0 } });
check(answer.status === 200 && answer.data.done === false, `submit failed: ${answer.status}`);
check(answer.data.index === 1 && (answer.data.total === 12 || answer.data.total === 6), 'index/total should be stable after one answer');
const resumedAfterAnswer = await call('/api/assess/start', { method: 'POST', headers: auth, body: {} });
check(resumedAfterAnswer.status === 200 && resumedAfterAnswer.data.index === 1, 'resume should continue after the answered question');
const badId = await call('/api/assess/submit', { method: 'POST', headers: auth, body: { assessmentId: 'not-a-uuid', questionId: 'rest-1a', choice: 0 } });
check(badId.status === 400, `invalid assessment id validation failed: ${badId.status}`);
// --- activity persistence ---------------------------------------------------------------
const bad = await call('/api/activity', { method: 'POST', headers: auth, body: { actionId: 'PROVE:sql', done: true } });
check(bad.status === 400, 'clients must not be able to report PROVE actions');
const unknown = await call('/api/activity', { method: 'POST', headers: auth, body: { actionId: 'BUILD:made-up', done: true } });
check(unknown.status === 400, 'unknown skills must be rejected');
const done = await call('/api/activity', { method: 'POST', headers: auth, body: { actionId: 'BUILD:javascript', done: true } });
check(done.status === 200, `activity save failed: ${done.status}`);
await call('/api/activity', { method: 'POST', headers: auth, body: { actionId: 'BUILD:javascript', done: true } }); // idempotent
let after = await call('/api/profile', { headers: auth });
check(after.data.activity.filter((a) => a.id === 'BUILD:javascript').length === 1, 'activity should be stored exactly once and survive a reload');
check(after.data.evidence.length === 0, 'marking work done must never create evidence');
await call('/api/activity', { method: 'POST', headers: auth, body: { actionId: 'BUILD:javascript', done: false } });
after = await call('/api/profile', { headers: auth });
check(after.data.activity.length === 0, 'undo should remove the stored activity');
const noOrigin = await fetch(`${base}/api/activity`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ actionId: 'BUILD:sql', done: true }) });
check(noOrigin.status === 403, 'mutations without an Origin header must be rejected');
// --- account recovery and moderation ----------------------------------------------------
const forgotKnown = await call('/api/auth/forgot', { method: 'POST', body: { email } });
const forgotUnknown = await call('/api/auth/forgot', { method: 'POST', body: { email: `nobody-${stamp}@example.test` } });
check(forgotKnown.status === 202 && forgotUnknown.status === 202, 'forgot-password must answer 202 either way');
check(JSON.stringify(forgotKnown.data) === JSON.stringify(forgotUnknown.data), 'forgot-password responses must be identical (no enumeration)');
const badReset = await call('/api/auth/reset', { method: 'POST', body: { token: 'x'.repeat(43), newPassword: 'another-long-password-1' } });
check(badReset.status === 400, 'reset with an unknown token must fail');
const badVerify = await call('/api/auth/verify', { method: 'POST', body: { token: 'x'.repeat(43) } });
check(badVerify.status === 400, 'verify with an unknown token must fail');
const resend = await call('/api/auth/resend-verification', { method: 'POST', body: { email: `nobody-${stamp}@example.test` } });
check(resend.status === 202, 'resend must answer 202 for unknown addresses');
const adminList = await call('/api/admin/users', { headers: auth });
check(adminList.status === 403, 'students must not reach the admin user list');
const adminSuspend = await call('/api/admin/users', { method: 'PATCH', headers: auth, body: { userId: '00000000-0000-4000-8000-000000000000', status: 'suspended' } });
check(adminSuspend.status === 403, 'students must not suspend accounts');
await call('/api/auth/logout', { method: 'POST', headers: auth });
console.log('api integration: PASS');
