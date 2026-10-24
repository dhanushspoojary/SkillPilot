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
// --- authentication validation suite (a-f) ------------------------------------------------
// e. Invalid signup input
const invalidEmail = await call('/api/auth/signup', { method: 'POST', body: { email: 'invalid-email-format', name: 'Test', password: 'integration-password-123', role: 'student' } });
check(invalidEmail.status === 400, 'invalid email format must be rejected with 400');
const shortPass = await call('/api/auth/signup', { method: 'POST', body: { email: `short-${stamp}@example.test`, name: 'Test', password: 'short', role: 'student' } });
check(shortPass.status === 400, 'short password must be rejected with 400');

// f. Unauthorized access to protected endpoints
const unauthProfile = await call('/api/profile');
check(unauthProfile.status === 401, 'unauthorized access to /api/profile must be rejected with 401');

// a. Successful signup without email delivery
const email = `integration-${stamp}@example.test`;
const signup = await call('/api/auth/signup', { method: 'POST', body: { email, name: 'API Integration Student', password: 'integration-password-123', role: 'student' } });
check(signup.status === 201, 'signup should immediately create account and session with 201 (no email provider needed)');
const cookie = signup.res.headers.get('set-cookie')?.split(';')[0];
check(cookie, 'signup did not issue a session cookie');

// b. Immediate authenticated access after signup
const auth = { cookie };
const profile = await call('/api/profile', { headers: auth });
check(profile.status === 200, `profile route failed for newly registered user: ${profile.status}`);

// c. Duplicate-email rejection
const dupSignup = await call('/api/auth/signup', { method: 'POST', body: { email, name: 'Duplicate User', password: 'integration-password-123', role: 'student' } });
check(dupSignup.status === 400, 'duplicate signup must be rejected with 400');
check(dupSignup.data.error === 'Could not create account with this email address', 'duplicate email must not reveal account existence');

// d. Login for existing users
const loginRes = await call('/api/auth/login', { method: 'POST', body: { email, password: 'integration-password-123' } });
check(loginRes.status === 200, `existing user login failed: ${loginRes.status}`);
check(loginRes.res.headers.get('set-cookie'), 'login did not issue a session cookie');

const agent = await call('/api/agent', { method: 'POST', headers: auth, body: { question: 'What should I do next?' } });
check(agent.status === 200, `agent route failed: ${agent.status}`);
// --- capability profile calibration ----------------------------------------------------
const saveCap = await call('/api/profile', {
    method: 'PATCH',
    headers: auth,
    body: {
        careerGoal: 'Backend Engineer',
        capabilityProfile: {
            educationLevel: 'first_year',
            programmingExperience: 'beginner',
            fieldOfStudy: 'computer_science',
            careerInterests: ['Backend Engineer'],
            weeklyHours: 5,
            focusAreas: ['Programming Fundamentals'],
            onboardingCompleted: true,
        },
    },
});
check(saveCap.status === 200, `capability profile patch failed: ${saveCap.status}`);
const checkProfile = await call('/api/profile', { headers: auth });
check(checkProfile.data.careerGoal === 'Backend Engineer', 'career goal not updated');
check(checkProfile.data.capabilityProfile?.programmingExperience === 'beginner', 'programmingExperience not persisted');
check(checkProfile.data.capabilityProfile?.onboardingCompleted === true, 'onboardingCompleted not persisted');
// --- assessment: start, resume, validation ----------------------------------------------
const first = await call('/api/assess/start', { method: 'POST', headers: auth, body: {} });
check(first.status === 201, `assessment start failed: ${first.status}`);
check(first.data.total >= 2 && first.data.index === 0, 'assessment should report total and start at index 0');
check(first.data.question && !('answer' in first.data.question), 'answer key must not be sent to the browser');
const again = await call('/api/assess/start', { method: 'POST', headers: auth, body: {} });
check(again.status === 200 && again.data.resumed === true, `restarting should resume, got ${again.status}`);
check(again.data.assessmentId === first.data.assessmentId, 'resume must return the same assessment');
check(again.data.question.id === first.data.question.id, 'resume must return the same pending question');
const answer = await call('/api/assess/submit', { method: 'POST', headers: auth, body: { assessmentId: first.data.assessmentId, questionId: first.data.question.id, choice: 0 } });
check(answer.status === 200 && answer.data.done === false, `submit failed: ${answer.status}`);
check(answer.data.index === 1 && answer.data.total >= 2, 'index/total should be stable after one answer');
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
// --- account recovery and moderation (g. Password-reset endpoints after email removal) ---
const forgotKnown = await call('/api/auth/forgot', { method: 'POST', body: { email } });
const forgotUnknown = await call('/api/auth/forgot', { method: 'POST', body: { email: `nobody-${stamp}@example.test` } });
check(forgotKnown.status === 400 && forgotUnknown.status === 400, 'forgot-password must be safely disabled with 400');
check(JSON.stringify(forgotKnown.data) === JSON.stringify(forgotUnknown.data), 'forgot-password responses must be identical (no enumeration)');
const badReset = await call('/api/auth/reset', { method: 'POST', body: { token: 'x'.repeat(43), newPassword: 'another-long-password-1' } });
check(badReset.status === 400, 'reset endpoint must be safely disabled with 400');
const badVerify = await call('/api/auth/verify', { method: 'POST', body: { token: 'x'.repeat(43) } });
check(badVerify.status === 200, 'verify endpoint reports email verification is no longer required with 200');
const resend = await call('/api/auth/resend-verification', { method: 'POST', body: { email: `nobody-${stamp}@example.test` } });
check(resend.status === 400, 'resend endpoint must be safely disabled with 400');
const adminList = await call('/api/admin/users', { headers: auth });
check(adminList.status === 403, 'students must not reach the admin user list');
const adminSuspend = await call('/api/admin/users', { method: 'PATCH', headers: auth, body: { userId: '00000000-0000-4000-8000-000000000000', status: 'suspended' } });
check(adminSuspend.status === 403, 'students must not suspend accounts');
// --- passport sharing and public verification ---------------------------------------------
const shareCreate = await call('/api/passport/share', { method: 'POST', headers: auth, body: { includeName: true, includeSkills: true, includeEvidence: true } });
check(shareCreate.status === 201 || shareCreate.status === 200, `passport share creation failed: ${shareCreate.status}`);
check(shareCreate.data.share?.shareToken && shareCreate.data.share?.url, 'passport share response missing token or url');
const token = shareCreate.data.share.shareToken;

