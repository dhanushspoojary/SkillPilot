import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
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
const ARTIFACT_DIR = 'C:\\Users\\Dhanush S Poojary\\.gemini\\antigravity-ide\\brain\\df4a9773-11d5-40c8-b581-bbff2f7f2d2f';
const stamp = Date.now();
const testEmail = `ui_ux_verify_${stamp}@skillpilot.test`;
const password = 'TestSecurePassword123!';

const check = (cond, msg) => {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`  ✓ ${msg}`);
};

console.log('=== SKILLPILOT 2.1 — MASTER UI/UX & ADAPTIVE ONBOARDING BROWSER VERIFICATION ===');
console.log(`Target URL: ${BASE_URL}\n`);

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

  const page = await context.newPage();

  // 1. Authenticate or ensure active session
  console.log(`1. Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const isAlreadyLoggedIn = await page.locator('.app-shell').isVisible().catch(() => false);
  if (!isAlreadyLoggedIn) {
    console.log(`   Signing up test student account (${testEmail})...`);
    const createAcctBtn = page.locator('button:has-text("Create account")');
    if (await createAcctBtn.isVisible()) {
      await createAcctBtn.click();
      await page.fill('label:has-text("Name") input', 'Dev Student');
      await page.fill('label:has-text("Email") input', testEmail);
      await page.fill('label:has-text("Password") input', password);
      const studentRoleBtn = page.locator('.role-picker button').first();
      if (await studentRoleBtn.isVisible()) await studentRoleBtn.click();
      await page.click('button.primary.auth-submit');
    }
  } else {
    console.log('   Active session detected; directly verifying authenticated workspace.');
  }

  // Wait for application shell
  console.log('2. Waiting for initial application load...');
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.waitForTimeout(1000);

  const dismissModalIfOpen = async () => {
    const btn = page.locator('.onboarding-modal .icon-btn-close');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  };

  // Wait for bootstrap to settle and dismiss modal for initial layout tests
  await page.waitForTimeout(2000);
  await dismissModalIfOpen();

  // =========================================================================
  // TEST A: STICKY COLLAPSIBLE SIDEBAR & TWO INDEPENDENT SCROLLING REGIONS
  // =========================================================================
  console.log('\n--- TEST A: Sticky Collapsible Sidebar & Independent Scrolling ---');
  
  // Verify independent scrolling styles on desktop
  const layoutStyles = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main');
    return {
      shellOverflow: window.getComputedStyle(shell).overflow,
      shellHeight: window.getComputedStyle(shell).height,
      sidebarOverflowY: window.getComputedStyle(sidebar).overflowY,
      sidebarHeight: window.getComputedStyle(sidebar).height,
      mainOverflowY: window.getComputedStyle(main).overflowY,
      mainHeight: window.getComputedStyle(main).height,
    };
  });
  console.log('   Layout styles:', layoutStyles);
  check(layoutStyles.shellOverflow === 'hidden', '.app-shell must have overflow: hidden');
  check(layoutStyles.sidebarOverflowY === 'auto', '.sidebar must have independent overflow-y: auto');
  check(layoutStyles.mainOverflowY === 'auto', '.main must have independent overflow-y: auto');

  // Test scrolling main content: sidebar must remain stationary
  const sidebarInitialTop = await page.evaluate(() => {
    const sb = document.querySelector('.sidebar');
    return sb.getBoundingClientRect().top;
  });

  // Scroll main region down 500px
  await page.evaluate(() => {
    const main = document.querySelector('.main');
    main.scrollTop = 500;
  });
  await page.waitForTimeout(300);

  const sidebarAfterScrollTop = await page.evaluate(() => {
    const sb = document.querySelector('.sidebar');
    return sb.getBoundingClientRect().top;
  });
  const windowScrollY = await page.evaluate(() => window.scrollY);

  check(sidebarInitialTop === sidebarAfterScrollTop, 'Sidebar stays stationary during main-content scrolling');
  check(windowScrollY === 0, 'No window double scrollbar (window.scrollY === 0)');

  // Reset scroll
  await page.evaluate(() => {
    document.querySelector('.main').scrollTop = 0;
  });

  // Capture Screenshot: Desktop Sidebar Expanded
  const shot1 = path.join(ARTIFACT_DIR, 'desktop_sidebar_expanded.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log(`   📸 Captured: ${shot1}`);

  // Test Sidebar Collapse
  console.log('   Testing sidebar collapse...');
  const initialWidth = await page.evaluate(() => document.querySelector('.sidebar').getBoundingClientRect().width);
  console.log(`   Initial sidebar width: ${initialWidth}px`);
  check(initialWidth >= 220 && initialWidth <= 260, 'Expanded width is approximately 240px');

  await dismissModalIfOpen();
  const collapseToggle = page.locator('.sidebar-collapse-toggle');
  check(await collapseToggle.isVisible(), 'Collapse toggle button is visible');
  await collapseToggle.click();
  await page.waitForTimeout(400);

  const collapsedWidth = await page.evaluate(() => document.querySelector('.sidebar').getBoundingClientRect().width);
  console.log(`   Collapsed sidebar width: ${collapsedWidth}px`);
  check(collapsedWidth >= 65 && collapsedWidth <= 80, 'Collapsed width is approximately 72px');

  // Capture Screenshot: Desktop Sidebar Collapsed
  const shot2 = path.join(ARTIFACT_DIR, 'desktop_sidebar_collapsed.png');
  await page.screenshot({ path: shot2, fullPage: false });
  console.log(`   📸 Captured: ${shot2}`);

  // Verify persistence after page reload
  console.log('   Testing localStorage persistence on reload...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sidebar', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await dismissModalIfOpen();

  const reloadedWidth = await page.evaluate(() => document.querySelector('.sidebar').getBoundingClientRect().width);
  console.log(`   Reloaded sidebar width: ${reloadedWidth}px`);
  check(reloadedWidth >= 65 && reloadedWidth <= 80, 'Sidebar collapsed state persisted across reload');

  // Expand sidebar back
  await dismissModalIfOpen();
  await page.click('.sidebar-collapse-toggle');
  await page.waitForTimeout(400);
  const reExpandedWidth = await page.evaluate(() => document.querySelector('.sidebar').getBoundingClientRect().width);
  check(reExpandedWidth >= 220 && reExpandedWidth <= 260, 'Sidebar expands back to ~240px');

  // =========================================================================
  // TEST B: FOUR CONSOLIDATED NAVIGATION HUBS & PROFILE MENU
  // =========================================================================
  console.log('\n--- TEST B: 4 Consolidated Navigation Hubs & Profile Menu ---');
  
  const hubTitles = await page.$$eval('.nav-group-title', (els) => els.map((el) => el.textContent.trim()));
  console.log('   Found Navigation Hubs:', hubTitles);
  check(hubTitles.includes('DASHBOARD'), 'Hub DASHBOARD exists');
  check(hubTitles.includes('LEARNING'), 'Hub LEARNING exists');
  check(hubTitles.includes('CAREER'), 'Hub CAREER exists');
  check(hubTitles.includes('INTERVIEWS'), 'Hub INTERVIEWS exists');

  // Navigate to Learn in LEARNING
  console.log('   Navigating to Learn view...');
  await dismissModalIfOpen();
  await page.click('button.nav-item:has-text("Learn")');
  await page.waitForTimeout(500);
  check(await page.locator('.learn-workspace').isVisible(), 'Navigated to Learn');

  // Test Profile Menu
  console.log('   Testing Profile Dropdown Menu...');
  const profileTrigger = page.locator('.side-profile-trigger');
  await profileTrigger.click();
  await page.waitForTimeout(300);

  const profileMenu = page.locator('.profile-dropdown-menu');
  check(await profileMenu.isVisible(), 'Profile dropdown menu opened');

  const profileDestinations = await page.$$eval('.profile-dropdown-menu .profile-dropdown-item', (els) => els.map((el) => el.textContent.trim()));
  console.log('   Profile menu destinations:', profileDestinations);
  check(profileDestinations.some((d) => d.includes('Agent')), 'Agent destination present in profile menu');
  check(profileDestinations.some((d) => d.includes('Passport')), 'Passport destination present in profile menu');
  check(profileDestinations.some((d) => d.includes('Settings')), 'Settings destination present in profile menu');

  // Close profile menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Return to Today view
  await dismissModalIfOpen();
  await page.click('button.nav-item:has-text("Today")');
  await page.waitForTimeout(500);

  // =========================================================================
  // TEST C: DECLUTTERED TODAY DASHBOARD
  // =========================================================================
  console.log('\n--- TEST C: Decluttered Today Dashboard ---');

  // Check 4 top summary metric cards
  const summaryMetricTitles = await page.$$eval('.summary-metric-title', (els) => els.map((el) => el.textContent.trim()));
  console.log('   Summary Metric Titles:', summaryMetricTitles);
  check(summaryMetricTitles.includes('TARGET CAREER'), 'Top metric: TARGET CAREER present');
  check(summaryMetricTitles.includes('READINESS'), 'Top metric: READINESS present');
  check(summaryMetricTitles.includes('VERIFIED SKILLS'), 'Top metric: VERIFIED SKILLS present');
  check(summaryMetricTitles.includes('CURRENT MILESTONE'), 'Top metric: CURRENT MILESTONE present');
  check(summaryMetricTitles.length === 4, 'Exactly 4 non-redundant metrics shown at top');

  // Verify Primary Action Card
  const priorityCard = page.locator('.priority-card');
  check(await priorityCard.isVisible(), 'One prominent Recommended Action Card is visible');
  const actionEyebrow = await priorityCard.locator('.priority-eyebrow').textContent();
  console.log(`   Action card eyebrow: "${actionEyebrow?.trim()}"`);
  check(actionEyebrow?.includes('RECOMMENDED NEXT STEP') || actionEyebrow?.includes('ONE PRIMARY ACTION'), 'Primary action card has clear kicker');

  const actionBtn = priorityCard.locator('button.primary.priority-action-btn');
  check(await actionBtn.isVisible(), 'Primary action button is present and clickable');

  // Verify duplicate circular readiness progress card is removed
  const duplicateRings = await page.locator('.dashboard-sidebar-col .readiness .ring-wrap').count();
  console.log(`   Duplicate readiness rings in sidebar column: ${duplicateRings}`);
  check(duplicateRings === 0, 'Duplicate readiness ring removed from sidebar column');

  // Capture Screenshot: Today Dashboard Decluttered
  const shot3 = path.join(ARTIFACT_DIR, 'today_dashboard_decluttered.png');
  await page.screenshot({ path: shot3, fullPage: false });
  console.log(`   📸 Captured: ${shot3}`);

  // =========================================================================
  // TEST D: INTERACTIVE VISUAL ROADMAP & SKILL TREE
  // =========================================================================
  console.log('\n--- TEST D: Visual Roadmap & Skill Tree ---');

  // Navigate to Roadmap
  await dismissModalIfOpen();
  await page.click('button.nav-item:has-text("Roadmap")');
  await page.waitForTimeout(600);

  const roadmapTree = page.locator('.roadmap-skill-tree-container');
  check(await roadmapTree.isVisible(), 'Roadmap skill tree container is visible');

  // Check milestone nodes
  const nodeCount = await page.locator('.skill-node-card').count();
  console.log(`   Milestone nodes rendered: ${nodeCount}`);
  check(nodeCount >= 6, 'All 6 core milestones rendered in vertical tree');

  // Capture Screenshot: Roadmap Skill Tree
  const shot4 = path.join(ARTIFACT_DIR, 'roadmap_skill_tree.png');
  await page.screenshot({ path: shot4, fullPage: false });
  console.log(`   📸 Captured: ${shot4}`);

  // Click first node to open detail side drawer
  console.log('   Clicking first milestone node to inspect side drawer...');
  await page.locator('.skill-node-card').first().click();
  await page.waitForTimeout(400);

  const detailDrawer = page.locator('.roadmap-detail-drawer');
  check(await detailDrawer.isVisible(), 'Roadmap detail side drawer opened');

  const drawerTitle = await detailDrawer.locator('.drawer-title').textContent();
  console.log(`   Detail Drawer Title: "${drawerTitle?.trim()}"`);
  check(drawerTitle?.includes('Problem Solving') || (drawerTitle && drawerTitle.length > 3), 'Milestone detail title displayed');

  const drawerSections = await page.$$eval('.roadmap-detail-drawer .section-title', (els) => els.map((el) => el.textContent.trim().toUpperCase()));
  console.log('   Drawer sections:', drawerSections);
  check(drawerSections.some((s) => s.includes('LEARNING OBJECTIVE')), 'Objective section present');
  check(drawerSections.some((s) => s.includes('WHY IT MATTERS')), 'Why this matters section present');
  check(drawerSections.some((s) => s.includes('COMPLETION REQUIREMENTS')), 'Completion requirements present');

  // Capture Screenshot: Roadmap Side Drawer Detail
  const shot5 = path.join(ARTIFACT_DIR, 'roadmap_drawer_detail.png');
  await page.screenshot({ path: shot5, fullPage: false });
  console.log(`   📸 Captured: ${shot5}`);

  // Test Escape key to close drawer
  console.log('   Pressing Escape to close detail drawer...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(!(await page.locator('.roadmap-detail-drawer').isVisible().catch(() => false)), 'Drawer closed on Escape key');

  // =========================================================================
  // TEST E: CONVERSATIONAL LLM ADAPTIVE ONBOARDING
  // =========================================================================
  console.log('\n--- TEST E: Conversational Adaptive Onboarding ---');

  // Navigate back to Today and open Calibration modal
  await page.click('button.nav-item:has-text("Today")');
  await page.waitForTimeout(500);

  const calibrateBtn = page.locator('button.calibrate-btn');
  if (await calibrateBtn.isVisible()) {
    await calibrateBtn.click();
    await page.waitForTimeout(500);
  }

  const onboardModal = page.locator('.onboarding-modal');
  check(await onboardModal.isVisible(), 'Onboarding modal opened');

  // Switch to Technical Diagnostic Tab
  console.log('   Switching to Technical Diagnostic Tab...');
  await page.click('button:has-text("2. Technical Diagnostic")');
  await page.waitForSelector('.adaptive-assessment-container', { timeout: 15000 });
  await page.waitForTimeout(500);

  const activeQuestionCard = page.locator('.adaptive-assessment-container');
  check(await activeQuestionCard.isVisible(), 'Adaptive Technical Assessment view active');

  // Verify active question displayed
  const questionHeading = page.locator('.adaptive-assessment-container h3');
  check(await questionHeading.isVisible(), 'Active technical question text displayed');
  const questionText = await questionHeading.textContent();
  console.log(`   First Adaptive Question: "${questionText?.trim()}"`);

  // Capture Screenshot: Adaptive Question Active
  const shot6 = path.join(ARTIFACT_DIR, 'adaptive_onboarding_question.png');
  await page.screenshot({ path: shot6, fullPage: false });
  console.log(`   📸 Captured: ${shot6}`);

  // Type technical explanation into textarea
  const answerText = 'When a function returns, its stack frame is popped from the call stack and all local variables allocated on that frame are deallocated and freed from scope memory.';
  console.log('   Submitting technical explanation...');
  await page.fill('.adaptive-assessment-container textarea', answerText);
  await page.click('button:has-text("Submit Explanation")');

  // Wait for submission response
  await page.waitForResponse((r) => r.url().includes('/api/onboarding/submit') && r.status() === 200, { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Verify evaluation feedback appeared
  const evalCard = page.locator('.adaptive-assessment-container').locator('text=/CORRECT|PARTIAL|INCORRECT/');
  check(await evalCard.isVisible(), 'Evaluation feedback with evaluation badge displayed');

  // Capture Screenshot: Adaptive Evaluation Feedback
  const shot7 = path.join(ARTIFACT_DIR, 'adaptive_onboarding_evaluation.png');
  await page.screenshot({ path: shot7, fullPage: false });
  console.log(`   📸 Captured: ${shot7}`);

  // Test safe resume: reload page and check question state restored
  console.log('   Testing safe resume after page refresh...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // If modal closed on reload, open it again
  if (!(await page.locator('.onboarding-modal').isVisible().catch(() => false))) {
    const calBtn = page.locator('button.calibrate-btn');
    if (await calBtn.isVisible()) await calBtn.click();
    await page.waitForTimeout(500);
  }

  // Switch to Technical Diagnostic
  const diagTab = page.locator('button:has-text("2. Technical Diagnostic")');
  if (await diagTab.isVisible()) {
    await diagTab.click();
    await page.waitForSelector('.adaptive-assessment-container', { timeout: 15000 });
    await page.waitForTimeout(500);
  }

  // Verify previous answered turn is restored
  const restoredEval = page.locator('.adaptive-assessment-container').locator('text=/CORRECT|PARTIAL|INCORRECT/');
  check(await restoredEval.isVisible(), 'Assessment state safely resumed from server database');

  // Close modal
  const modalClose = page.locator('.onboarding-modal .icon-btn-close');
  if (await modalClose.isVisible()) await modalClose.click();
  await page.waitForTimeout(300);

  // =========================================================================
  // TEST F: MOBILE VIEWPORT TESTING (375px & 320px)
  // =========================================================================
  console.log('\n--- TEST F: Mobile Responsive Navigation (375px & 320px) ---');

  // Set viewport to 375x667 (iPhone standard)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);

  // Check desktop sidebar hidden
  const desktopSidebarVisible = await page.evaluate(() => {
    const sb = document.querySelector('.sidebar');
    return window.getComputedStyle(sb).display;
  });
  console.log(`   Sidebar display at 375px: ${desktopSidebarVisible}`);
  check(desktopSidebarVisible === 'none', 'Desktop sidebar is hidden on small screens');

  // Check bottom nav bar
  const bottomNav = page.locator('.mobile-bottom-nav');
  check(await bottomNav.isVisible(), 'Mobile compact bottom navigation bar is visible');

  // Capture Screenshot: Mobile Bottom Nav 375px
  const shot8 = path.join(ARTIFACT_DIR, 'mobile_bottom_nav_375px.png');
  await page.screenshot({ path: shot8, fullPage: false });
  console.log(`   📸 Captured: ${shot8}`);

  // Test Mobile Drawer opening
  console.log('   Testing mobile drawer via "More" button...');
  await page.click('button.mobile-more-btn');
  await page.waitForTimeout(400);

  const mobileDrawer = page.locator('.mobile-drawer.open');
  check(await mobileDrawer.isVisible(), 'Mobile drawer opened');

  // Check body scroll lock
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  check(bodyOverflow === 'hidden', 'Body scroll is locked while mobile drawer is open');

  // Capture Screenshot: Mobile Drawer Open 375px
  const shot9 = path.join(ARTIFACT_DIR, 'mobile_drawer_open_375px.png');
  await page.screenshot({ path: shot9, fullPage: false });
  console.log(`   📸 Captured: ${shot9}`);

  // Test Escape key closes mobile drawer
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(!(await page.locator('.mobile-drawer.open').isVisible().catch(() => false)), 'Mobile drawer closed via Escape key');

  // Test at 320px viewport
  console.log('   Testing ultra-compact 320px width for horizontal overflow...');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(400);

  const overflowAt320 = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  check(!overflowAt320, 'Zero horizontal overflow at 320px viewport');

  // Capture Screenshot: Mobile Viewport 320px
  const shot10 = path.join(ARTIFACT_DIR, 'mobile_viewport_320px.png');
  await page.screenshot({ path: shot10, fullPage: false });
  console.log(`   📸 Captured: ${shot10}`);

  console.log('\n🎉 ALL BROWSER AUTOMATION TESTS PASSED COMPLETELY!');

} catch (err) {
  console.error('\n❌ Browser verification encountered an error:', err);
  process.exit(1);
} finally {
  if (browser) await browser.close();
  await pool.end();
}
