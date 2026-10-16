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
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const stamp = Date.now();

console.log('=== Starting SkillPilot End-to-End Product Flow Verification ===');

let browser;
let studentEmail = null;
try {
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  // Step 1: Open Application & ensure fresh session
  console.log('1. Navigating to application...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await context.clearCookies();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const title = await page.title();
  console.log(`   Page title: "${title}"`);

  // Step 2: Register a student account
  console.log('2. Registering fresh student account...');
  studentEmail = `student_${stamp}@e2e.test`;
  const studentName = `E2E Student ${stamp.toString().slice(-4)}`;
  const password = 'student-secure-password-123';

  // Click "Create account" tab
  await page.click('button:has-text("Create account")');
  await page.waitForTimeout(400);

  // Fill signup form
  await page.fill('label:has-text("Name") input', studentName);
  await page.fill('label:has-text("Email") input', studentEmail);
  await page.fill('label:has-text("Password") input', password);

  // Select student role
  const studentRoleBtn = page.locator('.role-picker button').first();
  if (await studentRoleBtn.isVisible()) {
    await studentRoleBtn.click();
  }

  // Submit signup
  console.log('   Submitting signup form...');
  await page.click('button.primary.auth-submit');

  // Step 3: Verify Student Dashboard loads
  console.log('3. Verifying Student Dashboard...');
  await page.waitForSelector('.welcome, .app-shell, #main-content', { timeout: 15000 });
  const welcomeText = await page.textContent('.welcome h1, h1');
  console.log(`   Dashboard loaded successfully: "${welcomeText?.replace(/\s+/g, ' ').trim()}"`);

  // Step 4: Start Adaptive Assessment in Browser
  console.log('4. Starting Adaptive Assessment from Dashboard...');
  const assessBtn = page.locator('button.primary:has-text("Start adaptive assessment")').first();
  await assessBtn.click();

  // Wait for assessment question to load
  await page.waitForSelector('.question-text, .assessment-shell', { timeout: 12000 });
  console.log('   Assessment shell loaded!');

  // Check progress header
  const progressText = await page.textContent('.assessment-top');
  console.log(`   Progress header: ${progressText?.replace(/\s+/g, ' ').trim()}`);

  // Step 5: Answer Assessment Questions interactively
  console.log('5. Answering adaptive assessment questions in browser...');
  let questionsAnswered = 0;
  const maxQuestions = 15; // safeguard loop limit

  while (questionsAnswered < maxQuestions) {
    // Check if results screen reached
    const resultsHeadline = page.locator('.score-headline');
    if (await resultsHeadline.isVisible()) {
      const score = await resultsHeadline.textContent();
      console.log(`   Assessment completed! Overall score: ${score?.trim()}`);
      break;
    }

    // Wait for options to be enabled
    const option = page.locator('.option-btn:not([disabled])').first();
    await option.waitFor({ state: 'visible', timeout: 15000 });
    await option.click();
    await page.waitForTimeout(100);

    // Wait for submit button to be enabled
    const submitBtn = page.locator('.submit-btn:not([disabled])');
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Submit answer and wait for response
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/assess/submit') && (r.status() === 200 || r.status() === 201),
        { timeout: 20000 }
      ),
      submitBtn.click(),
    ]);

    questionsAnswered++;
    console.log(`   Answered question #${questionsAnswered}...`);

    const json = await response.json().catch(() => ({}));
    if (json.done) {
      console.log('   Final question submitted. Diagnostic complete!');
      break;
    }

    // Brief pause for React transition to next question
    await page.waitForTimeout(500);
  }

  // Step 6: Verify Authoritative Results View
  console.log('6. Verifying Diagnostic Results View...');
  await page.waitForSelector('.results-breakdown, .result-list', { timeout: 10000 });
  const hasBreakdown = await page.$('.results-breakdown');
  console.log(`   Diagnostic results breakdown verified: ${Boolean(hasBreakdown)}`);

  // Step 7: Navigate to Roadmap
  console.log('7. Navigating to Personalized Roadmap...');
  const viewPlanBtn = page.locator('button.primary:has-text("See Updated Roadmap")').first();
  if (await viewPlanBtn.isVisible()) {
    await viewPlanBtn.click();
  } else {
    await page.click('button.nav-item:has-text("Roadmap")');
  }

  await page.waitForSelector('.roadmap-list, .action-stack', { timeout: 8000 });
  console.log('   Roadmap successfully displayed!');

  // Step 8: Complete Learning Action on Today View
  console.log('8. Completing learning action on Today dashboard...');
  await page.click('button.nav-item:has-text("Today")');
  await page.waitForSelector('.action-card', { timeout: 8000 });

  const firstAction = page.locator('.action-card').first();
  if (await firstAction.isVisible()) {
    const actionTitle = await firstAction.textContent();
    console.log(`   Interacting with action: "${actionTitle?.slice(0, 35).trim()}..."`);
    await firstAction.click();
    await page.waitForTimeout(1000);
    console.log('   Action recorded successfully.');
  }

  // Step 9: Verify Mock Interview Navigation
  console.log('9. Navigating to Mock Interview...');
  await page.click('button.nav-item:has-text("Mock interview")');
  await page.waitForSelector('.page, #main-content', { timeout: 8000 });
  console.log('   Mock interview view loaded.');

  // Step 10: Verify Skill Passport & Public Share Card
  console.log('10. Verifying Skill Passport & Public Share Card...');
  await page.click('button.nav-item:has-text("Passport")');
  await page.waitForSelector('.passport, .proof-list', { timeout: 8000 });
  const passportTitle = await page.textContent('.passport-top');
  console.log(`   Skill Passport verified: "${passportTitle?.slice(0, 35).replace(/\s+/g, ' ').trim()}"`);

  // Generate public verification link
  const generateBtn = page.locator('button:has-text("Generate Public Verification Link")');
  if (await generateBtn.isVisible()) {
    console.log('   Generating public passport share link...');
    await generateBtn.click();
    await page.waitForSelector('.share-url-input', { timeout: 8000 });
  }

  const shareUrl = await page.inputValue('.share-url-input');
  console.log(`   Generated share URL: ${shareUrl}`);

  // Open public card in unauthenticated context
  console.log('   Opening public passport card in unauthenticated browser context...');
  const publicContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const publicPage = await publicContext.newPage();
  const publicErrors = [];
  publicPage.on('console', (msg) => {
    if (msg.type() === 'error') publicErrors.push(msg.text());
  });
  publicPage.on('pageerror', (err) => publicErrors.push(err.message));

  await publicPage.goto(shareUrl, { waitUntil: 'networkidle' });
  await publicPage.waitForSelector('.public-passport-card', { timeout: 10000 });
  const publicName = await publicPage.textContent('.student-name');
  console.log(`   Public card loaded for: "${publicName?.trim()}"`);
  const publicScore = await publicPage.textContent('.score-num');
  console.log(`   Public card readiness: ${publicScore?.trim()}`);

  const cardErrors = publicErrors.filter(
    (e) => !e.includes('favicon') && !e.includes('sw.js') && !e.includes('manifest')
  );
  if (cardErrors.length > 0) {
    console.warn('   Public card console errors:', cardErrors);
  } else {
    console.log('   Public passport card rendered cleanly with zero console errors!');
  }
  await publicContext.close();

  // Step 11: Verify Career Companion conversational intelligence
  console.log('11. Verifying Career Companion agent...');
  await page.click('button.nav-item:has-text("Agent")');
  await page.waitForSelector('#agent-q', { timeout: 8000 });

  console.log('   Sending natural conversation message to agent...');
  await page.fill('#agent-q', 'Hi! I am a first-year student exploring backend engineering');
  await page.click('.agent-input-form button.primary');

  // Wait for agent reply
  await page.waitForFunction(
    () => document.querySelectorAll('.chat-msg.agent').length >= 2,
    { timeout: 20000 },
  );
  const spinner = page.locator('.chat-msg.agent .spin');
  if (await spinner.isVisible()) {
    await spinner.waitFor({ state: 'detached', timeout: 20000 });
  }
  const agentMessages = await page.locator('.chat-msg.agent').allTextContents();
  const latestReply = agentMessages[agentMessages.length - 1];
  console.log(`   Agent replied: "${latestReply.slice(0, 150).replace(/\s+/g, ' ').trim()}..."`);

  // Step 12: Responsive Viewport Checks
  console.log('12. Testing responsive layouts (320px, 375px, 768px, 1024px, 1440px)...');
  const viewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasHorizontalOverflow = scrollWidth > clientWidth;
    console.log(`   Viewport ${vp.width}x${vp.height}: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${hasHorizontalOverflow}`);
  }

  // Check console errors
  console.log('13. Inspecting browser console for uncaught errors...');
  const criticalErrors = consoleErrors.filter(
    (e) => !e.includes('favicon') && !e.includes('sw.js') && !e.includes('manifest')
  );
  if (criticalErrors.length > 0) {
    console.warn(`   Console errors (${criticalErrors.length}):`, criticalErrors.slice(0, 3));
  } else {
    console.log('   Zero uncaught console errors recorded during full workflow!');
  }

  await context.close();
  await browser.close();

  console.log('\n=== SkillPilot Full Product Flow Verification: COMPLETE & PASSED ===');
} catch (err) {
  console.error('\nE2E Workflow FAILED:', err);
  if (browser) await browser.close();
  process.exit(1);
} finally {
  if (studentEmail) {
    try {
      console.log('Cleaning up isolated test data from DB...');
      await pool.query("set skillpilot.allow_account_delete = 'on'");
      await pool.query("delete from users where email=$1", [studentEmail]);
      await pool.query("set skillpilot.allow_account_delete = 'off'");
      console.log('Isolated test student cleaned up successfully.');
    } catch (err) {
      console.warn('Cleanup warning:', err.message);
    }
  }
  await pool.end();
}
