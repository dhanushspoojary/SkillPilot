import {
  ALLOWED_LANGUAGES,
  MAX_SOURCE_CODE_LENGTH,
  type CodeExecutionProvider,
  type CodeExecutionResult,
  type ProgrammingLanguage,
  type SingleTestExecution,
  type TestCaseDefinition,
} from './types.ts';
import { Judge0ExecutionProvider } from './judge0-provider.ts';
import { PistonExecutionProvider } from './piston-provider.ts';
import { OnlineCompilerExecutionProvider } from './onlinecompiler-provider.ts';
import { SqliteExecutionProvider } from './sqlite-provider.ts';

export * from './types.ts';
export { Judge0ExecutionProvider } from './judge0-provider.ts';
export { PistonExecutionProvider } from './piston-provider.ts';
export { OnlineCompilerExecutionProvider } from './onlinecompiler-provider.ts';
export { SqliteExecutionProvider } from './sqlite-provider.ts';

let judge0Instance: Judge0ExecutionProvider | null = null;
let pistonInstance: PistonExecutionProvider | null = null;
let onlinecompilerInstance: OnlineCompilerExecutionProvider | null = null;
let sqliteInstance: SqliteExecutionProvider | null = null;

export function getActiveExecutionProvider(language?: ProgrammingLanguage): CodeExecutionProvider | null {
  // If the language is SQL, use the isolated in-memory practice database sandbox
  if (language === 'sql') {
    if (!sqliteInstance) {
      sqliteInstance = new SqliteExecutionProvider();
    }
    return sqliteInstance;
  }

  // 1. OnlineCompiler.io (if configured via ONLINECOMPILER_API_KEY)
  if (process.env.ONLINECOMPILER_API_KEY) {
    if (!onlinecompilerInstance) {
      onlinecompilerInstance = new OnlineCompilerExecutionProvider();
    }
    return onlinecompilerInstance;
  }

  // 2. Judge0 (if configured via JUDGE0_API_URL)
  if (process.env.JUDGE0_API_URL) {
    if (!judge0Instance) {
      judge0Instance = new Judge0ExecutionProvider();
    }
    return judge0Instance;
  }

  // 3. Piston (if configured via PISTON_API_URL)
  if (process.env.PISTON_API_URL) {
    if (!pistonInstance) {
      pistonInstance = new PistonExecutionProvider();
    }
    return pistonInstance;
  }

  return null;
}