// Public access without auth cookie
const publicCard = await call(`/api/passport/${token}`);
check(publicCard.status === 200, `public passport access failed: ${publicCard.status}`);
check(publicCard.data.passport?.shareToken === token, 'public passport token mismatch');
check(typeof publicCard.data.passport?.readiness === 'number', 'public passport missing readiness score');
check(publicCard.data.passport?.authenticityHash, 'public passport missing authenticity hash');

// Student manages share
const shareGet = await call('/api/passport/share', { headers: auth });
check(shareGet.status === 200 && shareGet.data.share?.shareToken === token, 'passport share get failed');

// Revocation
const shareRevoke = await call('/api/passport/share', { method: 'DELETE', headers: auth, body: { shareToken: token } });
check(shareRevoke.status === 200 && shareRevoke.data.revoked === true, `passport revoke failed: ${shareRevoke.status}`);

// Public access after revocation returns 404
const publicRevoked = await call(`/api/passport/${token}`);
check(publicRevoked.status === 404, `revoked passport should return 404, got ${publicRevoked.status}`);

// --- workflow & dynamic onboarding --------------------------------------------------------
const wfState = await call('/api/workflow', { headers: auth });
check(wfState.status === 200, `workflow get failed: ${wfState.status}`);
check(wfState.data.state?.stage, 'workflow state missing stage');

// Test onboarding turn
const turnRes = await call('/api/workflow/onboarding', {
    method: 'POST',
    headers: auth,
    body: { answer: '1st Year Student' },
});
check(turnRes.status === 200, `onboarding turn failed: ${turnRes.status}`);

// Test skill baseline confirmation
const confirmSkills = await call('/api/workflow', {
    method: 'POST',
    headers: auth,
    body: {
        action: 'confirm_skills',
        confirmedSkills: [{ skill: 'sql', score: 65 }, { skill: 'javascript', score: 70 }],
    },
});
check(confirmSkills.status === 200, `confirm skills failed: ${confirmSkills.status}`);
check(confirmSkills.data.state?.stage === 'SKILLS_CONFIRMED', 'stage should be SKILLS_CONFIRMED');

// Test goals confirmation
const confirmGoals = await call('/api/workflow', {
    method: 'POST',
    headers: auth,
    body: {
        action: 'confirm_goals',
        goals: ['Backend Engineer'],
    },
});
check(confirmGoals.status === 200, `confirm goals failed: ${confirmGoals.status}`);
check(confirmGoals.data.state?.stage === 'ROADMAP_READY', 'stage should be ROADMAP_READY');
check(confirmGoals.data.guidance?.featuresLocked?.roadmap === false, 'roadmap should be unlocked after goals confirmed');

// --- conversation persistence -------------------------------------------------------------
const convList = await call('/api/conversations', { headers: auth });
check(convList.status === 200, `conversations get failed: ${convList.status}`);
check(Array.isArray(convList.data.messages), 'conversations must return messages array');
check(convList.data.messages.length >= 2, 'agent interaction should have recorded messages');

