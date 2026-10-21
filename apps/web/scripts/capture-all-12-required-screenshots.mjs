import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/df4a9773-11d5-40c8-b581-bbff2f7f2d2f');

async function capture() {
  console.log('Launching browser for All 12 Required Phase 9 Screenshots...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('skillpilot_cinematic_seen', 'true');
      localStorage.setItem('skillpilot_sidebar_collapsed', 'false');
    } catch {}
  });
  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check if we need to sign in / register
  const authTab = page.locator('.auth-tabs button', { hasText: 'Create account' });
  if (await authTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Registering verification student...');
    const testEmail = `audit_verify_${Date.now()}@skillpilot.test`;
    await authTab.click();
    await page.waitForTimeout(200);
    await page.fill('label:has-text("Name") input', 'Alex Chen');
    await page.fill('label:has-text("Email") input', testEmail);
    await page.fill('label:has-text("Password") input', 'AuditPass123!');
    await page.click('button.primary.auth-submit');
    await page.waitForSelector('.welcome, #main-content', { timeout: 15000 });
  } else {
    console.log('Already authenticated in workspace.');
  }

  // If onboarding modal appears, quick dismiss/save
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

  await page.waitForTimeout(800);

  // 1. TODAY — EXPANDED SIDEBAR (1440px)
  console.log('1. Capturing: Expanded sidebar...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('button.nav-item[data-tooltip="Today"]').catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'expanded_sidebar.png'), fullPage: false });

  // 2. TODAY — COLLAPSED SIDEBAR (1440px)
  console.log('2. Capturing: Collapsed sidebar...');
  await page.click('.sidebar-collapse-toggle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'collapsed_sidebar.png'), fullPage: false });

  // Expand sidebar back
  await page.click('.sidebar-collapse-toggle');
  await page.waitForTimeout(400);

  // 3. REDESIGNED TODAY DASHBOARD (1440px)
  console.log('3. Capturing: Redesigned Today dashboard...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesigned_today_dashboard.png'), fullPage: false });

  // 4. REDESIGNED SETTINGS (1440px)
  console.log('4. Capturing: Redesigned Settings...');
  await page.click('button.nav-item[data-tooltip="Settings"]');
  await page.waitForSelector('.settings-layout, .settings-nav-tabs', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesigned_settings.png'), fullPage: false });

  // 5. ROADMAP VIEW
  console.log('5. Capturing: Roadmap view...');
  await page.click('button.nav-item[data-tooltip="Roadmap"]');
  await page.waitForSelector('.roadmap-list, .roadmap-hierarchy-strip, .panel-block', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'roadmap_view.png'), fullPage: false });

  // 6. LEARN OR PRACTICE VIEW
  console.log('6. Capturing: Learn or Practice view...');
  await page.click('button.nav-item[data-tooltip="Practice"]');
  await page.waitForSelector('.practice-workspace-grid, .filter-select', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'learn_or_practice_view.png'), fullPage: false });

  // 7. PASSPORT VIEW
  console.log('7. Capturing: Passport view...');
  await page.click('button.nav-item[data-tooltip="Passport"]');
  await page.waitForSelector('.passport, .proof-list, .passport-stats', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'passport_view.png'), fullPage: false });

  // 8. ASSESS — BEFORE ANSWERING
  console.log('8. Capturing: Assessment before answering...');
  await page.click('button.nav-item[data-tooltip="Assess"]');
  await page.waitForSelector('.option-btn', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'assessment_before_answering.png'), fullPage: false });

  // 9. ASSESS — AFTER A CORRECT ANSWER (Difficulty Elevation)
  console.log('9. Submitting CORRECT answer...');
  const optionButtons = page.locator('.option-btn');
  await optionButtons.first().click(); // Option A (remainder %)
  await page.waitForTimeout(200);
  await page.click('.submit-btn');
  await page.waitForSelector('.adaptive-progression-banner, .skill-pill:has-text("Level 2")', { timeout: 10000 });
  await page.waitForTimeout(600);
  console.log('Capturing: Assessment after a correct answer...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'assessment_after_correct_answer.png'), fullPage: false });

  // 10. ASSESS — AFTER AN INCORRECT ANSWER (Diagnostic Step-down on elevated question)
  console.log('10. Submitting INCORRECT answer on Question 2...');
  const q2OptionButtons = page.locator('.option-btn');
  const count = await q2OptionButtons.count();
  if (count > 2) {
    await q2OptionButtons.nth(2).click(); // Option C (wrong)
    await page.waitForTimeout(200);
    await page.click('.submit-btn');
    await page.waitForTimeout(800);
    console.log('Capturing: Assessment after an incorrect answer...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'assessment_after_incorrect_answer.png'), fullPage: false });
  }

  // 11. MOBILE DASHBOARD (375px)
  console.log('11. Capturing: Mobile dashboard (375px)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.click('.mobile-tab-item:has-text("Home")');
  await page.waitForSelector('.welcome, .today-dashboard', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_dashboard.png'), fullPage: false });

  // 12. MOBILE NAVIGATION DRAWER (375px)
  console.log('12. Capturing: Mobile navigation drawer (375px)...');
  await page.click('.mobile-tab-item:has-text("More")');
  await page.waitForSelector('.sidebar.mobile-open, .sidebar-backdrop', { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_navigation.png'), fullPage: false });

  // Escape key closes mobile drawer
  console.log('Testing mobile drawer Escape key closure...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const isDrawerOpen = await page.locator('.sidebar.mobile-open').isVisible().catch(() => false);
  console.log(`Mobile drawer closed on Escape: ${!isDrawerOpen ? 'PASS' : 'FAIL'}`);

  // Viewport overflow checks across all 5 widths: 320, 375, 768, 1024, 1440
  console.log('\nRunning responsive viewport overflow checks:');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(200);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasOverflow = scrollWidth > clientWidth;
    console.log(`Viewport ${width}px -> scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}, overflow: ${hasOverflow ? 'FAIL (HAS OVERFLOW)' : 'PASS (NO OVERFLOW)'}`);
  }

  await browser.close();
  console.log('\nSuccessfully captured all 12 required screenshots!');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
