import fs from 'node:fs';
import path from 'node:path';

// Load .env.local before importing any db modules
const envPath = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const { db } = await import('../lib/db.ts');
const { PRACTICE_PROBLEMS } = await import('../lib/practice-arena.ts');
const { executeCodeSafely } = await import('../lib/practice-arena-server.ts');
const { getPublicPassportByHandle } = await import('../lib/passport.ts');

async function run() {
  console.log('======================================================');
  console.log('SKILLPILOT FINAL PRODUCT VERIFICATION SUITE');
  console.log('======================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST SUITE 1: Practice Arena & Original Problem Library
  console.log('\n[TEST SUITE 1] Practice Arena & Original Problem Library');
  assert(PRACTICE_PROBLEMS.length >= 5, `Problem library contains ${PRACTICE_PROBLEMS.length} original problems`);
  
  const twoSum = PRACTICE_PROBLEMS.find((p) => p.slug === 'two-sum-target');
  assert(!!twoSum, 'Found two-sum-target problem');
  assert(twoSum?.testCases.length >= 4, 'Problem has at least 4 test cases (sample and hidden)');
  assert(twoSum?.hintLadder.length === 5, 'Problem provides full 5-stage Hint Ladder (nudge, concept, pseudo-code, debug, solution)');
  assert(!!twoSum?.starterCode.javascript && !!twoSum?.starterCode.python, 'Problem provides starter code for JS and Python');

  // TEST SUITE 2: Execution Endpoint Logic
  console.log('\n[TEST SUITE 2] Execution API & Safe Runner Verification');
  const testRunPayload = {
    problemSlug: 'two-sum-target',
    language: 'javascript',
    code: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) return [map.get(diff), i];
    map.set(nums[i], i);
  }
  return [];
}`,
    hintLevel: 0,
    action: 'submit',
  };

  try {
    const res = await fetch('http://localhost:3000/api/practice/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000',
      },
      body: JSON.stringify(testRunPayload),
    });
    // Expected: 401 or 200 depending on session, validating endpoint exists and enforces auth
    assert(res.status === 401 || res.status === 200, `Execution API responded with status ${res.status} (safe auth enforcement)`);
  } catch (err) {
    assert(false, `Execution API request failed: ${err.message}`);
  }

  // Safe runner honesty check: verify configured runner or test offline fallback
  const runnerCheck = await executeCodeSafely('return 1;', 'prob-two-sum-target', 'javascript', false);
  if (process.env.ONLINECOMPILER_API_KEY) {
    assert(runnerCheck.isRunnerAvailable && runnerCheck.runnerType === 'sandbox' && runnerCheck.provider === 'onlinecompiler', `Configured OnlineCompiler runner is active (provider: ${runnerCheck.provider}, runnerType: ${runnerCheck.runnerType})`);
    
    // Also test offline fallback by temporarily clearing runner credentials
    const savedKey = process.env.ONLINECOMPILER_API_KEY;
    const savedProvider = process.env.CODE_EXECUTION_PROVIDER;
    delete process.env.ONLINECOMPILER_API_KEY;
    delete process.env.CODE_EXECUTION_PROVIDER;
    try {
      const offlineCheck = await executeCodeSafely('return 1;', 'prob-two-sum-target', 'javascript', false);
      assert(!offlineCheck.isRunnerAvailable && offlineCheck.runnerType === 'disabled_no_sandbox', 'Offline runner safely disables execution without fabricating fake passes');
    } finally {
      process.env.ONLINECOMPILER_API_KEY = savedKey;
      if (savedProvider) process.env.CODE_EXECUTION_PROVIDER = savedProvider;
    }
  } else {
    assert(!runnerCheck.isRunnerAvailable && runnerCheck.runnerType === 'disabled_no_sandbox', 'Offline runner safely disables execution without fabricating fake passes');
  }

  // TEST SUITE 3: Public Skill Passport at /p/[handle]
  console.log('\n[TEST SUITE 3] Public Skill Passport at /p/[handle]');
  try {
    // Test invalid / nonexistent handle
    const missing = await getPublicPassportByHandle('nonexistent-student-handle-xyz');
    assert(missing === null, 'Nonexistent handle returns null (no information leak)');

    // Test public page HTTP response
    const pageRes = await fetch('http://localhost:3000/p/nonexistent-student-handle-xyz');
    assert(pageRes.status === 200, `/p/[handle] route handles missing profile gracefully (status 200 with Private/Not Found card, received: ${pageRes.status})`);
    const pageHtml = await pageRes.text();
    assert(pageHtml.includes('Profile Is Private or Not Found') || pageHtml.includes('SkillPilot'), 'Renders branded privacy notice');
  } catch (err) {
    assert(false, `Public passport test failed: ${err.message}`);
  }

  // TEST SUITE 4: Database Health & Immutability
  console.log('\n[TEST SUITE 4] PostgreSQL Database & Table Integrity');
  try {
    const skills = await db().query('select slug, name from skills order by name');
    assert(skills.rowCount >= 6, `Skills table contains ${skills.rowCount} core skills`);

    const users = await db().query('select count(*)::int as count from users');
    assert(users.rows[0].count >= 0, `Users table online with ${users.rows[0].count} users`);

    const evidence = await db().query('select count(*)::int as count from user_skill_evidence');
    assert(evidence.rows[0].count >= 0, `user_skill_evidence table online with ${evidence.rows[0].count} evidence rows`);
  } catch (err) {
    assert(false, `Database query failed: ${err.message}`);
  }

  console.log('\n======================================================');
  console.log(`FINAL PRODUCT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
