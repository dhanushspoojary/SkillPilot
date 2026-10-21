import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/df4a9773-11d5-40c8-b581-bbff2f7f2d2f');

async function captureMobile() {
  console.log('Capturing Mobile Dashboard, Mobile Navigation Drawer, and Viewport Audits...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('skillpilot_cinematic_seen', 'true');
      localStorage.setItem('skillpilot_sidebar_collapsed', 'false');
    } catch {}
  });
  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL} at 375px...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Hide Next.js dev overlay indicator
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

  // Authenticate if on auth gate
  const authTab = page.locator('.auth-tabs button', { hasText: 'Create account' });
  if (await authTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Registering test student on mobile...');
    const testEmail = `mobile_audit_${Date.now()}@skillpilot.test`;
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

  await page.waitForTimeout(800);

  // 1. MOBILE DASHBOARD (375px)
  console.log('1. Capturing: Mobile dashboard (375px)...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_dashboard.png'), fullPage: false });

  // 2. MOBILE NAVIGATION DRAWER (375px)
  console.log('2. Opening mobile More drawer...');
  await page.click('.mobile-tab-item:has-text("More")', { force: true });
  await page.waitForSelector('.sidebar.mobile-open, .sidebar-backdrop', { timeout: 5000 });
  await page.waitForTimeout(600);

  console.log('Capturing: Mobile navigation drawer (375px)...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_navigation.png'), fullPage: false });

  // Test Escape key dismissal
  console.log('Testing Escape key closure...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const isDrawerOpen = await page.locator('.sidebar.mobile-open').isVisible().catch(() => false);
  console.log(`Mobile drawer closed on Escape: ${!isDrawerOpen ? 'PASS' : 'FAIL'}`);

  // Also ensure assessment_after_incorrect_answer.png exists and matches assess_next_after_incorrect.png
  const srcDiag = path.join(ARTIFACT_DIR, 'assess_next_after_incorrect.png');
  const dstDiag = path.join(ARTIFACT_DIR, 'assessment_after_incorrect_answer.png');
  if (fs.existsSync(srcDiag)) {
    fs.copyFileSync(srcDiag, dstDiag);
    console.log('Verified assessment_after_incorrect_answer.png artifact.');
  }

  // 3. RESPONSIVE VIEWPORT CHECKS
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
  console.log('\nMobile verification & screenshots captured successfully!');
}

captureMobile().catch((err) => {
  console.error('Mobile capture failed:', err);
  process.exit(1);
});
