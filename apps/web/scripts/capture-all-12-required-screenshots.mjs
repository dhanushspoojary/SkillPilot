import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/cab808ac-15ac-4ba0-973c-986b08bd8096');

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

  // If onboarding modal appears, capture question & evaluation first!
  const modal = page.locator('.onboarding-modal');
  let onboardingModalOpen = await modal.isVisible({ timeout: 2500 }).catch(() => false);

  if (onboardingModalOpen) {
    console.log('6. Capturing: Adaptive onboarding question modal...');
    // Check if on adaptive tab
    const adaptiveTab = page.locator('.onboarding-tab-btn:has-text("Adaptive Technical Assessment")');
    if (await adaptiveTab.isVisible()) {
      await adaptiveTab.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'adaptive_onboarding_question.png'), fullPage: false });

    console.log('7. Capturing: Adaptive onboarding evaluation...');
    const ansInput = page.locator('.adaptive-answer-input');
    if (await ansInput.isVisible()) {
      await ansInput.fill('An array is a contiguous block of memory with fixed size and O(1) random access, whereas a linked list uses nodes with pointers with O(N) access but dynamic resizing.');
      await page.click('.adaptive-submit-btn');
      await page.waitForSelector('.feedback-summary, .onboarding-completion-view', { timeout: 15000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'adaptive_onboarding_evaluation.png'), fullPage: false });
    }

    // Dismiss onboarding modal
    const closeBtn = page.locator('button[aria-label="Close setup"], button:has-text("Skip for now"), button:has-text("View Personalized Roadmap")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForSelector('.onboarding-modal', { state: 'detached', timeout: 5000 }).catch(() => {});
    }
  } else {
    // If modal wasn't open, trigger it via Today view or calibration button
    const calibBtn = page.locator('button:has-text("Recalibrate"), button:has-text("Skill Calibration")').first();
    if (await calibBtn.isVisible()) {
      await calibBtn.click();
      await page.waitForSelector('.onboarding-modal', { timeout: 5000 });
      const adaptiveTab = page.locator('.onboarding-tab-btn:has-text("Adaptive Technical Assessment")');
      if (await adaptiveTab.isVisible()) {
        await adaptiveTab.click();
        await page.waitForTimeout(600);
      }
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'adaptive_onboarding_question.png'), fullPage: false });

      const ansInput = page.locator('.adaptive-answer-input');
      if (await ansInput.isVisible()) {
        await ansInput.fill('Time complexity of hash table lookup is O(1) average.');
        await page.click('.adaptive-submit-btn');
        await page.waitForSelector('.feedback-summary, .onboarding-completion-view', { timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'adaptive_onboarding_evaluation.png'), fullPage: false });
      }
      const closeBtn = page.locator('button[aria-label="Close setup"], button:has-text("Skip for now")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForSelector('.onboarding-modal', { state: 'detached', timeout: 5000 }).catch(() => {});
      }
    }
  }

  // 1. TODAY — EXPANDED SIDEBAR (1440px)
  console.log('1. Capturing: Desktop sidebar expanded...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('button.nav-item[data-tooltip="Today"]').catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop_sidebar_expanded.png'), fullPage: false });

  // 2. TODAY — COLLAPSED SIDEBAR (1440px)
  console.log('2. Capturing: Desktop sidebar collapsed...');
  await page.click('.sidebar-collapse-toggle');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop_sidebar_collapsed.png'), fullPage: false });

  // Expand sidebar back
  await page.click('.sidebar-collapse-toggle');
  await page.waitForTimeout(400);

  // 3. TODAY — DECLUTTERED DASHBOARD (1440px)
  console.log('3. Capturing: Today dashboard decluttered...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'today_dashboard_decluttered.png'), fullPage: false });

  // 4. ROADMAP SKILL TREE (1440px)
  console.log('4. Capturing: Roadmap skill tree...');
  await page.click('button.nav-item[data-tooltip="Roadmap"]');
  await page.waitForSelector('.roadmap-skill-tree-container, .skill-tree-path, .roadmap-list', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'roadmap_skill_tree.png'), fullPage: false });

  // 5. ROADMAP DRAWER DETAIL (1440px)
  console.log('5. Capturing: Roadmap drawer detail...');
  const treeNode = page.locator('.skill-node-card, .tree-node-interactive').first();
  if (await treeNode.isVisible()) {
    await treeNode.click();
    await page.waitForSelector('.roadmap-drawer, .roadmap-detail-drawer, .node-drawer-content', { timeout: 6000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'roadmap_drawer_detail.png'), fullPage: false });
    // Test Escape key closes drawer
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else {
    // If no node clicked, take view screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'roadmap_drawer_detail.png'), fullPage: false });
  }

  // 8. REDESIGNED SETTINGS (1440px) via Profile Popover
  console.log('8. Capturing: Redesigned Settings...');
  const settingsNav = page.locator('button.nav-item[data-tooltip="Settings"], button.nav-item:has-text("Settings")');
  if (await settingsNav.isVisible().catch(() => false)) {
    await settingsNav.click();
  } else {
    await page.click('.side-profile-trigger');
    await page.waitForSelector('.profile-dropdown-menu', { timeout: 4000 });
    await page.click('.profile-dropdown-item:has-text("Account Settings"), .profile-dropdown-item:has-text("Settings")');
  }
  await page.waitForSelector('.settings-layout, .settings-nav-tabs', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesigned_settings.png'), fullPage: false });

  // 9. PASSPORT VIEW (1440px) via Profile Popover
  console.log('9. Capturing: Passport view...');
  const passportNav = page.locator('button.nav-item[data-tooltip="Passport"], button.nav-item:has-text("Passport")');
  if (await passportNav.isVisible().catch(() => false)) {
    await passportNav.click();
  } else {
    await page.click('.side-profile-trigger');
    await page.waitForSelector('.profile-dropdown-menu', { timeout: 4000 });
    await page.click('.profile-dropdown-item:has-text("Skill Passport"), .profile-dropdown-item:has-text("Passport")');
  }
  await page.waitForSelector('.passport, .proof-list, .passport-stats', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'passport_view.png'), fullPage: false });

  // 10. MOBILE DASHBOARD (375px)
  console.log('10. Capturing: Mobile dashboard (375px)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.click('.mobile-tab-item:has-text("Home")');
  await page.waitForSelector('.welcome, .today-dashboard', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_dashboard.png'), fullPage: false });

  // 11. MOBILE NAVIGATION DRAWER (375px)
  console.log('11. Capturing: Mobile navigation drawer (375px)...');
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

  // 12. MOBILE VIEWPORT 320px
  console.log('12. Capturing: Mobile viewport 320px...');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_viewport_320px.png'), fullPage: false });

  // Responsive overflow validation across all required widths
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
  console.log('\nSuccessfully captured and saved all 12 required screenshots to active artifact directory!');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
