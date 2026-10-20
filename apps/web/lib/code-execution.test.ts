import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_LANGUAGES,
  MAX_SOURCE_CODE_LENGTH,
  executePracticeSubmission,
} from './code-execution/index.ts';
import { Judge0ExecutionProvider } from './code-execution/judge0-provider.ts';
import { PistonExecutionProvider } from './code-execution/piston-provider.ts';
import { buildExecutableProgram } from './code-execution/harness.ts';

test('code execution: rejects unsupported languages safely', async () => {
  const result = await executePracticeSubmission({
    code: 'print("hello")',
    problemId: 'two-sum-target',
    language: 'ruby' as any,
    testCases: [{ id: 'tc-1', input: '1', expectedOutput: '1' }],
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 'rejected_unsupported_language');
  assert.match(result.message || '', /Language 'ruby' is not permitted/);
});

test('code execution: rejects oversized source code (>50k chars)', async () => {
  const oversizedCode = 'a = 1;\n'.repeat(10000); // 70,000 chars
  assert.ok(oversizedCode.length > MAX_SOURCE_CODE_LENGTH);

  const result = await executePracticeSubmission({
    code: oversizedCode,
    problemId: 'two-sum-target',
    language: 'javascript',
    testCases: [{ id: 'tc-1', input: '1', expectedOutput: '1' }],
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 'rejected_code_too_large');
  assert.match(result.message || '', /exceeds maximum permitted length/);
});

test('code execution: safe offline drafting mode when no runner configured', async () => {
  const oldJudge0 = process.env.JUDGE0_API_URL;
  const oldPiston = process.env.PISTON_API_URL;
  delete process.env.JUDGE0_API_URL;
  delete process.env.PISTON_API_URL;

  try {
    const result = await executePracticeSubmission({
      code: 'function twoSum() { return [0, 1]; }',
      problemId: 'two-sum-target',
      language: 'javascript',
      testCases: [
        { id: 'tc-1', input: '[2, 7], 9', expectedOutput: '[0, 1]', isHidden: false },
        { id: 'tc-2', input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: true },
      ],
      isSubmission: true,
    });

    assert.equal(result.success, false);
    assert.equal(result.isRunnerAvailable, false);
    assert.equal(result.runnerType, 'disabled_no_sandbox');
    assert.equal(result.status, 'provider_unavailable');
    assert.equal(result.totalPassed, 0);
    assert.match(result.message || '', /Sandboxed code execution is offline/);
  } finally {
    if (oldJudge0) process.env.JUDGE0_API_URL = oldJudge0;
    if (oldPiston) process.env.PISTON_API_URL = oldPiston;
  }
});

test('code execution: Judge0 provider parses successful execution (Status 3)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url: any, opts: any) => {
      return new Response(
        JSON.stringify({
          stdout: '[0, 1]\n',
          stderr: null,
          time: '0.045',
          memory: 4096,
          status: { id: 3, description: 'Accepted' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    process.env.JUDGE0_API_URL = 'http://mock-judge0.local';
    const provider = new Judge0ExecutionProvider();
    const run = await provider.executeTestCase({
      code: 'def two_sum(nums, target): return [0, 1]',
      language: 'python',
      stdin: '[2, 7, 11, 15], 9',
      expectedOutput: '[0, 1]',
      problemId: 'two-sum-target',
    });

    assert.equal(run.passed, true);
    assert.equal(run.status, 'success');
    assert.equal(run.actual, '[0, 1]');
    assert.equal(run.runtimeMs, 45);
    assert.equal(run.memoryKb, 4096);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.JUDGE0_API_URL;
  }
});

test('code execution: Judge0 provider handles wrong answer (Status 4)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          stdout: '[0, 2]\n',
          stderr: null,
          time: '0.030',
          memory: 3500,
          status: { id: 4, description: 'Wrong Answer' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    process.env.JUDGE0_API_URL = 'http://mock-judge0.local';
    const provider = new Judge0ExecutionProvider();
    const run = await provider.executeTestCase({
      code: 'def two_sum(nums, target): return [0, 2]',
      language: 'python',
      stdin: '[2, 7, 11, 15], 9',
      expectedOutput: '[0, 1]',
      problemId: 'two-sum-target',
    });

    assert.equal(run.passed, false);
    assert.equal(run.status, 'wrong_answer');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.JUDGE0_API_URL;
  }
});

test('code execution: Judge0 provider handles compilation error (Status 6)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          compile_output: 'SyntaxError: unexpected EOF while parsing\nline 3\n',
          stderr: 'SyntaxError: unexpected EOF while parsing',
          status: { id: 6, description: 'Compilation Error' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    process.env.JUDGE0_API_URL = 'http://mock-judge0.local';
    const provider = new Judge0ExecutionProvider();
    const run = await provider.executeTestCase({
      code: 'def two_sum(',
      language: 'python',
      stdin: '1',
      expectedOutput: '1',
      problemId: 'two-sum-target',
    });

    assert.equal(run.passed, false);
    assert.equal(run.status, 'compilation_error');
    assert.match(run.compileOutput || '', /SyntaxError/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.JUDGE0_API_URL;
  }
});

test('code execution: Judge0 provider handles time limit exceeded (Status 5)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          time: '4.01',
          status: { id: 5, description: 'Time Limit Exceeded' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    process.env.JUDGE0_API_URL = 'http://mock-judge0.local';
    const provider = new Judge0ExecutionProvider();
    const run = await provider.executeTestCase({
      code: 'while True: pass',
      language: 'python',
      stdin: '1',
      expectedOutput: '1',
      problemId: 'two-sum-target',
    });

    assert.equal(run.passed, false);
    assert.equal(run.status, 'time_limit_exceeded');
    assert.match(run.error || '', /CPU time limit/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.JUDGE0_API_URL;
  }
});

test('code execution: Judge0 handles bounded polling on async queue', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  try {
    globalThis.fetch = async (url: any) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('/submissions?')) {
        // Initial POST returns queued state with token
        return new Response(
          JSON.stringify({
            token: 'test-async-token-123',
            status: { id: 1, description: 'In Queue' },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('/submissions/test-async-token-123')) {
        // Poll GET returns completed result
        return new Response(
          JSON.stringify({
            stdout: 'true\n',
            time: '0.02',
            status: { id: 3, description: 'Accepted' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    };

    process.env.JUDGE0_API_URL = 'http://mock-judge0.local';
    const provider = new Judge0ExecutionProvider();
    const run = await provider.executeTestCase({
      code: 'function isValid(s) { return true; }',
      language: 'javascript',
      stdin: '"()"',
      expectedOutput: 'true',
      problemId: 'valid-parentheses',
    });

    assert.equal(run.passed, true);
    assert.equal(run.status, 'success');
    assert.ok(callCount >= 2, 'Should have polled the submission endpoint');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.JUDGE0_API_URL;
  }
});

test('code execution: Judge0 provider handles rate limiting (HTTP 429)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response('Too Many Requests', { status: 429 });
    };

    process.env.JUDGE0_API_URL = 'http://mock-judge0.local';
    const provider = new Judge0ExecutionProvider();
    const run = await provider.executeTestCase({
      code: 'print(1)',
      language: 'python',
      stdin: '1',
      expectedOutput: '1',
    });

    assert.equal(run.passed, false);
    assert.equal(run.status, 'rate_limited');
    assert.match(run.error || '', /rate limited/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.JUDGE0_API_URL;
  }
});

test('code execution: Judge0 provider handles auth failure (HTTP 401)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response('Unauthorized', { status: 401 });
    };

    process.env.JUDGE0_API_URL = 'http://mock-judge0.local';
    const provider = new Judge0ExecutionProvider();
    const run = await provider.executeTestCase({
      code: 'print(1)',
      language: 'python',
      stdin: '1',
      expectedOutput: '1',
    });

    assert.equal(run.passed, false);
    assert.equal(run.status, 'provider_unavailable');
    assert.match(run.error || '', /authentication failed/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.JUDGE0_API_URL;
  }
});

test('code execution: hidden test integrity and zero secret leakage', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          stdout: '[0, 1]\n',
          time: '0.01',
          status: { id: 3, description: 'Accepted' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    process.env.JUDGE0_API_URL = 'http://mock-judge0.local';

    const result = await executePracticeSubmission({
      code: 'def two_sum(nums, target): return [0, 1]',
      problemId: 'two-sum-target',
      language: 'python',
      testCases: [
        { id: 'tc-visible', input: '[2, 7], 9', expectedOutput: '[0, 1]', isHidden: false },
        { id: 'tc-secret', input: 'SECRET_INPUT_999', expectedOutput: '[0, 1]', isHidden: true },
      ],
      isSubmission: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.totalPassed, 2);

    const hiddenResult = result.testCaseResults.find((r) => r.testCaseId === 'tc-secret');
    assert.ok(hiddenResult);
    // Hidden test case expected output and input MUST NOT be returned in client payload
    assert.equal(hiddenResult.input, '[hidden test input]');
    assert.equal(hiddenResult.expected, '[hidden test output]');
    assert.equal(hiddenResult.actual, '[hidden test passed]');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.JUDGE0_API_URL;
  }
});

test('code execution: test harness wrapping generates valid driver', () => {
  const py = buildExecutableProgram(
    'def two_sum(nums, target):\n    return [0, 1]',
    'two-sum-target',
    'python',
    '[2, 7], 9'
  );
  assert.match(py.sourceCode, /def two_sum/);
  assert.match(py.sourceCode, /if __name__ == '__main__':/);
  assert.match(py.sourceCode, /json\.dumps/);

  const js = buildExecutableProgram(
    'function isValid(s) { return true; }',
    'valid-parentheses',
    'javascript',
    '"()"'
  );
  assert.match(js.sourceCode, /function isValid/);
  assert.match(js.sourceCode, /fs\.readFileSync/);

  const sql = buildExecutableProgram(
    'SELECT MAX(salary) FROM Employee',
    'sql-second-highest-salary',
    'sql',
    '[[1, 100], [2, 200]]'
  );
  assert.match(sql.sourceCode, /CREATE TABLE Employee/);
  assert.match(sql.sourceCode, /INSERT INTO Employee/);
  assert.match(sql.sourceCode, /SELECT MAX\(salary\)/);
});
