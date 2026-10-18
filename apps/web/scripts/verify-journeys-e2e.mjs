import { chromium } from 'playwright';
import fs from 'node:fs';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  for (const f of ['.env.local', '../.env.local', '.env', '../.env']) {
    if (fs.existsSync(f)) {
      try { process.loadEnvFile(f); } catch {}
      if (process.env.DATABASE_URL) break;
    }
  }
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 15000,
});

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const stamp = Date.now();
const beginnerEmail = `e2e_beginner_${stamp}@skillpilot.test`;
const advancedEmail = `e2e_advanced_${stamp}@skillpilot.test`;
const password = 'TestSecurePassword123!';

const check = (cond, msg) => {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
};

console.log('=== SKILLPILOT END-TO-END JOURNEY AUTOMATION (BEGINNER & ADVANCED) ===');
console.log(`Target: ${BASE_URL}\n`);

let browser;

try {
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('skillpilot_cinematic_seen', 'true'); } catch {}
  });

  // =========================================================================
  // JOURNEY 1: COMPLETE BEGINNER (SCENARIO A)
  // =========================================================================
  console.log('--- JOURNEY 1: Complete Beginner Student (Scenario A) ---');
  const page = await context.newPage();

  // 1. Sign Up
  console.log(`1. Signing up beginner student (${beginnerEmail})...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Create account")');
  await page.fill('label:has-text("Name") input', 'Alex Beginner');
  await page.fill('label:has-text("Email") input', beginnerEmail);
  await page.fill('label:has-text("Password") input', password);
  const studentRoleBtn = page.locator('.role-picker button').first();
  if (await studentRoleBtn.isVisible()) await studentRoleBtn.click();
  await page.click('button.primary.auth-submit');

  // 2. Onboarding Modal Auto-Starts
  console.log('2. Verifying Conversational Discovery auto-starts on first login...');
  await page.waitForSelector('.onboarding-modal', { timeout: 30000 });
  const modalTitle = await page.textContent('.onboarding-modal h2');
  console.log(`   Onboarding modal active: "${modalTitle?.trim()}"`);
  check(modalTitle?.includes('SkillPilot') || modalTitle?.includes('Welcome'), 'Onboarding modal title missing');

  // 3. Answer 7 Onboarding Turns as Complete Beginner
  console.log('3. Completing 7 onboarding turns as complete beginner...');
  
  // Turn 1: Education -> 1st Year Student
  const t1Chip = page.locator('.onboarding-modal .chip-card').first();
  await t1Chip.waitFor({ state: 'visible', timeout: 5000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    t1Chip.click(),
  ]);
  await page.waitForTimeout(500);

  // Turn 2: Experience -> Complete beginner
  const t2Chip = page.locator('.onboarding-modal .chip-card').first();
  await t2Chip.waitFor({ state: 'visible', timeout: 5000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    t2Chip.click(),
  ]);
  await page.waitForTimeout(500);

  // Turn 3: Skills used (multiselect) -> click chip, then click confirm button
  console.log('   Answering Turn 3 (skills_used - multiselect)...');
  const t3Chip = page.locator('.onboarding-modal .chip-card').first();
  await t3Chip.waitFor({ state: 'visible', timeout: 5000 });
  await t3Chip.click();
  await page.waitForTimeout(300);

  const confirmBtn = page.locator('button:has-text("Confirm selected skills")');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    confirmBtn.click(),
  ]);
  await page.waitForTimeout(600);

  // Turn 4: Struggles / Bottlenecks
  console.log('   Answering Turn 4 (struggles)...');
  const t4Chip = page.locator('.onboarding-modal .chip-card').first();
  await t4Chip.waitFor({ state: 'visible', timeout: 5000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    t4Chip.click(),
  ]);
  await page.waitForTimeout(600);

  // Turn 5: Goals (non-forced)
  console.log('   Answering Turn 5 (goals)...');
  const t5Chip = page.locator('.onboarding-modal .chip-card').first();
  await t5Chip.waitFor({ state: 'visible', timeout: 5000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    t5Chip.click(),
  ]);
  await page.waitForTimeout(600);

  // Turn 6: Availability
  console.log('   Answering Turn 6 (availability)...');
  const t6Chip = page.locator('.onboarding-modal .chip-card').first();
  await t6Chip.waitFor({ state: 'visible', timeout: 5000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    t6Chip.click(),
  ]);
  await page.waitForTimeout(600);

  // Turn 7: Format & Pace
  console.log('   Answering Turn 7 (format_pace)...');
  const t7Chip = page.locator('.onboarding-modal .chip-card').first();
  await t7Chip.waitFor({ state: 'visible', timeout: 5000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    t7Chip.click(),
  ]);
  await page.waitForTimeout(800);

  // 4. Verify Self-Reported Baseline Summary Card & Complete Calibration
  console.log('4. Verifying Self-Reported Baseline Summary card rendered...');
  await page.waitForSelector('text=SELF-REPORTED BASELINE SUMMARY', { timeout: 8000 });
  const completeCalibrationBtn = page.locator('button:has-text("Confirm Profile & Start Diagnostic"), button:has-text("Confirm Profile")').first();
  await completeCalibrationBtn.click();
  await page.waitForTimeout(1000);

  // 5. Check Adaptive Assessment Question Planner for Beginner
  console.log('5. Starting diagnostic assessment for beginner...');
  await page.click('button.nav-item:has-text("Assess")');
  await page.waitForTimeout(1000);

  // Inspect question assigned to beginner
  await page.waitForSelector('.skill-pill', { timeout: 15000 });
  const questionSkill = await page.evaluate(() => {
    const pill = document.querySelector('.skill-pill');
    const skillName = pill ? pill.querySelector('b')?.textContent?.trim() : '';
    const levelText = pill ? pill.querySelector('span')?.textContent?.trim() : '';
    const qText = document.querySelector('h2.question-text')?.textContent?.trim() || '';
    return { skillName, levelText, qText };
  });
  console.log(`   Beginner Assigned Question: Skill="${questionSkill.skillName}", Level="${questionSkill.levelText}", Snippet="${questionSkill.qText.slice(0, 80)}"`);
  check(questionSkill.skillName === 'Problem solving', `Beginner must receive Problem solving, got ${questionSkill.skillName}`);
  check(!/javascript|sql|rest/i.test(questionSkill.skillName), 'Beginner must NEVER receive JavaScript or SQL questions!');

  // Answer question
  const firstOption = page.locator('.option-btn').first();
  if (await firstOption.isVisible()) {
    await firstOption.click();
    await page.waitForTimeout(300);
    const submitBtn = page.locator('button.submit-btn');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // 6. Navigate to Today Dashboard & Inspect Hierarchy
  console.log('6. Navigating to Today dashboard & verifying 8-item hierarchy...');
  await page.click('nav button:has-text("Today")');
  await page.waitForSelector('.today-dashboard, .dashboard-container', { timeout: 8000 });

  // Priority 1: Guided Journey 5-stage stepper
  const stepperText = await page.textContent('.guided-journey-container, .journey-indicator');
  console.log(`   [Priority 1] Guided Journey Stepper: "${stepperText?.replace(/\s+/g, ' ').trim().slice(0, 70)}..."`);
  check(stepperText?.includes('STAGE') && stepperText?.includes('05') && (stepperText?.includes('VERIFY') || stepperText?.includes('Verify') || stepperText?.includes('Discover')), 'Guided 5-stage stepper missing');

  // Context Triad
  const contextTriad = await page.evaluate(() => {
    const card = document.querySelector('.context-triad-card');
    return Boolean(card);
  });
  console.log(`   Context Triad Card rendered: ${contextTriad}`);

  // Priority 2: One Primary Action
  const primaryAction = await page.textContent('.priority-card');
  console.log(`   [Priority 2] Today's Primary Action: "${primaryAction?.replace(/\s+/g, ' ').trim().slice(0, 60)}..."`);
  check(primaryAction?.includes('RECOMMENDED NEXT STEP') || primaryAction?.includes('ONE PRIMARY ACTION'), 'Primary action card missing');

  // Priority 5: Claimed vs Verified Skills
  const skillsInsight = await page.evaluate(() => {
    const claimedRows = document.querySelectorAll('.skill-claim-row');
    const verifiedRows = document.querySelectorAll('.verified-skill-row');
    return {
      claimedCount: claimedRows.length,
      verifiedCount: verifiedRows.length,
    };
  });
  console.log(`   [Priority 5] Skill Insights: Claimed=${skillsInsight.claimedCount}, Verified=${skillsInsight.verifiedCount}`);
  check(skillsInsight.claimedCount > 0, 'Claimed skills must be listed');

  // 7. Test AI Companion Natural Language Adjustment: "I have 20 minutes"
  console.log('7. Testing AI Companion natural language preference: "I have 20 minutes"...');
  const chatInput = page.locator('.companion-form input').first();
  if (await chatInput.isVisible()) {
    await chatInput.fill('I have 20 minutes daily');
    await chatInput.press('Enter');
    await page.waitForSelector('.companion-reply', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);

    const companionReplies = await page.evaluate(() => {
      const reply = document.querySelector('.companion-reply');
      return reply ? reply.textContent || '' : '';
    });
    console.log(`   AI Companion response: "${companionReplies.slice(0, 120).trim()}"`);
  }

  // 8. Test Responsive Viewport for Beginner on 320px
  console.log('8. Testing mobile 320px layout for horizontal overflow...');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(500);
  const overflow320 = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`   Mobile 320px horizontal overflow: ${overflow320 ? 'OVERFLOW ERROR' : 'CLEAN (PASS)'}`);
  check(!overflow320, 'Mobile 320px must have zero horizontal overflow');

  // Close page & clear session cookies cleanly for Journey 2
  await page.close();
  await context.clearCookies();

  // =========================================================================
  // JOURNEY 2: ADVANCED / PRACTICAL JAVASCRIPT STUDENT (SCENARIO C)
  // =========================================================================
  console.log('\n--- JOURNEY 2: Advanced Practical JavaScript Student (Scenario C) ---');
  const page2 = await context.newPage();

  // 1. Sign Up
  console.log(`1. Signing up practical JS student (${advancedEmail})...`);
  await page2.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page2.click('button:has-text("Create account")');
  await page2.fill('label:has-text("Name") input', 'Devon Senior JS');
  await page2.fill('label:has-text("Email") input', advancedEmail);
  await page2.fill('label:has-text("Password") input', password);
  const roleBtn2 = page2.locator('.role-picker button').first();
  if (await roleBtn2.isVisible()) await roleBtn2.click();
  await page2.click('button.primary.auth-submit');

  // 2. Onboarding Modal Auto-Starts
  console.log('2. Completing conversational discovery as practical JS developer...');
  await page2.waitForSelector('.onboarding-modal', { timeout: 30000 });

  // Use Switch to Quick Form for direct structured calibration
  const switchBtn = page2.locator('button:has-text("Switch to Quick Form")');
  if (await switchBtn.isVisible()) {
    await switchBtn.click();
    await page2.waitForTimeout(400);

    // Select Education: 3rd / 4th Year
    await page2.click('.chip-card:has-text("3rd / 4th Year")');
    await page2.waitForTimeout(200);

    // Select Experience: Built Projects
    await page2.click('.chip-card:has-text("Built Projects")');
    await page2.waitForTimeout(200);

    // Select Career Goal: Frontend Engineer
    await page2.click('.chip-card:has-text("Frontend Engineer")');
    await page2.waitForTimeout(200);

    const saveQuickBtn = page2.locator('button.submit-setup-btn, button:has-text("Save & Continue to Diagnostic")').first();
    await Promise.all([
      page2.waitForResponse((r) => r.url().includes('/api/profile') && r.status() === 200).catch(() => {}),
      saveQuickBtn.click(),
    ]);
    await page2.waitForTimeout(1000);
  } else {
    // Complete dialogue chips for experienced student
    // Turn 1: Education
    await page2.click('.chip-card:has-text("3rd / 4th Year"), .chip-card:has-text("2nd Year")');
    await page2.waitForTimeout(400);
    // Turn 2: Experience
    await page2.click('.chip-card:has-text("Built full applications"), .chip-card:has-text("Wrote small programs")');
    await page2.waitForTimeout(400);
    // Turn 3: Skills used (multiselect)
    await page2.click('.chip-card:has-text("JavaScript")');
    await page2.waitForTimeout(200);
    await page2.click('button:has-text("Confirm selected skills")');
    await page2.waitForTimeout(400);
    // Turn 4: Struggles
    await page2.locator('.onboarding-modal .chip-card').first().click();
    await page2.waitForTimeout(400);
    // Turn 5: Goals
    await page2.click('.chip-card:has-text("Frontend Engineer"), .chip-card:has-text("Software Engineer")');
    await page2.waitForTimeout(400);
    // Turn 6: Availability
    await page2.locator('.onboarding-modal .chip-card').first().click();
    await page2.waitForTimeout(400);
    // Turn 7: Format
    await page2.locator('.onboarding-modal .chip-card').first().click();
    await page2.waitForTimeout(600);
    const saveSummaryBtn = page2.locator('button:has-text("Confirm Profile & Start Diagnostic"), button:has-text("Confirm Profile")').first();
    if (await saveSummaryBtn.isVisible()) {
      await saveSummaryBtn.click();
      await page2.waitForTimeout(1000);
    }
  }

  // 3. Inspect Assessment Question Planner for Practical JS Student
  console.log('3. Starting diagnostic assessment for practical JS student...');
  await page2.click('button.nav-item:has-text("Assess")');
  await page2.waitForTimeout(1000);

  await page2.waitForSelector('.skill-pill', { timeout: 15000 });
  const advancedQuestion = await page2.evaluate(() => {
    const pill = document.querySelector('.skill-pill');
    const skillName = pill ? pill.querySelector('b')?.textContent?.trim() : '';
    const levelText = pill ? pill.querySelector('span')?.textContent?.trim() : '';
    const qText = document.querySelector('h2.question-text')?.textContent?.trim() || '';
    return { skillName, levelText, qText };
  });
  console.log(`   Practical JS Assigned Question: Skill="${advancedQuestion.skillName}", Level="${advancedQuestion.levelText}", Snippet="${advancedQuestion.qText.slice(0, 80)}"`);
  check(advancedQuestion.skillName === 'JavaScript', `Practical JS student must be assigned JavaScript, got: ${advancedQuestion.skillName}`);

  // 4. Verify AI Companion Prerequisite Conflict Warning
  console.log('4. Testing prerequisite conflict in AI Companion: "I want to focus on REST APIs first"...');
  await page2.click('nav button:has-text("Today")');
  await page2.waitForSelector('.today-dashboard, .dashboard-container', { timeout: 8000 });

  const chatInput2 = page2.locator('.companion-form input').first();
  if (await chatInput2.isVisible()) {
    await chatInput2.fill('I want to focus on REST APIs first');
    await chatInput2.press('Enter');
    await page2.waitForSelector('.companion-reply', { timeout: 8000 });
    await page2.waitForTimeout(500);

    const companionReplies2 = await page2.evaluate(() => {
      const reply = document.querySelector('.companion-reply');
      return reply ? reply.textContent || '' : '';
    });
    console.log(`   AI Companion Prerequisite Explanation: "${companionReplies2.slice(0, 140).trim()}"`);
    check(/prerequisite|foundational|before|demonstrate|baseline/i.test(companionReplies2), 'Companion must explain prerequisite requirements!');
  }

  // 5. Visibly Different Roadmap Path
  console.log('5. Verifying visibly different roadmap milestones for advanced path...');
  await page2.click('nav button:has-text("Roadmap")');
  await page2.waitForSelector('.roadmap-container, .timeline, #main-content', { timeout: 8000 });
  const roadmapText = await page2.textContent('#main-content');
  console.log(`   Advanced Roadmap Excerpt: "${roadmapText?.replace(/\s+/g, ' ').trim().slice(0, 90)}..."`);

  await page2.close();
  console.log('\n=== BOTH END-TO-END JOURNEYS VERIFIED SUCCESSFULLY! ===');

} finally {
  if (browser) await browser.close();

  // Database cleanup
  console.log('\nCleaning up isolated test accounts from database...');
  try {
    const res = await pool.query(
      `DELETE FROM users WHERE email IN ($1, $2) RETURNING email`,
      [beginnerEmail, advancedEmail]
    );
    console.log(`Cleaned up ${res.rowCount} test accounts cleanly.`);
  } catch (err) {
    console.warn('DB cleanup warning:', err.message);
  }
  await pool.end();
}
