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

  private getExecuteUrl(): string {
    const base = this.getBaseUrl();
    if (base.endsWith('/execute')) return base;
    if (base.endsWith('/api/v2/piston')) return `${base}/execute`;
    if (base.endsWith('/api/v2')) return `${base}/execute`;
    return `${base}/api/v2/execute`;
  }

  private getRuntimesUrl(): string {
    const base = this.getBaseUrl();
    if (base.endsWith('/execute')) return base.replace(/\/execute$/, '/runtimes');
    if (base.endsWith('/api/v2/piston')) return `${base}/runtimes`;
    if (base.endsWith('/api/v2')) return `${base}/runtimes`;
    return `${base}/api/v2/runtimes`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const apiKey = process.env.PISTON_API_KEY;
    if (apiKey) {
      headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    }
    return headers;
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
      const res = await fetch(this.getRuntimesUrl(), {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        return { ok: false, message: `Piston returned HTTP ${res.status}` };
      }

      try {
        const probe = await fetch(this.getExecuteUrl(), {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            language: 'python',
            version: '*',
            files: [{ content: 'print(1)' }],
          }),
          signal: AbortSignal.timeout(3000),
        });

        if (probe.status === 401) {
          return {
            ok: false,
            message: 'Piston runner requires IP whitelisting or authorization (HTTP 401)',
          };
        }
        if (probe.ok) {
          return { ok: true, message: 'Piston online and execution active' };
        }
      } catch {
        // Fall back to runtimes status if probe times out
      }

      return { ok: true, message: 'Piston online' };
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
      const res = await fetch(this.getExecuteUrl(), {
        method: 'POST',
        headers: this.getHeaders(),
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
        const errorMsg =
          res.status === 401
            ? 'Piston API requires IP whitelisting or authorization (HTTP 401)'
            : res.status === 403
            ? 'Piston API access forbidden (HTTP 403)'
            : `Piston returned HTTP ${res.status}`;
        return {
          passed: false,
          actual: `Runner HTTP ${res.status}`,
          runtimeMs: 0,
          status: 'provider_unavailable',
          error: errorMsg,
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