// --- multi-threaded conversations ---------------------------------------------------------
const threadCreate = await call('/api/conversations', {
    method: 'POST',
    headers: auth,
    body: { title: 'Systems Architecture Thread' },
});
check(threadCreate.status === 201, `thread creation failed: ${threadCreate.status}`);
check(threadCreate.data.thread?.id, 'thread creation response missing id');
const newThreadId = threadCreate.data.thread.id;

const threadList = await call('/api/conversations?threads=true', { headers: auth });
check(threadList.status === 200, `threads list failed: ${threadList.status}`);
check(threadList.data.threads.some((t) => t.id === newThreadId), 'created thread missing from threads list');

const threadRename = await call('/api/conversations', {
    method: 'PATCH',
    headers: auth,
    body: { threadId: newThreadId, title: 'Distributed Systems & DB Architecture' },
});
check(threadRename.status === 200, `thread rename failed: ${threadRename.status}`);
check(threadRename.data.thread?.title === 'Distributed Systems & DB Architecture', 'thread title was not updated');

const agentInThread = await call('/api/agent', {
    method: 'POST',
    headers: auth,
    body: { question: 'Explain pointers in simple words', threadId: newThreadId },
});
check(agentInThread.status === 200, `agent in thread failed: ${agentInThread.status}`);
check(agentInThread.data.threadId === newThreadId, 'agent reply threadId mismatch');

const threadMessages = await call(`/api/conversations?threadId=${newThreadId}`, { headers: auth });
check(threadMessages.status === 200, `thread messages fetch failed: ${threadMessages.status}`);
check(threadMessages.data.messages.length >= 2, 'thread should contain student and agent messages');

const threadDelete = await call(`/api/conversations?threadId=${newThreadId}`, {
    method: 'DELETE',
    headers: auth,
});
check(threadDelete.status === 200, `thread delete failed: ${threadDelete.status}`);

// --- durable student memories -------------------------------------------------------------
const memoryCreate = await call('/api/agent/memories', {
    method: 'POST',
    headers: auth,
    body: { category: 'goal', fact: 'Targeting summer 2027 systems engineering internship' },
});
check(memoryCreate.status === 201, `memory creation failed: ${memoryCreate.status}`);
check(memoryCreate.data.memory?.id, 'created memory missing id');
const memoryId = memoryCreate.data.memory.id;

const memoryList = await call('/api/agent/memories', { headers: auth });
check(memoryList.status === 200, `memories list failed: ${memoryList.status}`);
check(memoryList.data.memories.some((m) => m.id === memoryId), 'new memory missing from memories list');

const memoryDelete = await call(`/api/agent/memories?id=${memoryId}`, {
    method: 'DELETE',
    headers: auth,
});
check(memoryDelete.status === 200, `memory delete failed: ${memoryDelete.status}`);

// --- practical project workspace & evaluation --------------------------------------------
const projectGet = await call('/api/projects?slug=rest-bookstore-service', { headers: auth });
check(projectGet.status === 200, `project get failed: ${projectGet.status}`);
check(projectGet.data.catalog?.length >= 2, 'project catalog missing items');
check(projectGet.data.studentProject?.slug === 'rest-bookstore-service', 'active project slug mismatch');

const workingBookstoreCode = `
class BookstoreService {
  constructor() {
    this.books = [
      { id: "1", title: "Clean Code", author: "Robert Martin", year: 2008, inStock: true },
      { id: "2", title: "The Pragmatic Programmer", author: "David Thomas", year: 1999, inStock: true }
    ];
  }

  listBooks(filter = {}) {
    return this.books;
  }

  getBookById(id) {
    return this.books.find(b => b.id === id) || null;
  }

  addBook(data) {
    if (!data.title || !data.author) {
      throw new Error("Invalid payload: title and author are required");
    }
    const newBook = {
      id: String(this.books.length + 1),
      title: data.title.trim(),
      author: data.author.trim(),
      year: Number(data.year) || 2026,
      inStock: Boolean(data.inStock ?? true)
    };
    this.books.push(newBook);
    return newBook;
  }

  deleteBook(id) {
    const idx = this.books.findIndex(b => b.id === id);
    if (idx >= 0) {
      this.books.splice(idx, 1);
      return true;
    }
    return false;
  }
}
module.exports = { BookstoreService };
`;

const projectEval = await call('/api/projects', {
    method: 'POST',
    headers: auth,
    body: {
        slug: 'rest-bookstore-service',
        code: workingBookstoreCode,
    },
});
check(projectEval.status === 200, `project evaluation failed: ${projectEval.status}`);
check(projectEval.data.passed === true, 'working bookstore solution should pass tests');
check(projectEval.data.project?.status === 'verified', 'project status should be verified');
check(projectEval.data.testResults?.every((t) => t.status === 'passed'), 'all test cases should pass');

