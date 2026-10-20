import type {
  CodeExecutionProvider,
  ExecutionStatus,
  ProgrammingLanguage,
} from './types.ts';
import { buildExecutableProgram } from './harness.ts';

const ONLINECOMPILER_LANGUAGE_MAP: Record<
  ProgrammingLanguage,
  { language: string; filename: string }
> = {
  python: { language: 'python', filename: 'main.py' },
  javascript: { language: 'javascript', filename: 'index.js' },
  c: { language: 'c', filename: 'main.c' },
  cpp: { language: 'c++', filename: 'main.cpp' },
  java: { language: 'java', filename: 'Main.java' },
  sql: { language: 'sqlite3', filename: 'query.sql' },
};

export class OnlineCompilerExecutionProvider implements CodeExecutionProvider {
  name: 'onlinecompiler' = 'onlinecompiler';

  private static readonly BASE_URL = 'https://api.onlinecompiler.io';
  private static readonly EXECUTE_ENDPOINT = `${OnlineCompilerExecutionProvider.BASE_URL}/api/v2/piston/execute`;
  private static readonly RUNTIMES_ENDPOINT = `${OnlineCompilerExecutionProvider.BASE_URL}/api/v2/piston/runtimes`;
  private static readonly HEALTH_ENDPOINT = `${OnlineCompilerExecutionProvider.BASE_URL}/api/health/`;

  private getApiKey(): string {
    return (process.env.ONLINECOMPILER_API_KEY || '').trim();
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  getSupportedLanguages(): ProgrammingLanguage[] {
    return ['python', 'javascript', 'c', 'cpp', 'java', 'sql'];
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const apiKey = this.getApiKey();
    if (apiKey) {
      headers['Authorization'] = apiKey;
    }
    return headers;
  }

  async checkHealth(): Promise<{ ok: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, message: 'ONLINECOMPILER_API_KEY is not configured' };
    }

