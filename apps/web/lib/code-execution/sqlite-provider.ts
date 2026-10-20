import type {
  CodeExecutionProvider,
  ExecutionStatus,
  ProgrammingLanguage,
} from './types.ts';

export class SqliteExecutionProvider implements CodeExecutionProvider {
  name: 'sqlite_internal' = 'sqlite_internal';

  isConfigured(): boolean {
    return true; // Node built-in node:sqlite is always available
  }

  getSupportedLanguages(): ProgrammingLanguage[] {
    return ['sql'];
  }

  async checkHealth(): Promise<{ ok: boolean; message?: string }> {
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const db = new DatabaseSync(':memory:');
      db.exec('SELECT 1;');
      db.close();
      return { ok: true, message: 'Isolated in-memory SQLite practice engine active' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'SQLite practice engine unavailable',
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
    const { code, language, stdin, expectedOutput, problemId = '' } = params;

    if (language !== 'sql') {
      return {
        passed: false,
        actual: 'Unsupported language',
        runtimeMs: 0,
        status: 'rejected_unsupported_language',
        error: `Language ${language} is not supported by the SQL practice engine`,
      };
    }

    const startTime = Date.now();
    let db: any = null;

    try {
      // 1. Initialize isolated, disposable in-memory database
      // Strictly in-memory: NEVER connects to or reads production PostgreSQL database
      const { DatabaseSync } = await import('node:sqlite');
      db = new DatabaseSync(':memory:');

      // 2. Setup problem-specific practice tables
      const cleanProblemId = problemId.replace(/^prob-/, '');

      if (cleanProblemId === 'sql-second-highest' || cleanProblemId === 'sql-second-highest-salary') {
        db.exec(`CREATE TABLE Employee (id INTEGER PRIMARY KEY, salary INTEGER);`);

        // Parse test case input rows
        let rows: any[] = [];
        try {
          rows = JSON.parse(stdin);
        } catch {
          rows = [];
        }

        if (Array.isArray(rows) && rows.length > 0) {
          const insertStmt = db.prepare(`INSERT INTO Employee (id, salary) VALUES (?, ?)`);
          for (const row of rows) {
            if (Array.isArray(row) && row.length >= 2) {
              insertStmt.run(row[0], row[1]);
            }
          }
        }
      } else {
        // Generic table support for other SQL practice problems
        db.exec(`CREATE TABLE PracticeData (id INTEGER PRIMARY KEY, val TEXT);`);
      }

      // 3. Clean student query (strip trailing semicolons)
      const cleanQuery = code.trim().replace(/;+$/, '');

      if (!cleanQuery) {
        return {
          passed: false,
          actual: 'Empty SQL query',
          runtimeMs: 0,
          status: 'compilation_error',
          error: 'SQL query cannot be empty.',
        };
      }

      // 4. Prepare (compile) query
      let stmt: any;
      try {
        stmt = db.prepare(cleanQuery);
      } catch (compileErr) {
        const errMsg = compileErr instanceof Error ? compileErr.message : String(compileErr);
        return {
          passed: false,
          actual: 'SQL Compilation Error',
          runtimeMs: Date.now() - startTime,
          status: 'compilation_error',
          compileOutput: errMsg,
          error: errMsg,
        };
      }

      // 5. Execute query
      let resultRow: Record<string, any> | undefined;
      try {
        resultRow = stmt.get() as Record<string, any> | undefined;
      } catch (runtimeErr) {
        const errMsg = runtimeErr instanceof Error ? runtimeErr.message : String(runtimeErr);
        return {
          passed: false,
          actual: 'SQL Execution Error',
          runtimeMs: Date.now() - startTime,
          status: 'runtime_error',
          error: errMsg,
        };
      }

      // 6. Format output
      let actual = 'null';
      if (resultRow && typeof resultRow === 'object') {
        const values = Object.values(resultRow);
        if (values.length > 0) {
          const firstVal = values[0];
          actual = firstVal === null || firstVal === undefined ? 'null' : String(firstVal);
        }
      }

      const normalizedActual = actual.trim();
      const normalizedExpected = expectedOutput.trim();
      const passed = normalizedActual === normalizedExpected;

      return {
        passed,
        actual,
        runtimeMs: Math.max(1, Date.now() - startTime),
        memoryKb: 512,
        status: passed ? 'success' : 'wrong_answer',
      };
    } catch (err) {
      return {
        passed: false,
        actual: 'Practice database execution error',
        runtimeMs: Date.now() - startTime,
        status: 'runtime_error',
        error: err instanceof Error ? err.message : 'Unknown practice DB error',
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // ignore close error
        }
      }
    }
  }
}