// Verify project evidence recorded on student profile
const updatedProf = await call('/api/profile', { headers: auth });
const projectEvidence = updatedProf.data.evidence.filter((e) => e.kind === 'project');
check(projectEvidence.length > 0, 'practical project verified evidence missing from profile ledger');

// Clear conversation
const clearConv = await call('/api/conversations', { method: 'DELETE', headers: auth });
check(clearConv.status === 200 && clearConv.data.deleted === true, 'clear conversations failed');
const convAfterClear = await call('/api/conversations', { headers: auth });
check(convAfterClear.data.messages.length === 0, 'conversation should be empty after clear');

// --- Continuous AI Learning, Adaptive Practice & Next-Action Engine ---
// 1. Fetch Lessons Catalog
const lessonsRes = await call('/api/learn/lessons', { headers: auth });
check(lessonsRes.status === 200, `get lessons catalog failed: ${lessonsRes.status}`);
check(Array.isArray(lessonsRes.data.lessons) && lessonsRes.data.lessons.length >= 4, 'lessons catalog should contain at least 4 core tracks');

// 2. Fetch specific lesson details (verify sanitized payload without answer leaks)
const lessonRes = await call('/api/learn/lesson?id=ps-loop-tracing', { headers: auth });
check(lessonRes.status === 200, `get lesson details failed: ${lessonRes.status}`);
check(lessonRes.data.lesson?.title === 'Loop Tracing & Algorithmic State', 'lesson title mismatch');
check(lessonRes.data.lesson?.exercises?.[0]?.correctIndex === undefined, 'exercise payload leaked correctIndex to client');

// 3. Submit Practice Attempt (Incorrect Answer -> Socratic Explanation & Remediation)
const wrongAttempt = await call('/api/learn/attempt', {
  method: 'POST',
  headers: auth,
  body: {
    lessonId: 'ps-loop-tracing',
    exerciseId: 'ps-trace-q1',
    concept: 'accumulator_pattern',
    skillSlug: 'problem-solving',
    chosenIndex: 1,
    hintsUsed: 0
  }
});
check(wrongAttempt.status === 200, `attempt submission failed: ${wrongAttempt.status}`);
check(wrongAttempt.data.result?.isCorrect === false, 'wrong attempt should be evaluated as false');
check(typeof wrongAttempt.data.result?.feedback === 'string' && wrongAttempt.data.result.feedback.length > 0, 'socratic feedback must be provided for wrong answer');
check(wrongAttempt.data.result?.nextStepRecommendation, 'next step recommendation must be provided');

// 4. Submit Practice Attempt (Correct Answer -> Mastery Credit Update)
const correctAttempt = await call('/api/learn/attempt', {
  method: 'POST',
  headers: auth,
  body: {
    lessonId: 'ps-loop-tracing',
    exerciseId: 'ps-trace-q1',
    concept: 'accumulator_pattern',
    skillSlug: 'problem-solving',
    chosenIndex: 0,
    hintsUsed: 0
  }
});
check(correctAttempt.status === 200, `correct attempt submission failed: ${correctAttempt.status}`);
check(correctAttempt.data.result?.isCorrect === true, 'correct attempt should be evaluated as true');
check(correctAttempt.data.result?.conceptMastery?.problemsSolved >= 1, 'problems solved count should increment');

// 5. Generate Dynamic Practice Question
const genQuestion = await call('/api/learn/practice/generate', {
  method: 'POST',
  headers: auth,
  body: {
    topic: 'Loop State Tracing',
    skillSlug: 'problem-solving',
    concept: 'loop-invariants',
    difficulty: 'beginner'
  }
});
check(genQuestion.status === 200, `practice question generation failed: ${genQuestion.status}`);
check(genQuestion.data.question?.prompt, 'generated question must have prompt');
check(genQuestion.data.question?.fingerprint, 'generated question must have duplicate-detection fingerprint');
check(genQuestion.data.question?.correctIndex === undefined, 'generated question must be sanitized for client');

// 6. Autorun Next-Action Recommendation
const nextActionRes = await call('/api/learn/next-action', { headers: auth });
check(nextActionRes.status === 200, `next-action endpoint failed: ${nextActionRes.status}`);
check(nextActionRes.data.nextAction?.type, 'next-action must return type');
check(typeof nextActionRes.data.nextAction?.title === 'string', 'next-action must return title');
check(typeof nextActionRes.data.nextAction?.explanation === 'string', 'next-action must explain recommendation in plain language');
check(nextActionRes.data.nextAction?.buttonLabel, 'next-action must provide buttonLabel');

await call('/api/auth/logout', { method: 'POST', headers: auth });
console.log('api integration: PASS (all auth, assessment, learning, practice, projects, and next-action workflows verified)');

