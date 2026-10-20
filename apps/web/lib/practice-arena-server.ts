import { PRACTICE_PROBLEMS, type ProgrammingLanguage, type ExecutionResult } from './practice-arena.ts';
import { executePracticeSubmission, type CodeExecutionResult, type ExecutionStatus } from './code-execution/index.ts';

export type { CodeExecutionResult, ExecutionStatus, ExecutionResult };

/**
 * Execute student code against test cases with safe execution boundary.
 * Never executes untrusted code directly inside the main Next.js process.
 * Uses OnlineCompiler.io as the primary remote runner (or Judge0 / Piston as fallback) when configured.
 * When runner is offline, enters Solution Drafting Mode without awarding fake evidence.
 */
export async function executeCodeSafely(
  code: string,
  problemId: string,
  language: ProgrammingLanguage,
  isSubmission: boolean = false
): Promise<ExecutionResult> {
  const problem = PRACTICE_PROBLEMS.find((p) => p.id === problemId);
  if (!problem) {
    throw new Error('Problem not found');
  }

  const result = await executePracticeSubmission({
    code,
    problemId,
    language,
    testCases: problem.testCases,
    isSubmission,
    timeLimitSec: 4.0,
  });

  return {
    success: result.success,
    provider: result.provider,
    testCaseResults: result.testCaseResults.map((tc) => ({
      testCaseId: tc.testCaseId,
      passed: tc.passed,
      input: tc.input,
      expected: tc.expected,
      actual: tc.actual,
      runtimeMs: tc.runtimeMs,
      error: tc.error,
      status: tc.status,
      compileOutput: tc.compileOutput,
    })),
    totalPassed: result.totalPassed,
    totalTests: result.totalTests,
    runtimeMs: result.runtimeMs,
    memoryKb: result.memoryKb,
    runnerType: result.runnerType,
    isRunnerAvailable: result.isRunnerAvailable,
    status: result.status,
    message: result.message,
  };
}
