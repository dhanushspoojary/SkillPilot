import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/df4a9773-11d5-40c8-b581-bbff2f7f2d2f');

async function run() {
  console.log('Launching browser for Phase 6 Audit Verification & Screenshots...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  
  // Create student session
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('skillpilot_cinematic_seen', 'true'); } catch {}
  });
  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Register fresh student
  const testEmail = `audit_student_${Date.now()}@skillpilot.test`;
  const tab = page.locator('.auth-tabs button', { hasText: 'Create account' });
  await tab.click();
  await page.waitForTimeout(200);
  await page.fill('label:has-text("Name") input', 'Alex Chen');
  await page.fill('label:has-text("Email") input', testEmail);
  await page.fill('label:has-text("Password") input', 'AuditPass123!');
  await page.click('button.primary.auth-submit');

  await page.waitForSelector('.welcome, #main-content', { timeout: 15000 });
  await page.waitForTimeout(600);

  // If onboarding modal appears, complete with quick form
  try {
    const switchBtn = page.locator('button:has-text("Switch to Quick Form")');
    if (await switchBtn.isVisible({ timeout: 2000 })) {
      await switchBtn.click();
      await page.waitForTimeout(300);
      const saveBtn = page.locator('button.submit-setup-btn, button:has-text("Save & Continue to Diagnostic")').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForSelector('.onboarding-modal', { state: 'detached', timeout: 5000 });
      }
    }
  } catch {}

  await page.waitForTimeout(600);

  // 1. TODAY — EXPANDED SIDEBAR (1440px)
  console.log('Capturing: Today with Expanded Sidebar...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'today_expanded_sidebar.png'), fullPage: false });

  // 2. TODAY — COLLAPSED SIDEBAR (1440px)
  console.log('Toggling sidebar collapse...');
  const collapseToggle = page.locator('.sidebar-collapse-toggle').first();
  await collapseToggle.click();
  await page.waitForTimeout(400);
  console.log('Capturing: Today with Collapsed Sidebar...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'today_collapsed_sidebar.png'), fullPage: false });

  // Expand sidebar back for clean navigation
  await collapseToggle.click();
  await page.waitForTimeout(300);

  // 3. LEARN VIEW
  console.log('Capturing: Learn view...');
  await page.click('button.nav-item:has-text("Learn")');
  await page.waitForSelector('.walkthrough-container, .walkthrough-step-card, .learn-header', { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'learn_view.png'), fullPage: false });

  // 4. ROADMAP VIEW
  console.log('Capturing: Roadmap view...');
  await page.click('button.nav-item:has-text("Roadmap")');
  await page.waitForSelector('.roadmap-list, .roadmap-hierarchy-strip, .panel-block', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'roadmap_view.png'), fullPage: false });

  // 5. PASSPORT VIEW
  console.log('Capturing: Passport view...');
  await page.click('button.nav-item:has-text("Passport")');
  await page.waitForSelector('.passport, .proof-list, .passport-grid', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'passport_view.png'), fullPage: false });

  // 6. ASSESS — INITIAL QUESTION
  console.log('Navigating to Assess...');
  await page.click('button.nav-item:has-text("Assess")');
  await page.waitForSelector('.option-btn', { timeout: 25000 });
  await page.waitForTimeout(600);
  console.log('Capturing: Assess Initial Question...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'assess_initial_question.png'), fullPage: false });

  // 7. ASSESS — AFTER CORRECT ANSWER (Difficulty Elevation)
  console.log('Submitting CORRECT answer (Option A, index 0 for %)...');
  const optionButtons = page.locator('.option-btn');
  // Click option A (index 0, remainder operator %)
  await optionButtons.nth(0).click();
  await page.waitForTimeout(200);
  // Click submit
  await page.click('.submit-btn');
  // Wait for next question and adaptive banner
  await page.waitForSelector('.adaptive-progression-banner, .skill-pill:has-text("Level 2")', { timeout: 10000 });
  await page.waitForTimeout(600);
  console.log('Capturing: Assess Next Question After CORRECT Answer (Elevation)...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'assess_next_after_correct.png'), fullPage: false });

  // 8. ASSESS — AFTER INCORRECT ANSWER (Diagnostic Step-down in new learner session)
  console.log('Starting separate learner session for Diagnostic step-down capture...');
  const learner2Ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await learner2Ctx.addInitScript(() => {
    try { sessionStorage.setItem('skillpilot_cinematic_seen', 'true'); } catch {}
  });
  const learner2Page = await learner2Ctx.newPage();
  await learner2Page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const learner2Email = `diagnostic_student_${Date.now()}@skillpilot.test`;
  await learner2Page.locator('.auth-tabs button', { hasText: 'Create account' }).click();
  await learner2Page.waitForTimeout(200);
  await learner2Page.fill('label:has-text("Name") input', 'Jordan Lee');
  await learner2Page.fill('label:has-text("Email") input', learner2Email);
  await learner2Page.fill('label:has-text("Password") input', 'AuditPass123!');
  await learner2Page.click('button.primary.auth-submit');
  await learner2Page.waitForSelector('.welcome, #main-content', { timeout: 15000 });
  await learner2Page.waitForTimeout(600);

  try {
    const switchBtn = learner2Page.locator('button:has-text("Switch to Quick Form")');
    if (await switchBtn.isVisible({ timeout: 2000 })) {
      await switchBtn.click();
      await learner2Page.waitForTimeout(300);
      const saveBtn = learner2Page.locator('button.submit-setup-btn, button:has-text("Save & Continue to Diagnostic")').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await learner2Page.waitForSelector('.onboarding-modal', { state: 'detached', timeout: 5000 });
      }
    }
  } catch {}

  await learner2Page.click('button.nav-item:has-text("Assess")');
  await learner2Page.waitForSelector('.option-btn', { timeout: 25000 });
  await learner2Page.waitForTimeout(600);

  console.log('Submitting INCORRECT answer (Option B, index 1 for /)...');
  await learner2Page.locator('.option-btn').nth(1).click();
  await learner2Page.waitForTimeout(200);
  await learner2Page.click('.submit-btn');
  await learner2Page.waitForSelector('.adaptive-progression-banner, .skill-pill:has-text("Level 0")', { timeout: 10000 });
  await learner2Page.waitForTimeout(600);
  console.log('Capturing: Assess Next Question After INCORRECT Answer (Diagnostic Step-down)...');
  await learner2Page.screenshot({ path: path.join(ARTIFACT_DIR, 'assess_next_after_incorrect.png'), fullPage: false });

  // 9. MOBILE NAVIGATION (375px)
  console.log('Capturing: Mobile Navigation at 375px...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.click('button.nav-item:has-text("Today"), button.mobile-nav-btn:has-text("Today")').catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_navigation_375px.png'), fullPage: false });

  // 10. MULTI-VIEWPORT CHECKS: 320, 375, 768, 1024, 1440
  console.log('Performing responsive viewport audits (320, 375, 768, 1024, 1440)...');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(300);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`Viewport ${width}px -> scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}, overflow: ${scrollWidth > clientWidth}`);
  }

  await browser.close();
  console.log('All screenshots and viewport verifications completed successfully!');
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