    try {
      // 1. Verify provider service status (no-auth health endpoint)
      try {
        const healthRes = await fetch(OnlineCompilerExecutionProvider.HEALTH_ENDPOINT, {
          method: 'GET',
          signal: AbortSignal.timeout(4000),
        });
        if (healthRes.ok) {
          const healthData = await healthRes.json().catch(() => null);
          if (healthData && healthData.status !== 'ok') {
            return {
              ok: false,
              message: `OnlineCompiler health report degraded: ${JSON.stringify(healthData.checks || {})}`,
            };
          }
        }
      } catch {
        // Fall through to probe execute endpoint
      }

      // 2. Validate API key against execute endpoint
      const execRes = await fetch(OnlineCompilerExecutionProvider.EXECUTE_ENDPOINT, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          language: 'python',
          version: '*',
          files: [{ name: 'health.py', content: 'print("ok")' }],
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (execRes.status === 401 || execRes.status === 403) {
        return {
          ok: false,
          message: 'OnlineCompiler.io API key unauthorized or invalid (HTTP 401/403)',
        };
      }

      if (execRes.status === 404) {
        const bodyText = await execRes.text().catch(() => '');
        return {
          ok: false,
          message: `OnlineCompiler.io authentication rejected: ${bodyText || 'Invalid or inactive API key'}`,
        };
      }

      if (execRes.status === 429) {
        return {
          ok: false,
          message: 'OnlineCompiler.io account rate limit or monthly quota exceeded (HTTP 429)',
        };
      }

      if (!execRes.ok) {
        return {
          ok: false,
          message: `OnlineCompiler.io returned HTTP ${execRes.status}`,
        };
      }

      return { ok: true, message: 'OnlineCompiler.io online and verified' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'OnlineCompiler.io unreachable',
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

    const langConfig = ONLINECOMPILER_LANGUAGE_MAP[language];
    if (!langConfig) {
      return {
        passed: false,
        actual: 'Unsupported language',
        runtimeMs: 0,
        status: 'rejected_unsupported_language',
        error: `Language '${language}' is not supported by OnlineCompiler runner.`,
      };
    }

    if (!this.isConfigured()) {
      return {
        passed: false,
        actual: 'Provider unconfigured',
        runtimeMs: 0,
        status: 'provider_unavailable',
        error: 'ONLINECOMPILER_API_KEY is not configured on the server.',
      };
    }

    const { sourceCode, stdin: harnessedStdin } = buildExecutableProgram(
      code,
      problemId,
      language,
      stdin
    );

    const runTimeoutMs = Math.min(30000, Math.max(1000, Math.round(timeLimitSec * 1000)));

    const requestPayload = {
      language: langConfig.language,
      version: '*',
      files: [{ name: langConfig.filename, content: sourceCode }],
      stdin: harnessedStdin,
      run_timeout: runTimeoutMs,
    };

    // Execute with single bounded retry for transient network / 503 errors only
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const res = await fetch(OnlineCompilerExecutionProvider.EXECUTE_ENDPOINT, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(requestPayload),
          signal: AbortSignal.timeout(Math.min(10000, runTimeoutMs + 3000)),
        });

        // 1. Rate Limit (HTTP 429) -> Do not retry
        if (res.status === 429) {
          return {
            passed: false,
            actual: 'Rate limit / Monthly quota exceeded',
            runtimeMs: 0,
            status: 'rate_limited',
            error: 'OnlineCompiler.io rate limit or quota exceeded. SkillPilot is in Solution Drafting Mode.',
          };
        }

        // 2. Authentication failure (HTTP 401, 403, or 404 with invalid key) -> Do not retry
        if (res.status === 401 || res.status === 403) {
          return {
            passed: false,
            actual: 'Authentication error',
            runtimeMs: 0,
            status: 'provider_unavailable',
            error: 'OnlineCompiler.io authentication failed. Verify ONLINECOMPILER_API_KEY.',
          };
        }

        if (res.status === 404) {
          const bodyText = await res.text().catch(() => '');
          return {
            passed: false,
            actual: 'Authentication error',
            runtimeMs: 0,
            status: 'provider_unavailable',
            error: `OnlineCompiler.io rejected API key: ${bodyText || 'Invalid or inactive key'}.`,
          };
        }

        // 3. Bad request (HTTP 400) -> Do not retry
        if (res.status === 400) {
          const bodyText = await res.text().catch(() => '');
          const isUnknown = bodyText.toLowerCase().includes('runtime is unknown');
          return {
            passed: false,
            actual: isUnknown ? 'Unsupported runtime' : 'Bad request',
            runtimeMs: 0,
            status: isUnknown ? 'rejected_unsupported_language' : 'malformed_response',
            error: `OnlineCompiler.io rejected request: ${bodyText}`,
          };
        }

        // 4. Transient 503/504 errors: retry once if attempt === 1
        if ((res.status === 503 || res.status === 504) && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        if (!res.ok) {
          return {
            passed: false,
            actual: `Runner HTTP ${res.status}`,
            runtimeMs: 0,
            status: 'provider_unavailable',
            error: `OnlineCompiler.io returned HTTP ${res.status}`,
          };
        }

        const data = await res.json().catch(() => null);
        if (!data || !data.run) {
          return {
            passed: false,
            actual: 'Malformed runner response',
            runtimeMs: 0,
            status: 'malformed_response',
            error: 'OnlineCompiler.io returned an invalid or empty execution payload.',
          };
        }

        const run = data.run;
        const stdout = (run.stdout || '').trim();
        const stderr = (run.stderr || '').trim();

        // Check for timeout: OnlineCompiler status 'TO', SIGKILL, or stderr containing 'timed out'
        const isTimeout =
          run.status === 'TO' ||
          run.signal === 'SIGKILL' ||
          stderr.toLowerCase().includes('timed out');

        if (isTimeout) {
          return {
            passed: false,
            actual: 'Time Limit Exceeded',
            runtimeMs: runTimeoutMs,
            status: 'time_limit_exceeded',
            error: `Execution exceeded time limit of ${timeLimitSec}s.`,
          };
        }

        // Check for output limit flood (OL)
        if (run.status === 'OL') {
          return {
            passed: false,
            actual: 'Output Limit Exceeded',
            runtimeMs: run.wall_time || 10,
            status: 'runtime_error',
            error: 'Output flood exceeded maximum permitted runner buffer.',
          };
        }

        // Check for compilation errors:
        // OnlineCompiler has no separate compile stage; compilation errors arrive in run.stderr with non-zero exit code
        const isCompilationError =
          run.code !== 0 &&
          (stderr.includes('SyntaxError') ||
            stderr.includes('IndentationError') ||
            stderr.includes('TabError') ||
            stderr.includes(': error:') ||
            stderr.includes('error: expected') ||
            stderr.includes('fatal error:') ||
            stderr.includes('javac') ||
            stderr.includes('cannot find symbol') ||
            stderr.includes('undefined reference') ||
            (!stdout && stderr.toLowerCase().includes('compile')));

        if (isCompilationError) {
          return {
            passed: false,
            actual: 'Compilation Error',
            runtimeMs: 0,
            status: 'compilation_error',
            compileOutput: stderr,
            error: stderr,
          };
        }

        // Non-zero exit code without compilation pattern -> runtime error
        if (run.code !== 0) {
          return {
            passed: false,
            actual: 'Runtime Error',
            runtimeMs: run.wall_time || 10,
            status: 'runtime_error',
            error: stderr || `Exit code ${run.code}`,
          };
        }

        // Normalize output for comparison
        const normalizedActual = stdout.replace(/\r\n/g, '\n').trim();
        const normalizedExpected = expectedOutput.replace(/\r\n/g, '\n').trim();
        const passed = normalizedActual === normalizedExpected;

        // Wall time in ms, memory converted from bytes to KB
        const runtimeMs = typeof run.wall_time === 'number' ? Math.round(run.wall_time) : 15;
        const memoryKb = typeof run.memory === 'number' ? Math.round(run.memory / 1024) : 16000;

        return {
          passed,
          actual: stdout || (stderr ? `Error: ${stderr}` : 'No output'),
          runtimeMs,
          memoryKb,
          status: passed ? 'success' : 'wrong_answer',
          error: passed ? undefined : (stderr || undefined),
        };
      } catch (err) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        return {
          passed: false,
          actual: 'Runner connection error',
          runtimeMs: 0,
          status: 'provider_unavailable',
          error: err instanceof Error ? err.message : 'Unknown OnlineCompiler connection error',
        };
      }
    }

    return {
      passed: false,
      actual: 'Runner communication failure',
      runtimeMs: 0,
      status: 'provider_unavailable',
      error: 'Failed to communicate with OnlineCompiler.io runner after bounded retry.',
    };
  }
}
