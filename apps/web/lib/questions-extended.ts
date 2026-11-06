import type { Question } from './types.ts';

export const EXTENDED_QUESTIONS: Question[] = [
  // ==========================================
  // REST APIs: Level 4 & 5
  // ==========================================
  {
    id: 'rest-4a',
    skill: 'rest-apis',
    level: 4,
    q: 'In an Express API middleware, what happens if an asynchronous route handler throws an unhandled error inside a Promise and does not call next(err)?',
    options: [
      'The client request hangs until timeout because Express cannot catch unhandled Promise rejections automatically without a custom wrapper or next(err)',
      'Express automatically returns HTTP 500 within 1 millisecond',
      'The database rollbacks all tables automatically',
      'The request converts into a GET request',
    ],
    answer: 0,
    why: 'In Express 4, asynchronous errors in Promise chains are not intercepted by synchronous try-catch; if next(err) is not invoked, the response never closes, causing client timeout.',
    prerequisiteConcept: 'express-async-error-handling',
  },
  {
    id: 'rest-4b',
    skill: 'rest-apis',
    level: 4,
    q: 'A frontend web app sends a POST request with header "Content-Type: application/json" to a backend on another domain. The browser network tab shows an error on an OPTIONS request with status 405 Method Not Allowed. What is the root cause?',
    options: [
      'The server is rejecting the CORS preflight OPTIONS request required for non-simple headers like application/json',
      'The user is not logged into their computer',
      'JSON format cannot be sent across the internet',
      'The client URL contains too many query parameters',
    ],
    answer: 0,
    why: 'When sending requests with Content-Type: application/json across origins, browsers dispatch a preflight OPTIONS request first. If the server does not handle OPTIONS, the actual POST is blocked by CORS.',
    prerequisiteConcept: 'cors-preflight-handling',
  },
  {
    id: 'rest-5a',
    skill: 'rest-apis',
    level: 5,
    q: 'Under high concurrency, two distributed workers concurrently process the same webhook with identical Idempotency-Key. How do you prevent race conditions and duplicate writes in the database?',
    options: [
      'Use a distributed lock (e.g., Redis SETNX with TTL) or a database unique constraint on idempotency_key to ensure only one worker executes the business logic',
      'Increase the server RAM to 64GB',
      'Rely on client-side setTimeout to delay requests',
      'Turn off database transactions',
    ],
    answer: 0,
    why: 'A distributed lock or unique constraint on the idempotency key serializes concurrent executions, guaranteeing exactly-once side-effects even when duplicate requests hit different server instances simultaneously.',
    prerequisiteConcept: 'distributed-idempotency-locking',
  },
  {
    id: 'rest-5b',
    skill: 'rest-apis',
    level: 5,
    q: 'When an upstream service returns HTTP 429 Too Many Requests, which client retry strategy prevents thundering herd / request storm failures across thousands of client instances?',
    options: [
      'Truncated exponential backoff combined with randomized decorrelated jitter',
      'Immediate retries in a tight while loop',
      'Sending 10 parallel requests to test which succeeds first',
      'Disabling HTTPS encryption',
    ],
    answer: 0,
    why: 'Exponential backoff increases wait times exponentially while random jitter spreads client retry timestamps over a time window, breaking request synchronization and thundering herds.',
    prerequisiteConcept: 'exponential-backoff-jitter',
  },

  // ==========================================
  // SQL: Level 4 & 5
  // ==========================================
  {
    id: 'sql-4b',
    skill: 'sql',
    level: 4,
    q: 'Consider this query: SELECT * FROM users WHERE status != \'active\'. In SQL, why does this query unexpectedly exclude users whose status is NULL?',
    options: [
      'In SQL three-valued logic, comparing NULL with any value using != evaluates to UNKNOWN, not TRUE, so the WHERE clause filters it out',
      'NULL values are always automatically converted to active',
      'The database ignores rows with NULL to save bandwidth',
      'The query has a syntax error',
    ],
    answer: 0,
    why: 'In three-valued logic (TRUE, FALSE, UNKNOWN), any comparison with NULL (e.g. NULL != "active") produces UNKNOWN. The WHERE clause only includes rows that evaluate to TRUE. You must use "status != \'active\' OR status IS NULL".',
    prerequisiteConcept: 'sql-three-valued-logic',
  },
  {
    id: 'sql-5a',
    skill: 'sql',
    level: 5,
    q: 'In PostgreSQL, why can a query with WHERE tenant_id = 42 AND created_at > now() - interval \'7 days\' fail to use an index on created_at if only a B-Tree on (created_at) exists?',
    options: [
      'Without an index on (tenant_id, created_at), PostgreSQL may perform a sequential scan if the tenant filter removes most rows or the planner estimates scanning the index is costlier than a heap scan',
      'PostgreSQL does not support composite queries',
      'B-Tree indexes cannot index timestamp columns',
      'The interval keyword disables database indexes',
    ],
    answer: 0,
    why: 'A composite index on (tenant_id, created_at) allows PostgreSQL to seek directly to the tenant and slice the range. A single-column index on created_at requires filtering every tenant row separately.',
    prerequisiteConcept: 'composite-indexing-strategies',
  },
  {
    id: 'sql-5b',
    skill: 'sql',
    level: 5,
    q: 'Under the default READ COMMITTED transaction isolation level, what concurrency anomaly can occur when two transactions concurrently read and write to the same account balance table without row locks?',
    options: [
      'Non-repeatable reads and lost updates, where one transaction overwrites changes committed by another concurrent transaction',
      'Permanent corruption of the database schema file',
      'Automatic dropping of primary key constraints',
      'Zero anomalies because READ COMMITTED guarantees serializable execution',
    ],
    answer: 0,
    why: 'READ COMMITTED only prevents dirty reads. It permits non-repeatable reads and phantom rows; without SELECT ... FOR UPDATE or SERIALIZABLE isolation, concurrent read-modify-write cycles can cause lost updates.',
    prerequisiteConcept: 'transaction-isolation-levels',
  },

  // ==========================================
  // JavaScript: Level 4 & 5
  // ==========================================
  {
    id: 'js-4b',
    skill: 'javascript',
    level: 4,
    q: 'Consider this execution:\nconsole.log(1);\nsetTimeout(() => console.log(2), 0);\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);\nWhat is the exact logged sequence and why?',
    options: [
      '1, 4, 3, 2 because synchronous code runs first, then microtasks (Promise.then) drain completely before the next macrotask (setTimeout) is executed',
      '1, 2, 3, 4 in top-to-bottom order',
      '1, 4, 2, 3 because setTimeout with 0 runs before microtasks',
      '4, 3, 2, 1 because asynchronous code runs in reverse',
    ],
    answer: 0,
    why: 'The JavaScript event loop executes the synchronous call stack first (1, 4). When the stack is clear, all pending microtasks (Promise resolution: 3) are drained before moving to the macrotask queue (setTimeout callback: 2).',
    prerequisiteConcept: 'event-loop-microtask-macrotask',
  },
  {
    id: 'js-5a',
    skill: 'javascript',
    level: 5,
    q: 'A Node.js server experiences continuous memory growth in production until crashing with HeapOutOfMemory. Profiling shows thousands of lingering closure contexts. What is the most common root cause?',
    options: [
      'Adding event listeners (e.g., emitter.on) inside recurring request handlers without removing them, or retaining references to large request objects inside long-lived module-level closures',
      'Using const instead of let',
      'Using JSON.stringify on strings',
      'Writing too many comments in JavaScript files',
    ],
    answer: 0,
    why: 'Retaining references inside module-scoped arrays or un-deregistered event listeners prevents the garbage collector from freeing closure scope chains, resulting in cumulative memory leaks.',
    prerequisiteConcept: 'closure-memory-leak-profiling',
  },
  {
    id: 'js-5b',
    skill: 'javascript',
    level: 5,
    q: 'How does AbortController facilitate cancellation of long-running HTTP fetch requests in modern JavaScript when a user navigates away or a timeout expires?',
    options: [
      'Passing { signal: controller.signal } into fetch allows calling controller.abort() to cancel the underlying network socket and immediately reject the promise with an AbortError',
      'It deletes the browser cache',
      'It stops the CPU clock for 100 milliseconds',
      'It restarts the web browser tab',
    ],
    answer: 0,
    why: 'AbortController provides an AbortSignal consumed by fetch and event listeners. Calling abort() terminates network I/O immediately and triggers abort event handlers.',
    prerequisiteConcept: 'abortcontroller-cancellation',
  },

  // ==========================================
  // Problem Solving: Level 4 & 5
  // ==========================================
  {
    id: 'ps-4b',
    skill: 'problem-solving',
    level: 4,
    q: 'Trace this loop execution:\nlet i = 0;\nwhile (i < 3) {\n  if (i === 1) continue;\n  console.log(i);\n  i++;\n}\nWhat happens when this code is executed?',
    options: [
      'An infinite loop occurs at i = 1 because continue skips the i++ increment statement, keeping i equal to 1 forever',
      'It prints 0, 2 and terminates normally',
      'It prints 0, 1, 2',
      'It throws a syntax error on continue',
    ],
    answer: 0,
    why: 'When i becomes 1, the condition i === 1 triggers continue. This skips the rest of the loop body (including i++), so i remains 1 on the next iteration, resulting in an infinite loop.',
    prerequisiteConcept: 'loop-state-tracing-off-by-one',
  },
  {
    id: 'ps-5b',
    skill: 'problem-solving',
    level: 5,
    q: 'You need to find the median of two sorted arrays of lengths m and n in O(log(min(m, n))) time complexity. What core algorithmic principle must be employed?',
    options: [
      'Binary search partition on the smaller array, verifying that elements on the left side of the partition are <= elements on the right side',
      'Merging both arrays completely into a new array of size m + n',
      'Sorting with Quicksort in O((m+n) log(m+n))',
      'Random sampling of 5 elements from each array',
    ],
    answer: 0,
    why: 'Binary searching the partition index in the smaller array allows partitioning both arrays such that the left half contains (m + n + 1) / 2 elements with max(Left) <= min(Right) in logarithmic time.',
    prerequisiteConcept: 'binary-search-partitioning',
  },

  // ==========================================
  // Git: Level 4 & 5
  // ==========================================
  {
    id: 'git-4a',
    skill: 'git',
    level: 4,
    q: 'When resolving a Git merge conflict in a file, what does the text between "<<<<<<< HEAD" and "=======" represent?',
    options: [
      'The version of the code present on your currently checked-out branch before the merge attempted to apply changes',
      'The remote version coming from the other branch',
      'Code automatically generated by GitHub',
      'Deleted code permanently removed from disk',
    ],
    answer: 0,
    why: 'In conflict markers, the section between <<<<<<< HEAD and ======= shows the local modifications on the active branch, while ======= to >>>>>>> shows the incoming branch modifications.',
    prerequisiteConcept: 'git-conflict-marker-resolution',
  },
  {
    id: 'git-4b',
    skill: 'git',
    level: 4,
    q: 'A developer inadvertently checks out a specific commit hash directly (git checkout a1b2c3d) instead of a branch name. Git displays "You are in \'detached HEAD\' state". What does this mean?',
    options: [
      'HEAD points directly to a commit rather than a branch reference; any new commits made here will not belong to any branch and may be lost when switching branches unless a branch is created',
      'The repository is corrupted and must be re-cloned',
      'The developer has lost commit permissions to the repository',
      'Git has deleted the working tree',
    ],
    answer: 0,
    why: 'In a detached HEAD state, HEAD points to a raw commit hash. If you commit changes without creating a branch (e.g. git switch -c new-feature), those commits become dangling and subject to garbage collection.',
    prerequisiteConcept: 'git-detached-head-recovery',
  },
  {
    id: 'git-5a',
    skill: 'git',
    level: 5,
    q: 'A developer accidentally ran "git reset --hard HEAD~3" and lost three critical local commits that were never pushed to a remote server. How can these commits be recovered?',
    options: [
      'Inspect "git reflog" to find the SHA-1 commit hashes of the previous HEAD states and run "git cherry-pick" or "git branch recover-branch <hash>"',
      'Commits cannot ever be recovered once reset --hard is run',
      'Reinstall the Git binary on the computer',
      'Run git push --force',
    ],
    answer: 0,
    why: 'Git maintains an append-only reference log (reflog) recording every update to HEAD. Dangling commits remain in the local object database until git gc runs, enabling full recovery.',
    prerequisiteConcept: 'git-reflog-recovery',
  },
  {
    id: 'git-5b',
    skill: 'git',
    level: 5,
    q: 'A regression bug was introduced somewhere in the last 200 commits on the main branch. What is the most efficient Git command workflow to locate the exact commit that introduced the failure in O(log N) steps?',
    options: [
      'Use "git bisect start", mark "git bisect bad" and "git bisect good <older-commit>", and run automated tests on the binary search checkout steps',
      'Manually checkout and test each of the 200 commits one by one in chronological order',
      'Delete the repository and start fresh',
      'Run git blame on every single file in the project',
    ],
    answer: 0,
    why: 'git bisect performs a binary search through the commit history, reducing the testing required from 200 linear checks down to ~8 logarithmic checks.',
    prerequisiteConcept: 'git-bisect-regression-hunting',
  },

  // ==========================================
  // Communication: Level 4 & 5
  // ==========================================
  {
    id: 'communication-4a',
    skill: 'communication',
    level: 4,
    q: 'During code review, you spot a potential race condition in a teammate\'s pull request. Which code review feedback approach is most constructive and effective?',
    options: [
      'Explain the concrete concurrency scenario line-by-line, link the relevant documentation, and suggest a specific alternative or lock with code example: "In scenario X when two requests arrive simultaneously, Y could happen. What do you think about using Z?"',
      'Leave a comment saying "This code is completely broken, rewrite it"',
      'Silently approve the PR to avoid interpersonal friction',
      'Message the team manager privately without telling the author',
    ],
    answer: 0,
    why: 'Effective technical code review focuses on the problem scenario, explains the underlying failure mode objectively, and suggests actionable alternatives collaboratively.',
    prerequisiteConcept: 'constructive-code-review-feedback',
  },
  {
    id: 'communication-4b',
    skill: 'communication',
    level: 4,
    q: 'When writing reproduction steps in a high-priority software bug report, what information is essential for engineers to diagnose and resolve the issue quickly?',
    options: [
      'Exact steps to reproduce, expected vs actual behavior, environment details (OS, browser/version, commit hash), and relevant logs or error stack traces',
      'Only stating "The website does not work on my computer"',
      'A screenshot of the computer desktop without any text',
      'The author\'s personal opinion about the programming language',
    ],
    answer: 0,
    why: 'Actionable bug reports provide deterministic reproduction steps, clear environmental context, and exact error traces, minimizing back-and-forth debugging time.',
    prerequisiteConcept: 'actionable-bug-reporting',
  },
  {
    id: 'communication-5a',
    skill: 'communication',
    level: 5,
    q: 'Following a production outage caused by a database migration failure, how should an engineering team conduct an effective Post-Mortem / Incident Review?',
    options: [
      'Conduct a blameless post-mortem focusing on systemic failure modes, timeline of events, why automated guardrails failed, and concrete preventive action items with owners',
      'Identify and publicly blame the specific engineer who executed the migration',
      'Never document incidents to avoid liability',
      'Disable database migrations permanently',
    ],
    answer: 0,
    why: 'Blameless post-mortems cultivate engineering psychological safety, identifying root systemic vulnerabilities and preventative automation rather than scapegoating human error.',
    prerequisiteConcept: 'blameless-post-mortem-culture',
  },
  {
    id: 'communication-5b',
    skill: 'communication',
    level: 5,
    q: 'Your team must introduce a breaking change to a core public API endpoint consumed by multiple external client teams. How should this deprecation and migration be communicated?',
    options: [
      'Publish a clear migration guide, introduce API versioning (e.g. /v2), send advance notices with deprecation timeline, and log deprecation warnings in response headers before decommissioning',
      'Shut down the old endpoint overnight without notice',
      'Silently return empty JSON responses on the old endpoint',
      'Change the response schema without updating documentation',
    ],
    answer: 0,
    why: 'Deprecation requires graceful migration paths: versioning, proactive multi-channel notification, clear migration documentation, and telemetry to track legacy client adoption.',
    prerequisiteConcept: 'api-deprecation-communication',
  },
];
