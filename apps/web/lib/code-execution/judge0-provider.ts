import type {
  CodeExecutionProvider,
  ExecutionStatus,
  ProgrammingLanguage,
  SingleTestExecution,
} from './types.ts';
import { buildExecutableProgram } from './harness.ts';

const JUDGE0_LANGUAGE_IDS: Record<ProgrammingLanguage, number> = {
  javascript: 63, // JavaScript (Node.js 12.14.0) / 93
  python: 71,     // Python (3.8.1) / 92
  c: 50,          // C (GCC 9.2.0)
  cpp: 54,        // C++ (GCC 9.2.0)
  java: 62,       // Java (OpenJDK 13.0.1)
  sql: 82,        // SQLite 3.31.1
};

export class Judge0ExecutionProvider implements CodeExecutionProvider {
  name: 'judge0' = 'judge0';

  private getBaseUrl(): string {
    return (process.env.JUDGE0_API_URL || '').replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.getBaseUrl());
  }

  getSupportedLanguages(): ProgrammingLanguage[] {
    return ['python', 'javascript', 'c', 'cpp', 'java', 'sql'];
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = process.env.JUDGE0_API_KEY;
    const apiHost = process.env.JUDGE0_API_HOST;

    if (apiKey) {
      if (apiHost) {
        // RapidAPI Judge0
        headers['X-RapidAPI-Key'] = apiKey;
        headers['X-RapidAPI-Host'] = apiHost;
      } else {
        // Self-hosted Judge0 token
        headers['X-Auth-Token'] = apiKey;
      }
    }

    return headers;
  }

  async checkHealth(): Promise<{ ok: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, message: 'JUDGE0_API_URL is not set' };
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/about`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        return { ok: true, message: 'Judge0 online' };
      }
      return { ok: false, message: `Judge0 returned HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Judge0 unreachable',
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
      memoryLimitKb = 128000,
      problemId = '',
    } = params;

    const languageId = JUDGE0_LANGUAGE_IDS[language];
    if (!languageId) {
      return {
        passed: false,
        actual: 'Unsupported language',
        runtimeMs: 0,
        status: 'rejected_unsupported_language',
        error: `Language ${language} is not supported by Judge0 runner`,
      };
    }

    const { sourceCode, stdin: harnessedStdin } = buildExecutableProgram(
      code,
      problemId,
      language,
      stdin
    );

    try {
      // 1. Submit execution request with wait=true
      const submitUrl = `${this.getBaseUrl()}/submissions?base64_encoded=false&wait=true`;
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: languageId,
          stdin: harnessedStdin,
          cpu_time_limit: Math.min(timeLimitSec, 10.0),
          memory_limit: Math.min(memoryLimitKb, 256000),
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.status === 429) {
        return {
          passed: false,
          actual: 'Rate limit reached',
          runtimeMs: 0,
          status: 'rate_limited',
          error: 'Execution service rate limited. Please wait a few seconds.',
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          passed: false,
          actual: 'Authentication error',
          runtimeMs: 0,
          status: 'provider_unavailable',
          error: 'Judge0 authentication failed. Please verify provider credentials.',
        };
      }

      if (!res.ok) {
        return {
          passed: false,
          actual: `Runner HTTP ${res.status}`,
          runtimeMs: 0,
          status: 'provider_unavailable',
          error: `Judge0 returned HTTP ${res.status}`,
        };
      }

      let data = await res.json();

      // 2. If queued or processing (token returned without final status), perform bounded polling
      if (data && data.status && (data.status.id === 1 || data.status.id === 2) && data.token) {
        data = await this.pollSubmission(data.token);
      }

      return this.mapJudge0Result(data, expectedOutput);
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

  private async pollSubmission(token: string): Promise<any> {
    const maxAttempts = 10;
    const intervalMs = 600;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      try {
        const pollUrl = `${this.getBaseUrl()}/submissions/${token}?base64_encoded=false`;
        const res = await fetch(pollUrl, {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(3000),
        });

        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.status && data.status.id > 2) {
          return data; // Final execution status achieved
        }
      } catch {
        // Continue polling until max attempts
      }
    }

    return {
      status: { id: 5, description: 'Time Limit Exceeded (Polling Timeout)' },
      stderr: 'Execution timed out waiting for runner queue.',
    };
  }

  private mapJudge0Result(data: any, expectedOutput: string) {
    if (!data || !data.status) {
      return {
        passed: false,
        actual: 'Malformed runner response',
        runtimeMs: 0,
        status: 'malformed_response' as ExecutionStatus,
        error: 'Runner returned an unexpected or empty response format.',
      };
    }

    const statusId = Number(data.status.id);
    const stdout = (data.stdout || '').trim();
    const stderr = (data.stderr || '').trim();
    const compileOutput = (data.compile_output || '').trim();
    const runtimeMs = data.time ? Math.round(parseFloat(data.time) * 1000) : 0;
    const memoryKb = data.memory || 0;

    // Status 3: Accepted
    if (statusId === 3) {
      const normalizedActual = stdout.replace(/\r\n/g, '\n').trim();
      const normalizedExpected = expectedOutput.replace(/\r\n/g, '\n').trim();
      const passed = normalizedActual === normalizedExpected;

      return {
        passed,
        actual: stdout || 'No output',
        runtimeMs,
        memoryKb,
        status: (passed ? 'success' : 'wrong_answer') as ExecutionStatus,
        error: stderr || undefined,
      };
    }

    // Status 4: Wrong Answer
    if (statusId === 4) {
      return {
        passed: false,
        actual: stdout || 'Wrong answer',
        runtimeMs,
        memoryKb,
        status: 'wrong_answer' as ExecutionStatus,
        error: stderr || undefined,
      };
    }

    // Status 5: Time Limit Exceeded
    if (statusId === 5) {
      return {
        passed: false,
        actual: 'Time Limit Exceeded',
        runtimeMs: runtimeMs || 4000,
        status: 'time_limit_exceeded' as ExecutionStatus,
        error: 'Execution exceeded the allotted CPU time limit.',
      };
    }

    // Status 6: Compilation Error
    if (statusId === 6) {
      return {
        passed: false,
        actual: 'Compilation Error',
        runtimeMs: 0,
        status: 'compilation_error' as ExecutionStatus,
        compileOutput: compileOutput || stderr || 'Compilation failed',
        error: compileOutput || stderr,
      };
    }

    // Status 7-12: Runtime Errors
    if (statusId >= 7 && statusId <= 12) {
      return {
        passed: false,
        actual: 'Runtime Error',
        runtimeMs,
        memoryKb,
        status: 'runtime_error' as ExecutionStatus,
        error: stderr || data.message || `Runtime error (${data.status.description})`,
      };
    }

    // Status 13: Internal Error
    if (statusId === 13) {
      return {
        passed: false,
        actual: 'Runner Internal Error',
        runtimeMs: 0,
        status: 'provider_unavailable' as ExecutionStatus,
        error: 'The execution runner encountered an internal infrastructure error.',
      };
    }

    return {
      passed: false,
      actual: stdout || stderr || 'Execution failed',
      runtimeMs,
      memoryKb,
      status: 'runtime_error' as ExecutionStatus,
      error: stderr || data.status.description,
    };
  }
}
