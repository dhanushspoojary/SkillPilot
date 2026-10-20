import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_LANGUAGES,
  MAX_SOURCE_CODE_LENGTH,
  executePracticeSubmission,
} from './code-execution/index.ts';
import { Judge0ExecutionProvider } from './code-execution/judge0-provider.ts';
import { PistonExecutionProvider } from './code-execution/piston-provider.ts';
import { OnlineCompilerExecutionProvider } from './code-execution/onlinecompiler-provider.ts';
import { SqliteExecutionProvider } from './code-execution/sqlite-provider.ts';
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
  const oldOnlineCompiler = process.env.ONLINECOMPILER_API_KEY;
  const oldJudge0 = process.env.JUDGE0_API_URL;
  const oldPiston = process.env.PISTON_API_URL;
  delete process.env.ONLINECOMPILER_API_KEY;
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
    if (oldOnlineCompiler) process.env.ONLINECOMPILER_API_KEY = oldOnlineCompiler;
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

  const cpp = buildExecutableProgram(
    'int maxSubArray(std::vector<int>& nums) { return 6; }',
    'maximum-subarray',
    'cpp',
    '[-2, 1, -3, 4, -1, 2, 1, -5, 4]'
  );
  assert.match(cpp.sourceCode, /#include <iostream>/);
  assert.match(cpp.sourceCode, /maxSubArray\(nums\)/);

  const java = buildExecutableProgram(
    'class Solution { public int maxSubArray(int[] nums) { return 6; } }',
    'maximum-subarray',
    'java',
    '[-2, 1, -3, 4, -1, 2, 1, -5, 4]'
  );
  assert.match(java.sourceCode, /public class Main/);
  assert.match(java.sourceCode, /sol\.maxSubArray/);
});

test('code execution: SQLite in-memory practice engine executes isolated SQL queries', async () => {
  const provider = new SqliteExecutionProvider();
  assert.equal(provider.isConfigured(), true);

  const health = await provider.checkHealth();
  assert.equal(health.ok, true);

  // 1. Correct query with normal data
  const run1 = await provider.executeTestCase({
    code: 'SELECT MAX(salary) AS SecondHighestSalary FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);',
    language: 'sql',
    stdin: '[[1, 100], [2, 200], [3, 300]]',
    expectedOutput: '200',
    problemId: 'sql-second-highest-salary',
  });
  assert.equal(run1.passed, true);
  assert.equal(run1.actual, '200');
  assert.equal(run1.status, 'success');

  // 2. Query with only one row (must return null)
  const run2 = await provider.executeTestCase({
    code: 'SELECT MAX(salary) AS SecondHighestSalary FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);',
    language: 'sql',
    stdin: '[[1, 100]]',
    expectedOutput: 'null',
    problemId: 'sql-second-highest-salary',
  });
  assert.equal(run2.passed, true);
  assert.equal(run2.actual, 'null');
  assert.equal(run2.status, 'success');

  // 3. Duplicate top salaries (300, 300, 200) -> 200
  const run3 = await provider.executeTestCase({
    code: 'SELECT MAX(salary) AS SecondHighestSalary FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);',
    language: 'sql',
    stdin: '[[1, 300], [2, 300], [3, 200]]',
    expectedOutput: '200',
    problemId: 'sql-second-highest-salary',
  });
  assert.equal(run3.passed, true);
  assert.equal(run3.actual, '200');

  // 4. SQL syntax error caught as compilation_error
  const run4 = await provider.executeTestCase({
    code: 'SELECT FORM Employee WHERE ;',
    language: 'sql',
    stdin: '[[1, 100]]',
    expectedOutput: '100',
    problemId: 'sql-second-highest-salary',
  });
  assert.equal(run4.passed, false);
  assert.equal(run4.status, 'compilation_error');
  assert.ok(run4.error);

  // 5. Non-existent column caught as compilation_error during statement preparation
  const run5 = await provider.executeTestCase({
    code: 'SELECT non_existent_col FROM Employee;',
    language: 'sql',
    stdin: '[[1, 100]]',
    expectedOutput: '100',
    problemId: 'sql-second-highest-salary',
  });
  assert.equal(run5.passed, false);
  assert.equal(run5.status, 'compilation_error');

  // 6. Unsupported language rejected
  const run6 = await provider.executeTestCase({
    code: 'print(1)',
    language: 'python' as any,
    stdin: '',
    expectedOutput: '1',
  });
  assert.equal(run6.passed, false);
  assert.equal(run6.status, 'rejected_unsupported_language');
});

