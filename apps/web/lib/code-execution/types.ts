/**
 * Code Execution Provider Abstraction Types
 */

export type ProgrammingLanguage = 'python' | 'javascript' | 'c' | 'cpp' | 'java' | 'sql';

export const ALLOWED_LANGUAGES: readonly ProgrammingLanguage[] = [
  'python',
  'javascript',
  'c',
  'cpp',
  'java',
  'sql',
] as const;

export const MAX_SOURCE_CODE_LENGTH = 50_000;
export const MAX_EXECUTION_TIME_SECONDS = 5;
export const MAX_MEMORY_LIMIT_KB = 128_000; // 128 MB

export type ExecutionStatus =
  | 'success'
  | 'wrong_answer'
  | 'compilation_error'
  | 'runtime_error'
  | 'time_limit_exceeded'
  | 'memory_limit_exceeded'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'malformed_response'
  | 'rejected_unsupported_language'
  | 'rejected_code_too_large';

export interface SingleTestExecution {
  testCaseId: string;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  runtimeMs: number;
  memoryKb?: number;
  status: ExecutionStatus;
  error?: string;
  compileOutput?: string;
  isHidden?: boolean;
}

export interface CodeExecutionResult {
  success: boolean;
  provider: 'judge0' | 'piston' | 'none';
  isRunnerAvailable: boolean;
  runnerType: 'sandbox' | 'disabled_no_sandbox';
  status: ExecutionStatus;
  testCaseResults: SingleTestExecution[];
  totalPassed: number;
  totalTests: number;
  runtimeMs: number;
  memoryKb: number;
  message?: string;
}

export interface TestCaseDefinition {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  explanation?: string;
}

export interface CodeExecutionProvider {
  name: 'judge0' | 'piston';
  isConfigured(): boolean;
  checkHealth(): Promise<{ ok: boolean; message?: string }>;
  getSupportedLanguages(): ProgrammingLanguage[];
  executeTestCase(params: {
    code: string;
    language: ProgrammingLanguage;
    stdin: string;
    expectedOutput: string;
    timeLimitSec?: number;
    memoryLimitKb?: number;
    problemId?: string;
  }): Promise<{
    passed: boolean;
    actual: string;
    runtimeMs: number;
    memoryKb?: number;
    status: ExecutionStatus;
    error?: string;
    compileOutput?: string;
  }>;
}
