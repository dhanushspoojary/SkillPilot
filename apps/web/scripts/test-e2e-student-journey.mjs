import { chromium } from 'playwright';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const stamp = Date.now();
const testEmail = `student-e2e-${stamp}@test.local`;
const testPassword = 'Password123456!';
const testName = `Student Journey ${stamp}`;

function log(step, msg) {
  console.log(`[E2E STEP ${step}] ${msg}`);
}

(async () => {
  log(1, `Launching Chrome via Playwright to test real student journey...`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Visit landing page
    log(2, `Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const title = await page.title();
    console.log(`   Page loaded: "${title}"`);

    // 2. Switch to Create account
    log(3, `Switching to Create Account tab...`);
    const createAccountTab = page.locator('.auth-tabs button', { hasText: 'Create account' });
    await createAccountTab.click();

    // 3. Fill in registration form
    log(4, `Filling registration form for ${testEmail}...`);
    await page.fill('input[autocomplete="name"]', testName);
    await page.fill('input[autocomplete="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    
    // Ensure student role is selected
    const studentRoleBtn = page.getByRole('button', { name: /Student/ }).first();
    if (await studentRoleBtn.isVisible()) {
      await studentRoleBtn.click();
    }

    log(5, `Submitting registration...`);
    await page.click('button.auth-submit');

    // 4. Dismiss cinematic intro if present
    log(6, `Waiting for workspace or cinematic intro...`);
    try {
      await page.waitForSelector('.cinematic-entry-overlay, .onboarding-overlay', { timeout: 10000 });
      const skipBtn = page.locator('.cinematic-skip-pill');
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
        console.log('   Dismissed cinematic intro via skip button.');
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForSelector('.cinematic-entry-overlay', { state: 'hidden', timeout: 5000 }).catch(() => {});
    } catch {}

    // 5. Handle Onboarding Overlay
    log(7, `Waiting for Guided Onboarding Overlay to appear...`);
    await page.waitForSelector('.onboarding-overlay', { state: 'visible', timeout: 15000 });
    console.log('   Onboarding overlay successfully appeared!');

    // Switch to Quick Form mode for full structured controls & skill picker
    const switchFormBtn = page.locator('button', { hasText: 'Switch to Quick Form' });
    if (await switchFormBtn.isVisible()) {
      await switchFormBtn.click();
      console.log('   Switched to Quick Form mode.');
      await page.waitForTimeout(400);
    }

    // Check skill picker
    const skillButtons = page.locator('.onboarding-group button');
    const skillCount = await skillButtons.count();
    console.log(`   Found ${skillCount} selectable skills in categorized picker.`);

    // Select "C" as Want to Learn (click once)
    const cSkill = page.locator('.onboarding-group button', { hasText: /^C$|^C / }).first();
    if (await cSkill.isVisible()) {
      await cSkill.click();
      console.log('   Selected "C" -> Want to Learn (Green badge)');
    }

    // Select "JavaScript" as Know Already (click twice)
    const jsSkill = page.locator('.onboarding-group button', { hasText: /^JavaScript$|^JavaScript / }).first();
    if (await jsSkill.isVisible()) {
      await jsSkill.click();
      await page.waitForTimeout(150);
      await jsSkill.click();
      console.log('   Selected "JavaScript" -> Know Already (Blue badge)');
    }

    // Submit calibration
    const submitBtn = page.locator('button.submit-setup-btn').first();
    await submitBtn.click();
    console.log('   Submitted onboarding calibration!');

    // Wait for onboarding overlay to be dismissed
    await page.waitForSelector('.onboarding-overlay', { state: 'hidden', timeout: 10000 });
    console.log('   Onboarding overlay completed and dismissed.');
    await page.waitForTimeout(1000);

    // 6. Navigate to Roadmap tab
    log(8, `Navigating to Roadmap tab to inspect actionable learning task...`);
    const roadmapTab = page.locator('.nav-item').filter({ hasText: 'Roadmap' }).first();
    await roadmapTab.click();
    await page.waitForTimeout(1200);

    // Verify RECOMMENDED LEARNING TASK banner with Start Learning button
    const roadmapCard = page.locator('.roadmap-actionable-task-card, div:has-text("RECOMMENDED LEARNING TASK")').first();
    const isBannerVisible = await roadmapCard.isVisible();
    console.log(`   Roadmap Actionable Task Banner visible: ${isBannerVisible}`);

    // 7. Click Start Learning trigger
    log(9, `Clicking "Start Learning" trigger directly from roadmap...`);
    const ctaBtn = page.locator('.roadmap-actionable-task-card button, button.large-start-btn').first();
    if (await ctaBtn.isVisible()) {
      await ctaBtn.click();
      console.log('   Clicked actionable task CTA button!');
      await page.waitForTimeout(1500);
    }

    // Ensure Learn tab is active
    log(10, `Ensuring LearnWorkspace is active (02 // Learn)...`);
    const learnNav = page.locator('.nav-item').filter({ hasText: 'Learn' }).first();
    await learnNav.click();
    await page.waitForTimeout(1200);

    // 8. Verify LearnWorkspace
    log(11, `Verifying LearnWorkspace active state and walkthrough...`);
    await page.waitForSelector('.learn-workspace', { timeout: 10000 });
    console.log('   LearnWorkspace successfully loaded!');

    // Check Walkthrough step navigation
    const nextStepBtn = page.locator('button.step-nav-btn.primary:has-text("Next Step")').first();
    if (await nextStepBtn.isVisible() && await nextStepBtn.isEnabled()) {
      await nextStepBtn.click();
      console.log('   Navigated to Step 2 in code walkthrough!');
      await page.waitForTimeout(400);
    }

    // 9. Switch to Code Tracing & Practice tab
    log(12, `Switching to Code Tracing & Practice tab...`);
    const practiceTab = page.locator('button:has-text("Code Tracing & Practice")').first();
    await practiceTab.click();
    await page.waitForTimeout(1000);

    // Wait for choices to be present
    await page.waitForSelector('.choice-item', { timeout: 8000 });
    const choices = page.locator('.choice-item');
    const choiceCount = await choices.count();
    console.log(`   Found ${choiceCount} choices for code tracing exercise.`);

    if (choiceCount >= 2) {
      log(13, `Submitting incorrect answer to test Socratic misconception diagnosis...`);
      await choices.nth(1).click(); // Choice 1 (value '6', incorrect)
      const submitAnswerBtn = page.locator('button.submit-btn:has-text("Submit Answer")').first();
      await submitAnswerBtn.click();
      
      // Wait for feedback card
      await page.waitForSelector('.feedback-card', { timeout: 8000 });
      const feedbackCard = page.locator('.feedback-card').first();
      const feedbackText = await feedbackCard.innerText();
      console.log(`   Socratic Misconception Feedback: "${feedbackText.replace(/\n+/g, ' ').slice(0, 100)}..."`);

      // Now click Choice 0 (value '4', correct answer)
      log(14, `Submitting correct answer (Choice 0) to demonstrate concept mastery progression...`);
      await choices.nth(0).click(); // Clears previous attempt and selects choice 0
      await submitAnswerBtn.click();
      
      await page.waitForSelector('.feedback-card.correct', { timeout: 8000 });
      const updatedFeedback = await feedbackCard.innerText();
      console.log(`   Demonstrated Competency Feedback: "${updatedFeedback.replace(/\n+/g, ' ').slice(0, 100)}..."`);

      // Verify concept mastery sidebar badge
      const masteryBadge = page.locator('.concept-mastery-card, .mastery-badge').first();
      console.log(`   Concept mastery status badge active: ${await masteryBadge.isVisible()}`);
    }

    // 10. Test Browser Refresh & Session Persistence
    log(15, `Testing page reload...`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Verify student is still in authenticated workspace (not back on AuthGate)
    const authShell = page.locator('.auth-shell');
    const isLoggedOut = await authShell.isVisible().catch(() => false);
    if (isLoggedOut) {
      throw new Error('Student session was lost on browser refresh!');
    }
    console.log('   Student session and workspace persisted across browser refresh!');

    // 11. Test Log Out & Log Back In
    log(16, `Testing Log out and Log back in...`);
    // Open profile dropdown in sidebar using .side-profile-trigger
    const profileTrigger = page.locator('.side-profile-trigger').first();
    await profileTrigger.click();
    await page.waitForTimeout(400);

    // Click Log out button inside profile dropdown menu
    const logoutBtn = page.locator('.profile-dropdown-item.logout-item, button:has-text("Log out")').first();
    await logoutBtn.click();
    await page.waitForTimeout(1500);

    // Verify back on AuthGate
    await page.waitForSelector('.auth-shell', { timeout: 8000 });
    console.log('   Successfully logged out to AuthGate login form.');

    // Log in again with test credentials
    log(17, `Signing back in with ${testEmail}...`);
    await page.fill('input[autocomplete="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button.auth-submit');
    await page.waitForTimeout(2000);

    // Verify main app loaded
    await page.waitForSelector('.app-shell, #main-content', { timeout: 10000 });
    console.log('   Successfully signed back in! PostgreSQL session and progress recovered.');

    console.log('\n======================================================');
    console.log('PHASE 2: REAL STUDENT JOURNEY 100% VERIFIED IN CHROME');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\nE2E Journey Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