test('code execution: executePracticeSubmission routes SQL to isolated practice engine', async () => {
  const result = await executePracticeSubmission({
    code: 'SELECT MAX(salary) AS SecondHighestSalary FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);',
    problemId: 'sql-second-highest-salary',
    language: 'sql',
    testCases: [
      { id: 'tc-1', input: '[[1, 100], [2, 200], [3, 300]]', expectedOutput: '200', isHidden: false },
      { id: 'tc-2', input: '[[1, 100]]', expectedOutput: 'null', isHidden: true },
    ],
    isSubmission: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.provider, 'sqlite_internal');
  assert.equal(result.isRunnerAvailable, true);
  assert.equal(result.totalPassed, 2);
  assert.equal(result.status, 'success');
});

test('code execution: OnlineCompiler.io provider parses success, wrong answer, compilation errors, and rate limits', async () => {
  const originalFetch = globalThis.fetch;
  process.env.ONLINECOMPILER_API_KEY = 'test-onlinecompiler-key';

  const provider = new OnlineCompilerExecutionProvider();
  assert.equal(provider.isConfigured(), true);
  assert.deepEqual(provider.getSupportedLanguages(), ['python', 'javascript', 'c', 'cpp', 'java', 'sql']);

  try {
    // 1. Success execution
    globalThis.fetch = async (url: any, opts: any) => {
      const headers = opts?.headers || {};
      assert.equal(headers['Authorization'], 'test-onlinecompiler-key');
      return new Response(
        JSON.stringify({
          language: 'python',
          version: '3.14',
          run: {
            stdout: '[0, 1]\n',
            stderr: '',
            output: '[0, 1]\n',
            code: 0,
            signal: null,
            wall_time: 40,
            memory: 14336000,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const run1 = await provider.executeTestCase({
      code: 'def two_sum(nums, target): return [0, 1]',
      language: 'python',
      stdin: '[2, 7], 9',
      expectedOutput: '[0, 1]',
      problemId: 'two-sum-target',
    });
    assert.equal(run1.passed, true);
    assert.equal(run1.status, 'success');
    assert.equal(run1.actual, '[0, 1]');
    assert.equal(run1.runtimeMs, 40);
    assert.equal(run1.memoryKb, 14000);

    // 2. Wrong answer detection
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          language: 'python',
          version: '3.14',
          run: {
            stdout: '[0, 2]\n',
            stderr: '',
            code: 0,
            wall_time: 35,
            memory: 12000000,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const run2 = await provider.executeTestCase({
      code: 'def two_sum(nums, target): return [0, 2]',
      language: 'python',
      stdin: '[2, 7], 9',
      expectedOutput: '[0, 1]',
      problemId: 'two-sum-target',
    });
    assert.equal(run2.passed, false);
    assert.equal(run2.status, 'wrong_answer');
    assert.equal(run2.actual, '[0, 2]');

    // 3. Compilation error detection
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          language: 'python',
          version: '3.14',
          run: {
            stdout: '',
            stderr: '  File "main.py", line 2\n    def two_sum(\n                ^\nSyntaxError: unexpected EOF while parsing\n',
            code: 1,
            wall_time: 12,
            memory: 8000000,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const run3 = await provider.executeTestCase({
      code: 'def two_sum(',
      language: 'python',
      stdin: '',
      expectedOutput: '[0, 1]',
      problemId: 'two-sum-target',
    });
    assert.equal(run3.passed, false);
    assert.equal(run3.status, 'compilation_error');
    assert.match(run3.compileOutput || '', /SyntaxError/);

    // 4. Timeout detection (run.status === 'TO')
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          language: 'python',
          version: '3.14',
          run: {
            stdout: '',
            stderr: 'Execution timed out\n',
            code: 143,
            status: 'TO',
            wall_time: 4000,
            memory: 10000000,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const run4 = await provider.executeTestCase({
      code: 'while True: pass',
      language: 'python',
      stdin: '',
      expectedOutput: '[0, 1]',
      timeLimitSec: 4.0,
    });
    assert.equal(run4.passed, false);
    assert.equal(run4.status, 'time_limit_exceeded');

    // 5. Output limit flood detection (run.status === 'OL')
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          language: 'python',
          version: '3.14',
          run: {
            stdout: '',
            stderr: 'Output flood exceeded\n',
            code: 153,
            status: 'OL',
            wall_time: 100,
            memory: 10000000,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const run5 = await provider.executeTestCase({
      code: 'print("a" * 10000000)',
      language: 'python',
      stdin: '',
      expectedOutput: 'ok',
    });
    assert.equal(run5.passed, false);
    assert.equal(run5.status, 'runtime_error');
    assert.match(run5.error || '', /Output flood exceeded/);

    // 6. Rate limited (HTTP 429)
    globalThis.fetch = async () => {
      return new Response('Too Many Requests', { status: 429 });
    };

    const run6 = await provider.executeTestCase({
      code: 'print(1)',
      language: 'python',
      stdin: '',
      expectedOutput: '1',
    });
    assert.equal(run6.passed, false);
    assert.equal(run6.status, 'rate_limited');
    assert.match(run6.error || '', /OnlineCompiler.io rate limit or quota exceeded/);

    // 7. Inactive / invalid key error (HTTP 404 with JSON message)
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ message: 'Invalid or inactive API key' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const run7 = await provider.executeTestCase({
      code: 'print(1)',
      language: 'python',
      stdin: '',
      expectedOutput: '1',
    });
    assert.equal(run7.passed, false);
    assert.equal(run7.status, 'provider_unavailable');
    assert.match(run7.error || '', /rejected API key/);

    // 8. Health check validation
    globalThis.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/health/')) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            checks: { database: 'ok', queue: 'ok', sandbox: 'ok' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Execute probe
      return new Response(
        JSON.stringify({
          language: 'python',
          version: '3.14',
          run: { stdout: 'ok\n', stderr: '', code: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const health = await provider.checkHealth();
    assert.equal(health.ok, true);
    assert.match(health.message || '', /online and verified/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ONLINECOMPILER_API_KEY;
  }
});

test('code execution: safe fallback when OnlineCompiler reaches quota (no fake passes)', async () => {
  const originalFetch = globalThis.fetch;
  process.env.ONLINECOMPILER_API_KEY = 'test-onlinecompiler-key';

  try {
    globalThis.fetch = async () => {
      return new Response('Rate limited', { status: 429 });
    };

    const result = await executePracticeSubmission({
      code: 'def two_sum(nums, target): return [0, 1]',
      problemId: 'two-sum-target',
      language: 'python',
      testCases: [
        { id: 'tc-1', input: '[2, 7], 9', expectedOutput: '[0, 1]', isHidden: false },
        { id: 'tc-2', input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: true },
      ],
      isSubmission: true,
    });

    // When quota is reached:
    // - Must NOT report success
    // - Must NOT report runner available
    // - Must NOT award passes
    // - Must explain Solution Drafting Mode
    assert.equal(result.success, false);
    assert.equal(result.isRunnerAvailable, false);
    assert.equal(result.totalPassed, 0);
    assert.equal(result.status, 'rate_limited');
    assert.match(result.message || '', /Solution Drafting Mode/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ONLINECOMPILER_API_KEY;
  }
});
