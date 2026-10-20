import type {
  CodeExecutionProvider,
  ExecutionStatus,
  ProgrammingLanguage,
} from './types.ts';
import { buildExecutableProgram } from './harness.ts';

const PISTON_LANGUAGE_MAP: Record<ProgrammingLanguage, string> = {
  javascript: 'javascript',
  python: 'python',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  sql: 'sqlite3',
};

export class PistonExecutionProvider implements CodeExecutionProvider {
  name: 'piston' = 'piston';

  private getBaseUrl(): string {
    return (process.env.PISTON_API_URL || '').replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.getBaseUrl());
  }

  getSupportedLanguages(): ProgrammingLanguage[] {
    return ['python', 'javascript', 'c', 'cpp', 'java', 'sql'];
  }

  async checkHealth(): Promise<{ ok: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, message: 'PISTON_API_URL is not set' };
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/api/v2/runtimes`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        return { ok: true, message: 'Piston online' };
      }
      return { ok: false, message: `Piston returned HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Piston unreachable',
      };
    }
  }

  async executeTestCase(params: {
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
  }> {
    const {
      code,
      language,
      stdin,
      expectedOutput,
      timeLimitSec = 4.0,
      problemId = '',
    } = params;

    const pistonLang = PISTON_LANGUAGE_MAP[language];
    if (!pistonLang) {
      return {
        passed: false,
        actual: 'Unsupported language',
        runtimeMs: 0,
        status: 'rejected_unsupported_language',
        error: `Language ${language} is not supported by Piston runner`,
      };
    }

    const { sourceCode, stdin: harnessedStdin } = buildExecutableProgram(
      code,
      problemId,
      language,
      stdin
    );

    try {
      const res = await fetch(`${this.getBaseUrl()}/api/v2/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: pistonLang,
          version: '*',
          files: [{ content: sourceCode }],
          stdin: harnessedStdin,
          run_timeout: Math.round(timeLimitSec * 1000),
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.status === 429) {
        return {
          passed: false,
          actual: 'Rate limit reached',
          runtimeMs: 0,
          status: 'rate_limited',
          error: 'Piston execution rate limited.',
        };
      }

      if (!res.ok) {
        return {
          passed: false,
          actual: `Runner HTTP ${res.status}`,
          runtimeMs: 0,
          status: 'provider_unavailable',
          error: `Piston returned HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      if (!data || !data.run) {
        return {
          passed: false,
          actual: 'Malformed runner response',
          runtimeMs: 0,
          status: 'malformed_response',
          error: 'Piston returned an empty or invalid payload.',
        };
      }

      const compileStderr = (data.compile?.stderr || '').trim();
      if (compileStderr && data.compile?.code !== 0) {
        return {
          passed: false,
          actual: 'Compilation Error',
          runtimeMs: 0,
          status: 'compilation_error',
          compileOutput: compileStderr,
          error: compileStderr,
        };
      }

      const stdout = (data.run.stdout || '').trim();
      const stderr = (data.run.stderr || '').trim();
      const isTimeout = data.run.signal === 'SIGKILL' || (stderr && stderr.includes('timed out'));

      if (isTimeout) {
        return {
          passed: false,
          actual: 'Time Limit Exceeded',
          runtimeMs: Math.round(timeLimitSec * 1000),
          status: 'time_limit_exceeded',
          error: 'Execution exceeded the allotted time limit.',
        };
      }

      if (data.run.code !== 0 && !stdout) {
        return {
          passed: false,
          actual: 'Runtime Error',
          runtimeMs: 10,
          status: 'runtime_error',
          error: stderr || `Exit code ${data.run.code}`,
        };
      }

      const normalizedActual = stdout.replace(/\r\n/g, '\n').trim();
      const normalizedExpected = expectedOutput.replace(/\r\n/g, '\n').trim();
      const passed = normalizedActual === normalizedExpected;

      return {
        passed,
        actual: stdout || (stderr ? `Error: ${stderr}` : 'No output'),
        runtimeMs: data.run.time ? Math.round(data.run.time * 1000) : 10,
        memoryKb: data.run.memory ? Math.round(data.run.memory / 1024) : 16000,
        status: passed ? 'success' : 'wrong_answer',
        error: stderr || undefined,
      };
    } catch (err) {
      return {
        passed: false,
        actual: 'Runner connection error',
        runtimeMs: 0,
        status: 'provider_unavailable',
        error: err instanceof Error ? err.message : 'Unknown runner error',
      };
    }
  }
}
