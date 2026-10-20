import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const { OnlineCompilerExecutionProvider } = await import('../lib/code-execution/onlinecompiler-provider.ts');
const { getActiveExecutionProvider, executePracticeSubmission } = await import('../lib/code-execution/index.ts');

console.log('======================================================');
console.log('PHASE 8: EXACT PROMPT TEST SUITE & FAILURE MATRIX');
console.log('======================================================\n');

const provider = new OnlineCompilerExecutionProvider();
console.log('Provider configured:', provider.isConfigured());

let passCount = 0;
let failCount = 0;

function assert(cond, name, details = '') {
  if (cond) {
    console.log(`✓ [PASS] ${name}${details ? ` (${details})` : ''}`);
    passCount++;
  } else {
    console.error(`✗ [FAIL] ${name}${details ? ` (${details})` : ''}`);
    failCount++;
  }
}

// 1. The exact programs requested by user (output must be 5)
const exactTests = [
  {
    language: 'python',
    code: 'print(2 + 3)',
    name: 'Python: print(2 + 3)',
  },
  {
    language: 'javascript',
    code: 'console.log(2 + 3);',
    name: 'JavaScript: console.log(2 + 3);',
  },
  {
    language: 'c',
    code: `#include <stdio.h>\n\nint main(void) {\n    printf("%d\\n", 2 + 3);\n    return 0;\n}`,
    name: 'C: printf("%d\\n", 2 + 3)',
  },
  {
    language: 'cpp',
    code: `#include <iostream>\n\nint main() {\n    std::cout << 2 + 3 << std::endl;\n    return 0;\n}`,
    name: 'C++: std::cout << 2 + 3',
  },
  {
    language: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        System.out.println(2 + 3);\n    }\n}`,
    name: 'Java: System.out.println(2 + 3)',
  },
  {
    language: 'sql',
    code: 'SELECT 2 + 3 AS result;',
    name: 'SQL: SELECT 2 + 3 AS result',
  },
];

console.log('--- 1. Testing Exact User Programs (Expected Output: 5) ---');
for (const t of exactTests) {
  const res = await provider.executeTestCase({
    code: t.code,
    language: t.language,
    stdin: '',
    expectedOutput: '5',
    timeLimitSec: 5,
  });
  assert(res.passed && res.actual.trim() === '5', t.name, `actual="${res.actual.trim()}", time=${res.runtimeMs}ms`);
}

// 2. Syntax / Compilation Error
console.log('\n--- 2. Testing Syntax and Compilation Errors ---');
const compErrRes = await provider.executeTestCase({
  code: 'def broken_python(:',
  language: 'python',
  stdin: '',
  expectedOutput: '5',
});
assert(compErrRes.status === 'compilation_error' && !compErrRes.passed, 'Python SyntaxError caught as compilation_error', `status=${compErrRes.status}`);

const cCompErrRes = await provider.executeTestCase({
  code: '#include <stdio.h>\nint main() { broken_syntax }',
  language: 'c',
  stdin: '',
  expectedOutput: '5',
});
assert(cCompErrRes.status === 'compilation_error' && !cCompErrRes.passed, 'C syntax error caught as compilation_error', `status=${cCompErrRes.status}`);

// 3. Runtime Error
console.log('\n--- 3. Testing Runtime Errors ---');
const rtErrRes = await provider.executeTestCase({
  code: 'x = 1 / 0',
  language: 'python',
  stdin: '',
  expectedOutput: '5',
});
assert(rtErrRes.status === 'runtime_error' && !rtErrRes.passed, 'Python ZeroDivisionError caught as runtime_error', `status=${rtErrRes.status}`);

// 4. Timeout / Infinite Loop
console.log('\n--- 4. Testing Timeout / Infinite Loop ---');
const toRes = await provider.executeTestCase({
  code: 'while True: pass',
  language: 'python',
  stdin: '',
  expectedOutput: '5',
  timeLimitSec: 2,
});
assert(toRes.status === 'time_limit_exceeded' && !toRes.passed, 'Python infinite loop stopped with time_limit_exceeded', `status=${toRes.status}, runtimeMs=${toRes.runtimeMs}`);

// 5. Wrong Answer
console.log('\n--- 5. Testing Wrong Answer ---');
const waRes = await provider.executeTestCase({
  code: 'print(10)',
  language: 'python',
  stdin: '',
  expectedOutput: '5',
});
assert(waRes.status === 'wrong_answer' && !waRes.passed, 'Output 10 vs expected 5 reports wrong_answer', `actual=${waRes.actual}`);

// 6. Test through Server Practice Submission Pipeline
console.log('\n--- 6. Testing through Server Practice Submission Pipeline ---');
const serverSubmission = await executePracticeSubmission({
  problemId: 'two-sum-target',
  language: 'python',
  code: 'def two_sum(nums, target):\n    lookup = {}\n    for i, n in enumerate(nums):\n        diff = target - n\n        if diff in lookup:\n            return [lookup[diff], i]\n        lookup[n] = i\n    return []',
  testCases: [
    { id: 'tc-1', input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', isHidden: false },
    { id: 'tc-2', input: '[3, 2, 4], 6', expectedOutput: '[1, 2]', isHidden: false },
    { id: 'tc-3', input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: true },
  ],
  isSubmission: true,
});
assert(serverSubmission.success === true, 'Two-sum real submission passes on OnlineCompiler', `totalPassed=${serverSubmission.totalPassed}/${serverSubmission.totalTests}, runner=${serverSubmission.provider}`);
assert(serverSubmission.provider === 'onlinecompiler', 'Provider identified as onlinecompiler');
assert(serverSubmission.isRunnerAvailable === true, 'Runner marked as available');

// 7. Test SQL Practice Submission Pipeline
console.log('\n--- 7. Testing SQL Practice Submission Pipeline ---');
const sqlServerSubmission = await executePracticeSubmission({
  problemId: 'sql-second-highest-salary',
  language: 'sql',
  code: 'SELECT MAX(salary) AS SecondHighestSalary FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);',
  testCases: [
    { id: 'tc-1', input: '[[1, 100], [2, 200], [3, 300]]', expectedOutput: '200', isHidden: false },
    { id: 'tc-2', input: '[[1, 100]]', expectedOutput: 'null', isHidden: true },
  ],
  isSubmission: true,
});
assert(sqlServerSubmission.success === true, 'SQL submission passes in isolated SQLite practice engine', `totalPassed=${sqlServerSubmission.totalPassed}/${sqlServerSubmission.totalTests}, runner=${sqlServerSubmission.provider}`);
assert(sqlServerSubmission.provider === 'sqlite_internal', 'SQL routed to sqlite_internal sandbox');

console.log('\n======================================================');
console.log(`PHASE 8 MATRIX COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================');

if (failCount > 0) process.exit(1);
