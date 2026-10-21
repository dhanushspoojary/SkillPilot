import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/df4a9773-11d5-40c8-b581-bbff2f7f2d2f');

async function captureRemaining() {
  console.log('Capturing remaining required screenshots (Roadmap, Practice, Passport, Incorrect Assessment, Mobile)...');
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

  // If auth is needed:
  const authTab = page.locator('.auth-tabs button', { hasText: 'Create account' });
  if (await authTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    const testEmail = `audit_verify_${Date.now()}@skillpilot.test`;
    await authTab.click();
    await page.waitForTimeout(200);
    await page.fill('label:has-text("Name") input', 'Alex Chen');
    await page.fill('label:has-text("Email") input', testEmail);
    await page.fill('label:has-text("Password") input', 'AuditPass123!');
    await page.click('button.primary.auth-submit');
    await page.waitForSelector('.welcome, #main-content', { timeout: 15000 });
  }

  // Dismiss onboarding if present
  try {
    const switchBtn = page.locator('button:has-text("Switch to Quick Form")');
    if (await switchBtn.isVisible({ timeout: 1500 })) {
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

  // 1. ROADMAP VIEW
  console.log('1. Capturing: Roadmap view...');
  await page.click('button.nav-item[data-tooltip="Roadmap"]');
  await page.waitForSelector('.roadmap-list, .roadmap-hierarchy-strip, .panel-block', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'roadmap_view.png'), fullPage: false });

  // 2. LEARN OR PRACTICE VIEW
  console.log('2. Capturing: Learn or Practice view...');
  await page.click('button.nav-item[data-tooltip="Practice"]');
  await page.waitForSelector('.practice-layout, .terminal-pane, .problem-workspace', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'learn_or_practice_view.png'), fullPage: false });

  // 3. PASSPORT VIEW
  console.log('3. Capturing: Passport view...');
  await page.click('button.nav-item[data-tooltip="Passport"]');
  await page.waitForSelector('.passport, .proof-list, .passport-grid', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'passport_view.png'), fullPage: false });

  // 4. ASSESS AFTER INCORRECT ANSWER (Diagnostic Step-down)
  console.log('4. Navigating to Assess for Diagnostic step-down capture...');
  await page.click('button.nav-item[data-tooltip="Assess"]');
  await page.waitForSelector('.option-btn', { timeout: 20000 });
  await page.waitForTimeout(600);

  // Pick an incorrect option
  console.log('Submitting incorrect answer...');
  const options = page.locator('.option-btn');
  const count = await options.count();
  if (count > 1) {
    await options.nth(1).click();
    await page.waitForTimeout(200);
    await page.click('.submit-btn');
    await page.waitForTimeout(800);
    console.log('Capturing: Assessment after incorrect answer...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'assessment_after_incorrect_answer.png'), fullPage: false });
  }

  // 5. MOBILE DASHBOARD (375px)
  console.log('5. Capturing: Mobile dashboard (375px)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.click('.mobile-tab-item:has-text("Home")');
  await page.waitForSelector('.welcome, .today-dashboard', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_dashboard.png'), fullPage: false });

  // 6. MOBILE NAVIGATION DRAWER (375px)
  console.log('6. Capturing: Mobile navigation drawer (375px)...');
  await page.click('.mobile-tab-item:has-text("More")');
  await page.waitForSelector('.sidebar.mobile-open, .sidebar-backdrop', { timeout: 5000 });
  await page.waitForTimeout(600);
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
  console.log('\nSuccessfully captured all remaining required screenshots!');
}

captureRemaining().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
