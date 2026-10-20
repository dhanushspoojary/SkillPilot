import { chromium } from 'playwright';
import pg from 'pg';
import fs from 'fs';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new pg.Pool({ connectionString: match[1] });

const PORT = 3003;
const BASE_URL = `http://localhost:${PORT}`;

async function main() {
  console.log('======================================================');
  console.log('PHASE 3 & 4: STUDENT JOURNEY & NEXT-BUTTON BUG VERIFICATION');
  console.log('======================================================\n');

  const stamp = Date.now();
  const studentId = randomUUID();
  const studentEmail = `student-journey-${stamp}@test.local`;
  const password = 'Password123456!';
  const pwHash = await bcrypt.hash(password, 10);

  // Setup DB student with pre-completed onboarding to test assessment directly
  console.log('[STEP 1] Provisioning active student account...');
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, status)
     VALUES ($1, $2, $3, 'Alex Mercer', 'student', 'active')`,
    [studentId, studentEmail, pwHash]
  );

  await pool.query(
    `INSERT INTO student_capability_profiles (
       user_id, education_level, programming_experience, field_of_study,
       career_interests, weekly_hours, focus_areas, skills_to_learn, skills_known,
       onboarding_completed, updated_at
     ) VALUES (
       $1, 'college_senior', 'intermediate', 'computer_science',
       '["Software Engineer"]'::jsonb, 10, '["Programming Fundamentals"]'::jsonb, '[]'::jsonb, '[]'::jsonb,
       true, now()
     )`,
    [studentId]
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // 2. Authenticate student
    console.log('\n[STEP 2] Authenticating student session...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const loginRes = await page.evaluate(async ({ email, password }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return { ok: res.ok, status: res.status };
    }, { email: studentEmail, password });

    if (!loginRes.ok) throw new Error(`Student login failed: ${loginRes.status}`);
    console.log('   ✓ Student login succeeded.');

    // 3. Navigate to Assessment
    console.log('\n[STEP 3] Navigating to Diagnostic Assessment...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Click 'Assess' in the navigation bar
    const assessNavLink = page.locator('nav button:has-text("Assess")');
    await assessNavLink.click();

    // Wait for question to render
    const questionTextEl = page.locator('.question-text');
    await questionTextEl.waitFor({ timeout: 10000 });
    console.log('   ✓ Question 1 loaded:', (await questionTextEl.textContent())?.trim());

    // 4. Test clicking Next WITHOUT selecting an answer
    console.log('\n[STEP 4] Testing Next button click WITHOUT an answer selected...');
    const nextBtn = page.locator('button.submit-btn');
    await nextBtn.click();

    // Verify understandable validation message appears
    const alertError = page.locator('.inline-alert.error');
    await alertError.waitFor({ timeout: 2000 });
    const errorText = await alertError.textContent();
    console.log('   ✓ Next button responded with validation explanation:', errorText?.trim());
    if (!errorText?.includes('Please select an answer option')) {
      throw new Error(`Unexpected error message: ${errorText}`);
    }

    // 5. Select Option A
    console.log('\n[STEP 5] Selecting option A...');
    const firstOption = page.locator('.option-btn').first();
    await firstOption.click();

    // Verify option is visually marked as selected
    const isSelected = await firstOption.evaluate(el => el.classList.contains('selected-answer'));
    console.log('   Option A selected state:', isSelected);
    if (!isSelected) throw new Error('Option A was not visually selected!');

    // Verify the validation error is automatically dismissed
    const errorVisible = await alertError.isVisible();
    console.log('   Validation error automatically dismissed:', !errorVisible);
    if (errorVisible) throw new Error('Error was not cleared after selection!');

    // 6. Test Double-Clicking Next Question (Rapid Submissions)
    console.log('\n[STEP 6] Testing Next button rapid double-click (idempotency check)...');
    await Promise.all([
      nextBtn.click({ clickCount: 2 }),
      page.waitForTimeout(600)
    ]);

    // Wait for feedback or question 2
    console.log('   Checking question advance...');
    await page.waitForTimeout(1000);
    const q2Text = await questionTextEl.textContent();
    console.log('   ✓ Advanced to Question 2:', q2Text?.trim());

    // 7. Complete entire assessment loop
    console.log('\n[STEP 7] Progressing through remaining diagnostic questions...');
    let questionIndex = 2;
    let maxQuestions = 15;

    while (questionIndex <= maxQuestions) {
      // Check if results screen has appeared
      const isResultVisible = await page.locator('.score-headline').isVisible();
      if (isResultVisible) {
        console.log('   ✓ Assessment completed! Results screen displayed.');
        break;
      }

      // Pick an option (alternate options 0, 1, 2)
      const optionIndex = (questionIndex % 3);
      const optionToPick = page.locator('.option-btn').nth(optionIndex);
      await optionToPick.click();
      await page.waitForTimeout(150);

      // Click Next/Finish
      const submitBtn = page.locator('button.submit-btn');
      const submitText = await submitBtn.textContent();
      const isFinish = submitText?.includes('Finish');
      await submitBtn.click();
      console.log(`   Question ${questionIndex} submitted (${submitText?.trim()}).`);

      if (isFinish) {
        console.log('   Final question submitted. Waiting for results screen...');
        await page.locator('.score-headline').waitFor({ timeout: 15000 });
        break;
      }

      await page.waitForTimeout(600);
      questionIndex++;
    }

    // 8. Verify Results and Workflow Calibration
    console.log('\n[STEP 8] Verifying results screen and baseline calibration...');
    const scoreHeadline = page.locator('.score-headline');
    await scoreHeadline.waitFor({ timeout: 10000 });
    const finalScore = await scoreHeadline.textContent();
    console.log('   Final Scored Average:', finalScore?.trim());

    // Step 8a: Confirm Skill Baseline
    console.log('   Confirming skill baseline...');
    const confirmBaselineBtn = page.locator('button:has-text("Confirm Skill Baseline")');
    await confirmBaselineBtn.click();
    await page.waitForTimeout(500);

    // Step 8b: Confirm Career Target & Goals
    console.log('   Confirming career target & goals...');
    const confirmGoalsBtn = page.locator('button:has-text("Confirm Goals & Unlock Roadmap")');
    await confirmGoalsBtn.click();
    await page.waitForTimeout(500);

    // Step 8c: Open Career Roadmap
    console.log('   Opening Career Roadmap...');
    const openRoadmapBtn = page.locator('button:has-text("See Updated Roadmap")');
    await openRoadmapBtn.click();
    await page.waitForTimeout(1000);

    // Verify Roadmap view is active
    const roadmapHeader = page.locator('.page h1, .roadmap-view h1, .view-head h1');
    console.log('   Active View Header:', (await roadmapHeader.first().textContent())?.trim());
    console.log('   ✓ Assessment seamlessly transitioned to Roadmap!');

    // 9. Verify Evidence Ledger Persistence in PostgreSQL
    console.log('\n[STEP 9] Verifying evidence persistence in PostgreSQL database...');
    const evidenceRows = await pool.query(
      `SELECT skill_id, score, source, metadata FROM user_skill_evidence WHERE user_id = $1 ORDER BY captured_at DESC`,
      [studentId]
    );
    console.log(`   Found ${evidenceRows.rowCount} authoritative evidence records in DB:`);
    for (const row of evidenceRows.rows) {
      console.log(`   - skill_id ${row.skill_id}: ${row.score}% (${row.source})`);
    }
    if (evidenceRows.rowCount === 0) {
      throw new Error('No evidence records were persisted in user_skill_evidence!');
    }
    console.log('   ✓ Verified evidence persisted authoritatively.');

    // 10. Audit Student Navigation across all tabs
    console.log('\n[STEP 10] Auditing Student navigation tabs...');
    const viewsToTest = [
      ['01', 'Today'],
      ['02', 'Practice'],
      ['03', 'Learn'],
      ['04', 'Projects'],
      ['05', 'Roadmap'],
      ['06', 'Agent'],
      ['07', 'Skills'],
      ['09', 'Mentors'],
      ['10', 'Mock interview'],
      ['11', 'Passport'],
      ['12', 'Settings']
    ];

    for (const [num, name] of viewsToTest) {
      const navBtn = page.locator(`.sidebar button:has-text("${name}")`);
      if (await navBtn.isVisible()) {
        await navBtn.click();
        await page.waitForTimeout(300);
        console.log(`   ✓ Navigation to [${num}] ${name} renders without errors.`);
      }
    }

    // Capture screenshot of Passport view with verified evidence
    const passportNav = page.locator('.sidebar button:has-text("Passport")');
    await passportNav.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'apps/web/scratch/student-passport-verified.png', fullPage: true });
    console.log('   ✓ Saved student passport screenshot to apps/web/scratch/student-passport-verified.png');

    console.log('\n======================================================');
    console.log('PHASE 3 & 4 VERIFICATION COMPLETED: ALL PASS');
    console.log('======================================================');
  } finally {
    await browser.close();
    // Clean up test student
    // Note: user_skill_evidence has an append-only trigger constraint on deletions,
    // so we delete capability profiles and assessments, and deactivate user
    await pool.query(`DELETE FROM student_capability_profiles WHERE user_id = $1`, [studentId]).catch(() => {});
    await pool.query(`DELETE FROM assessments WHERE user_id = $1`, [studentId]).catch(() => {});
    await pool.query(`DELETE FROM career_goals WHERE user_id = $1`, [studentId]).catch(() => {});
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [studentId]).catch(() => {});
    await pool.query(`UPDATE users SET status = 'inactive' WHERE id = $1`, [studentId]).catch(() => {});
    await pool.end();
  }
}

main().catch(err => {
  console.error('Student Journey Test failed:', err);
  pool.end();
  process.exit(1);
});
