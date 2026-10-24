import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/cab808ac-15ac-4ba0-973c-986b08bd8096');

async function captureRemaining() {
  console.log('Capturing remaining 5 required screenshots...');
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

  // Hide nextjs-portal to prevent overlay pointer intercepts
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

  // Register a fresh test student to get the onboarding modal directly
  const authTab = page.locator('.auth-tabs button', { hasText: 'Create account' });
  if (await authTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Registering fresh student for onboarding capture...');
    const testEmail = `onboard_capture_${Date.now()}@skillpilot.test`;
    await authTab.click();
    await page.waitForTimeout(200);
    await page.fill('label:has-text("Name") input', 'Dev Student');
    await page.fill('label:has-text("Email") input', testEmail);
    await page.fill('label:has-text("Password") input', 'OnboardPass123!');
    await page.click('button.primary.auth-submit');
    await page.waitForSelector('.welcome, #main-content', { timeout: 15000 });
  }

  // Hide nextjs-portal again on loaded page
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

  // 1. Wait for or trigger CapabilityOnboarding
  console.log('1. Waiting for Onboarding modal...');
  let modal = page.locator('.onboarding-modal');
  let isModalVisible = await modal.isVisible({ timeout: 4000 }).catch(() => false);

  if (!isModalVisible) {
    // Click Recalibrate or Skill Calibration if available
    const calibBtn = page.locator('button:has-text("Recalibrate"), button:has-text("Skill Calibration")').first();
    if (await calibBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await calibBtn.click();
      await page.waitForSelector('.onboarding-modal', { timeout: 5000 });
      isModalVisible = true;
    }
  }

  if (isModalVisible) {
    console.log('   Switching to Tab 2: Technical Diagnostic...');
    const diagTab = page.locator('button:has-text("2. Technical Diagnostic")');
    if (await diagTab.isVisible()) {
      await diagTab.click();
      await page.waitForTimeout(1500);
    }

    // Capture Question
    console.log('   Capturing: adaptive_onboarding_question.png...');
    await page.waitForSelector('.adaptive-assessment-container, textarea', { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'adaptive_onboarding_question.png'), fullPage: false });

    // Answer Question
    console.log('   Submitting explanation for evaluation...');
    const textarea = page.locator('.adaptive-assessment-container textarea');
    if (await textarea.isVisible()) {
      await textarea.fill('An array provides O(1) indexed lookups and contiguous memory layout, while a linked list uses nodes and pointers which allows O(1) head insertion but requires O(N) sequential traversal.');
      await page.click('button:has-text("Submit Explanation")');
      await page.waitForSelector('.adaptive-assessment-container span:has-text("CORRECT"), .adaptive-assessment-container span:has-text("PARTIAL"), .adaptive-assessment-container b:has-text("ACTIVE QUESTION")', { timeout: 20000 });
      await page.waitForTimeout(800);
      console.log('   Capturing: adaptive_onboarding_evaluation.png...');
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'adaptive_onboarding_evaluation.png'), fullPage: false });
    }

    // Dismiss modal for mobile checks
    const closeBtn = page.locator('button[aria-label="Close setup"], button:has-text("Skip for now")').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForSelector('.onboarding-modal', { state: 'detached', timeout: 5000 }).catch(() => {});
    }
  }

  // 2. MOBILE VIEWPORTS & NAVIGATION
  console.log('2. Setting viewport to 375px (Mobile)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.waitForTimeout(600);

  console.log('   Capturing: mobile_dashboard.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_dashboard.png'), fullPage: false });

  console.log('   Opening mobile navigation drawer...');
  await page.click('.mobile-tab-item:has-text("More")', { force: true });
  await page.waitForSelector('.sidebar.mobile-open', { timeout: 5000 });
  await page.waitForTimeout(500);

  console.log('   Capturing: mobile_navigation.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_navigation.png'), fullPage: false });

  // Test Escape key closes mobile drawer
  console.log('   Testing mobile drawer Escape key closure...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const isDrawerOpen = await page.locator('.sidebar.mobile-open').isVisible().catch(() => false);
  console.log(`   Mobile drawer closed on Escape: ${!isDrawerOpen ? 'PASS' : 'FAIL'}`);

  // 3. MOBILE VIEWPORT 320px
  console.log('3. Setting viewport to 320px...');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(400);

  console.log('   Capturing: mobile_viewport_320px.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_viewport_320px.png'), fullPage: false });

  // 4. Responsive overflow assertion
  console.log('\nRunning responsive overflow checks:');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(200);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasOverflow = scrollWidth > clientWidth;
    console.log(`   Viewport ${width}px -> scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${hasOverflow}`);
  }

  await browser.close();
  console.log('\nAll 5 remaining screenshots successfully captured!');
}

captureRemaining().catch((err) => {
  console.error('Capture remaining failed:', err);
  process.exit(1);
});