export async function executePracticeSubmission(params: {
  code: string;
  problemId: string;
  language: ProgrammingLanguage;
  testCases: TestCaseDefinition[];
  isSubmission?: boolean;
  timeLimitSec?: number;
}): Promise<CodeExecutionResult> {
  const {
    code,
    problemId,
    language,
    testCases: allTestCases,
    isSubmission = false,
    timeLimitSec = 4.0,
  } = params;

  // 1. Language allowlist validation
  if (!ALLOWED_LANGUAGES.includes(language)) {
    return {
      success: false,
      provider: 'none',
      isRunnerAvailable: false,
      runnerType: 'disabled_no_sandbox',
      status: 'rejected_unsupported_language',
      testCaseResults: [],
      totalPassed: 0,
      totalTests: 0,
      runtimeMs: 0,
      memoryKb: 0,
      message: `Language '${language}' is not permitted. Allowed languages: ${ALLOWED_LANGUAGES.join(', ')}`,
    };
  }

  // 2. Maximum source code length enforcement
  if (typeof code !== 'string' || code.length > MAX_SOURCE_CODE_LENGTH) {
    return {
      success: false,
      provider: 'none',
      isRunnerAvailable: false,
      runnerType: 'disabled_no_sandbox',
      status: 'rejected_code_too_large',
      testCaseResults: [],
      totalPassed: 0,
      totalTests: 0,
      runtimeMs: 0,
      memoryKb: 0,
      message: `Source code exceeds maximum permitted length of ${MAX_SOURCE_CODE_LENGTH} characters (received ${code?.length || 0}).`,
    };
  }

  // 3. Filter test cases (visible only for Run, all for Submit)
  const testCasesToRun = isSubmission
    ? allTestCases
    : allTestCases.filter((tc) => !tc.isHidden);

  // 4. Retrieve active provider
  const provider = getActiveExecutionProvider(language);

  if (!provider) {
    // When no isolated external runner is configured:
    // Strictly enforce security: do NOT execute arbitrary code in Next.js process,
    // do NOT simulate execution with hardcoded strings, and do NOT fabricate passes.
    return {
      success: false,
      provider: 'none',
      testCaseResults: testCasesToRun.map((tc) => ({
        testCaseId: tc.id,
        passed: false,
        input: tc.isHidden ? '[hidden test]' : tc.input,
        expected: tc.isHidden ? '[hidden output]' : tc.expectedOutput,
        actual: 'Execution unavailable (sandbox runner not configured)',
        runtimeMs: 0,
        status: 'provider_unavailable',
        isHidden: tc.isHidden,
      })),
      totalPassed: 0,
      totalTests: testCasesToRun.length,
      runtimeMs: 0,
      memoryKb: 0,
      runnerType: 'disabled_no_sandbox',
      isRunnerAvailable: false,
      status: 'provider_unavailable',
      message:
        'Sandboxed code execution is offline. A configured runner (ONLINECOMPILER_API_KEY, JUDGE0_API_URL, or PISTON_API_URL) is required for dynamic execution. Solution drafting and hint progression remain fully available.',
    };
  }

  // 5. Execute test cases against real isolated provider
  try {
    const results: SingleTestExecution[] = [];

    for (const tc of testCasesToRun) {
      const run = await provider.executeTestCase({
        code,
        language,
        stdin: tc.input,
        expectedOutput: tc.expectedOutput,
        timeLimitSec,
        problemId,
      });

      // Keep hidden test cases confidential: mask input and expected output in client response
      const clientInput = tc.isHidden ? '[hidden test input]' : tc.input;
      const clientExpected = tc.isHidden ? '[hidden test output]' : tc.expectedOutput;
      const clientActual = tc.isHidden
        ? run.passed
          ? '[hidden test passed]'
          : `[hidden test failed: ${run.actual}]`
        : run.actual;

      results.push({
        testCaseId: tc.id,
        passed: run.passed,
        input: clientInput,
        expected: clientExpected,
        actual: clientActual,
        runtimeMs: run.runtimeMs,
        memoryKb: run.memoryKb,
        status: run.status,
        error: run.error,
        compileOutput: run.compileOutput,
        isHidden: tc.isHidden,
      });

      // If compilation error, short-circuit further test execution
      if (run.status === 'compilation_error') {
        break;
      }
    }

    const totalPassed = results.filter((r) => r.passed).length;
    const allPassed = totalPassed === testCasesToRun.length;
    const providerUnavailable = results.find((r) => r.status === 'provider_unavailable');
    const malformedResponse = results.find((r) => r.status === 'malformed_response');
    const rateLimited = results.find((r) => r.status === 'rate_limited');
    const compilationError = results.find((r) => r.status === 'compilation_error');
    const runtimeError = results.find((r) => r.status === 'runtime_error');
    const timeoutError = results.find((r) => r.status === 'time_limit_exceeded');

    const overallStatus = providerUnavailable
      ? 'provider_unavailable'
      : malformedResponse
      ? 'malformed_response'
      : rateLimited
      ? 'rate_limited'
      : compilationError
      ? 'compilation_error'
      : timeoutError
      ? 'time_limit_exceeded'
      : runtimeError
      ? 'runtime_error'
      : allPassed
      ? 'success'
      : 'wrong_answer';

    const isAvailable = !providerUnavailable && !malformedResponse && !rateLimited;

    return {
      success: allPassed && isAvailable,
      provider: provider.name,
      isRunnerAvailable: isAvailable,
      runnerType: isAvailable ? 'sandbox' : 'disabled_no_sandbox',
      status: overallStatus,
      testCaseResults: results,
      totalPassed: isAvailable ? totalPassed : 0,
      totalTests: testCasesToRun.length,
      runtimeMs: results.reduce((sum, r) => sum + r.runtimeMs, 0),
      memoryKb: results.reduce((max, r) => Math.max(max, r.memoryKb || 0), 0),
      message: providerUnavailable
        ? (providerUnavailable.error || 'Code execution runner is currently unavailable or requires whitelisted authorization.')
        : malformedResponse
        ? 'Runner returned an unexpected or malformed response.'
        : rateLimited
        ? `${rateLimited.error ? `${rateLimited.error} ` : ''}SkillPilot is operating in Solution Drafting Mode until quota resets.`
        : allPassed
        ? 'All test cases passed on the isolated runner!'
        : compilationError
        ? 'Compilation error on runner'
        : timeoutError
        ? 'Time limit exceeded'
        : 'Some test cases did not produce the expected output.',
    };
  } catch (err) {
    return {
      success: false,
      provider: provider.name,
      isRunnerAvailable: false,
      runnerType: 'sandbox',
      status: 'provider_unavailable',
      testCaseResults: testCasesToRun.map((tc) => ({
        testCaseId: tc.id,
        passed: false,
        input: tc.isHidden ? '[hidden]' : tc.input,
        expected: tc.isHidden ? '[hidden]' : tc.expectedOutput,
        actual: 'Runner communication failure',
        runtimeMs: 0,
        status: 'provider_unavailable',
        error: err instanceof Error ? err.message : 'Unknown runner error',
        isHidden: tc.isHidden,
      })),
      totalPassed: 0,
      totalTests: testCasesToRun.length,
      runtimeMs: 0,
      memoryKb: 0,
      message: 'Failed to communicate with execution sandbox. No verified evidence was awarded.',
    };
  }
}
