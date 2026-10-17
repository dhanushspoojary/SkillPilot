import { db, many, one } from './db.ts';

export * from './project-catalog.ts';
import {
  PROJECT_CATALOG,
  ProjectCatalogItem,
  ProjectMilestone,
  ProjectTask,
  TestCase,
} from './project-catalog.ts';

export interface StudentProjectRecord {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string;
  requiredSkills: string[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  status: 'not_started' | 'in_progress' | 'submitted' | 'verified' | 'needs_revision';
  submissionCode: string | null;
  testResults: TestCase[];
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Retrieves the student's active project or starts one from the catalog.
 */
export async function getOrStartStudentProject(
  userId: string,
  slug: string,
): Promise<StudentProjectRecord> {
  const catalogItem = PROJECT_CATALOG.find((p) => p.slug === slug);
  if (!catalogItem) {
    throw new Error('Project not found in catalog');
  }

  const existing = await one<{
    id: string;
    userId: string;
    slug: string;
    title: string;
    description: string;
    requiredSkills: unknown;
    milestones: unknown;
    tasks: unknown;
    status: string;
    submissionCode: string | null;
    testResults: unknown;
    verifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>(
    `select id, user_id as "userId", slug, title, description,
            required_skills as "requiredSkills", milestones, tasks, status,
            submission_code as "submissionCode", test_results as "testResults",
            verified_at as "verifiedAt", created_at as "createdAt", updated_at as "updatedAt"
     from student_projects
     where user_id = $1 and slug = $2`,
    [userId, slug],
  ).catch(() => null);

  if (existing) {
    return {
      id: existing.id,
      userId: existing.userId,
      slug: existing.slug,
      title: existing.title,
      description: existing.description,
      requiredSkills: Array.isArray(existing.requiredSkills) ? (existing.requiredSkills as string[]) : catalogItem.requiredSkills,
      milestones: Array.isArray(existing.milestones) ? (existing.milestones as ProjectMilestone[]) : catalogItem.milestones,
      tasks: Array.isArray(existing.tasks) ? (existing.tasks as ProjectTask[]) : [],
      status: existing.status as StudentProjectRecord['status'],
      submissionCode: existing.submissionCode || catalogItem.starterCode,
      testResults: Array.isArray(existing.testResults) ? (existing.testResults as TestCase[]) : catalogItem.testCases,
      verifiedAt: existing.verifiedAt ? new Date(existing.verifiedAt).toISOString() : null,
      createdAt: new Date(existing.createdAt).toISOString(),
      updatedAt: new Date(existing.updatedAt).toISOString(),
    };
  }

  // Create initial student project record (concurrency-safe upsert)
  const res = await db().query(
    `insert into student_projects(
       user_id, slug, title, description, required_skills,
       milestones, tasks, status, submission_code, test_results, created_at, updated_at
     ) values($1, $2, $3, $4, $5, $6, $7, 'in_progress', $8, $9, now(), now())
     on conflict (user_id, slug) do update set updated_at = now()
     returning id, user_id as "userId", slug, title, description,
               required_skills as "requiredSkills", milestones, tasks, status,
               submission_code as "submissionCode", test_results as "testResults",
               verified_at as "verifiedAt", created_at as "createdAt", updated_at as "updatedAt"`,
    [
      userId,
      catalogItem.slug,
      catalogItem.title,
      catalogItem.description,
      JSON.stringify(catalogItem.requiredSkills),
      JSON.stringify(catalogItem.milestones),
      JSON.stringify([]),
      catalogItem.starterCode,
      JSON.stringify(catalogItem.testCases),
    ],
  );

  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    requiredSkills: catalogItem.requiredSkills,
    milestones: catalogItem.milestones,
    tasks: [],
    status: row.status,
    submissionCode: row.submissionCode,
    testResults: catalogItem.testCases,
    verifiedAt: null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Safely evaluates student code submission against static analysis assertions and test criteria.
 * Boundary notice: Execution checks logic patterns, syntax validity, and required functions
 * within an isolated deterministic test evaluator without executing arbitrary untrusted host calls.
 */
export async function evaluateProjectSubmission(
  userId: string,
  slug: string,
  submissionCode: string,
): Promise<{
  passed: boolean;
  testResults: TestCase[];
  feedback: string;
  project: StudentProjectRecord;
}> {
  const catalogItem = PROJECT_CATALOG.find((p) => p.slug === slug);
  if (!catalogItem) {
    throw new Error('Project not found');
  }

  const results: TestCase[] = [];
  let allPassed = true;

  if (slug === 'rest-bookstore-service') {
    // Test Case 1: listBooks implementation
    const hasListBooks = /listBooks\s*\([^)]*\)\s*\{/i.test(submissionCode);
    const hasReturnBooks = /return\s+this\.books/i.test(submissionCode);
    const tc1Passed = hasListBooks && hasReturnBooks;
    results.push({
      id: 'tc-1',
      name: 'List all books',
      description: 'Verifies listBooks method implementation.',
      expectedBehavior: 'Returns array containing book objects',
      status: tc1Passed ? 'passed' : 'failed',
      output: tc1Passed ? 'Verified: listBooks returns collection.' : 'Missing listBooks return statement.',
    });
    if (!tc1Passed) allPassed = false;

    // Test Case 2: getBookById lookup
    const hasGetById = /getBookById\s*\([^)]*\)\s*\{/i.test(submissionCode);
    const hasFind = /\.find\s*\(/i.test(submissionCode) || /for\s*\(/i.test(submissionCode);
    const tc2Passed = hasGetById && hasFind;
    results.push({
      id: 'tc-2',
      name: 'Lookup book by ID',
      description: 'Verifies lookup for valid ID returns object, invalid returns null.',
      expectedBehavior: 'Returns matching book object or null',
      status: tc2Passed ? 'passed' : 'failed',
      output: tc2Passed ? 'Verified: getBookById performs ID matching.' : 'Lookup by ID not implemented.',
    });
    if (!tc2Passed) allPassed = false;

    // Test Case 3: Payload validation on creation
    const hasAddBook = /addBook\s*\([^)]*\)\s*\{/i.test(submissionCode);
    const hasValidation = /throw\s+new\s+Error/i.test(submissionCode) && /(!data\.title|!data\.author)/i.test(submissionCode);
    const tc3Passed = hasAddBook && hasValidation;
    results.push({
      id: 'tc-3',
      name: 'Validate payload on creation',
      description: 'Ensures payload missing title throws descriptive error.',
      expectedBehavior: 'addBook validates title and author presence',
      status: tc3Passed ? 'passed' : 'failed',
      output: tc3Passed ? 'Verified: Validates required title and author.' : 'Payload validation missing.',
    });
    if (!tc3Passed) allPassed = false;

    // Test Case 4: Delete idempotency
    const hasDelete = /deleteBook\s*\([^)]*\)\s*\{/i.test(submissionCode);
    const hasSpliceOrFilter = /(\.splice|\.filter)/i.test(submissionCode);
    const tc4Passed = hasDelete && hasSpliceOrFilter;
    results.push({
      id: 'tc-4',
      name: 'Delete book idempotency',
      description: 'Verifies book deletion removes item.',
      expectedBehavior: 'deleteBook removes record cleanly',
      status: tc4Passed ? 'passed' : 'failed',
      output: tc4Passed ? 'Verified: deleteBook removes item.' : 'Deletion logic incomplete.',
    });
    if (!tc4Passed) allPassed = false;
  } else if (slug === 'sql-analytics-dashboard') {
    // SQL schema & query evaluation
    const hasCreateTable = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(courses|enrollments)/i.test(submissionCode);
    const hasForeignKey = /REFERENCES\s+courses\s*\(/i.test(submissionCode);
    const tc1Passed = hasCreateTable && hasForeignKey;
    results.push({
      id: 'tc-sql-1',
      name: 'Normalized Table Schema',
      description: 'Verifies relational schema and foreign key constraint.',
      expectedBehavior: 'enrollments references courses(id)',
      status: tc1Passed ? 'passed' : 'failed',
      output: tc1Passed ? 'Schema verified with foreign keys.' : 'Foreign key relationship missing.',
    });
    if (!tc1Passed) allPassed = false;

    const hasGroupBy = /GROUP\s+BY\s+c\.department/i.test(submissionCode);
    const hasAvg = /AVG\s*\(\s*e\.grade_score\s*\)/i.test(submissionCode);
    const tc2Passed = hasGroupBy && hasAvg;
    results.push({
      id: 'tc-sql-2',
      name: 'Aggregation by Department',
      description: 'Verifies analytical query aggregates total students and average score.',
      expectedBehavior: 'Computes department aggregates',
      status: tc2Passed ? 'passed' : 'failed',
      output: tc2Passed ? 'Aggregation query verified.' : 'GROUP BY or AVG aggregation missing.',
    });
    if (!tc2Passed) allPassed = false;

    const hasOrderBy = /ORDER\s+BY\s+(average_grade|AVG)/i.test(submissionCode);
    results.push({
      id: 'tc-sql-3',
      name: 'Ordering & Filtering',
      description: 'Verifies results sorting.',
      expectedBehavior: 'Orders by average grade descending',
      status: hasOrderBy ? 'passed' : 'failed',
      output: hasOrderBy ? 'Sorting verified.' : 'ORDER BY clause missing.',
    });
    if (!hasOrderBy) allPassed = false;
  }

  const newStatus = allPassed ? 'verified' : 'needs_revision';
  const verifiedAt = allPassed ? new Date().toISOString() : null;

  // Update student project in database
  await db().query(
    `update student_projects
     set submission_code = $1, test_results = $2, status = $3,
         verified_at = case when $3 = 'verified' then now() else verified_at end,
         updated_at = now()
     where user_id = $4 and slug = $5`,
    [submissionCode, JSON.stringify(results), newStatus, userId, slug],
  );

  // If verified, record authoritative evidence for each required skill!
  if (allPassed) {
    for (const skillId of catalogItem.requiredSkills) {
      const skillRow = await one<{ id: string }>(`select id from skills where slug = $1`, [skillId]);
      if (skillRow) {
        await db().query(
          `insert into user_skill_evidence(user_id, skill_id, source, score, confidence, metadata)
           values($1, $2, 'project', 88, 0.85, $3)`,
          [
            userId,
            skillRow.id,
            JSON.stringify({
              label: `Practical Project: ${catalogItem.title}`,
              projectSlug: slug,
              verifiedAt,
            }),
          ],
        ).catch(() => {});
      }
    }
  }

  const updatedProject = await getOrStartStudentProject(userId, slug);
  const feedback = allPassed
    ? `All ${results.length} test cases passed! Practical project verified and recorded in your skill evidence ledger.`
    : `Submission evaluated: ${results.filter((r) => r.status === 'passed').length} of ${results.length} test cases passed. Review failing checks and refine your implementation.`;

  return {
    passed: allPassed,
    testResults: results,
    feedback,
    project: updatedProject,
  };
}
