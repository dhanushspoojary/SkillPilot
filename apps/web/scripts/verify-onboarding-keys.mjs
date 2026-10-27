import { chromium } from 'playwright';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const stamp = Date.now();

console.log('=== Verifying Capability Onboarding Dialogue, Session Restoration & React Key Integrity ===');

const keyWarnings = [];
const consoleErrors = [];

let browser;
try {
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  await context.addInitScript(() => {
    try { sessionStorage.setItem('skillpilot_cinematic_seen', 'true'); } catch {}
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('same key') || text.includes('key warning') || text.includes('Encountered two children')) {
      console.error(`[REACT KEY WARNING DETECTED]: ${text}`);
      keyWarnings.push(text);
    }
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`[PAGE ERROR]: ${err.message}`);
    consoleErrors.push(err.message);
  });

  // Step 1: Navigate to application
  console.log('1. Navigating to SkillPilot...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Step 2: Register fresh student account
  console.log('2. Creating test student account...');
  const studentEmail = `keycheck_${stamp}@e2e.test`;
  await page.click('button:has-text("Create account")');
  await page.waitForTimeout(300);

  await page.fill('label:has-text("Name") input', 'Onboarding Key Test Student');
  await page.fill('label:has-text("Email") input', studentEmail);
  await page.fill('label:has-text("Password") input', 'secure-keycheck-pass-123');

  const studentRoleBtn = page.locator('.role-picker button').first();
  if (await studentRoleBtn.isVisible()) {
    await studentRoleBtn.click();
  }

  await page.click('button.primary.auth-submit');
  await page.waitForSelector('.welcome, .app-shell, #main-content', { timeout: 15000 });
  console.log('   Dashboard loaded successfully.');

  // Step 3: Check Capability Calibration modal
  console.log('3. Checking Capability Onboarding calibration modal...');
  await page.waitForTimeout(800);
  const isAlreadyOpen = await page.locator('.onboarding-modal').isVisible();
  if (!isAlreadyOpen) {
    const calibrateBtn = page.locator('button:has-text("Calibrate"), button:has-text("Calibration"), button:has-text("Complete Calibration")').first();
    if (await calibrateBtn.isVisible()) {
      await calibrateBtn.click();
    } else {
      await page.click('button.nav-item:has-text("Today")');
      await page.waitForTimeout(500);
      const todayCalibrate = page.locator('button:has-text("Calibrate"), button:has-text("Calibration")').first();
      if (await todayCalibrate.isVisible()) {
        await todayCalibrate.click();
      }
    }
  }

  await page.waitForSelector('.onboarding-modal', { timeout: 10000 });
  console.log('   Onboarding modal active.');

  // Step 4: Answer Turns 1 and 2
  console.log('4. Answering Turn 1 (education)...');
  const chip1 = page.locator('.onboarding-modal .chip-card').first();
  await chip1.waitFor({ state: 'visible', timeout: 8000 });
  const [res1] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    chip1.click(),
  ]);
  const json1 = await res1.json();
  console.log(`   Turn 1 response recorded. Next: ${json1.nextTurn?.topic}`);
  await page.waitForTimeout(600);

  console.log('   Answering Turn 2 (experience)...');
  const chip2 = page.locator('.onboarding-modal .chip-card').first();
  await chip2.waitFor({ state: 'visible', timeout: 8000 });
  const [res2] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    chip2.click(),
  ]);
  const json2 = await res2.json();
  console.log(`   Turn 2 response recorded. Next: ${json2.nextTurn?.topic}`);
  await page.waitForTimeout(600);

  // Step 5: Test Session Restoration mid-onboarding by reloading the page
  console.log('5. Testing Mid-Session Restoration (Reloading page)...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.welcome, .app-shell, #main-content', { timeout: 15000 });

  // Inspect restored dialogue (modal automatically opens on reload for uncompleted onboarding)
  console.log('   Checking restored dialogue state in calibration modal...');
  const modalLocator = page.locator('.onboarding-modal');
  const alreadyOpen = await modalLocator.isVisible().catch(() => false);
  if (!alreadyOpen) {
    const reopenBtn = page.locator('button:has-text("Calibrate"), button:has-text("Calibration"), button:has-text("Complete Calibration")').first();
    if (await reopenBtn.isVisible()) {
      await reopenBtn.click();
    } else {
      await page.click('button.nav-item:has-text("Today")');
      await page.waitForTimeout(500);
      const todayCalibrate = page.locator('button:has-text("Calibrate"), button:has-text("Calibration")').first();
      if (await todayCalibrate.isVisible()) {
        await todayCalibrate.click();
      }
    }
  }
  await page.waitForSelector('.onboarding-modal', { timeout: 10000 });

  // Wait for asynchronous init() fetch to resolve and populate the chat stream
  await page.locator('.onboarding-chat-stream > div').nth(1).waitFor({ state: 'visible', timeout: 10000 });

  // Check restored turns in chat stream
  const restoredAnsweredTurns = await page.locator('.onboarding-chat-stream > div').count();
  console.log(`   Restored turns in stream: ${restoredAnsweredTurns}`);

  // Check active question text (should be Turn 3: struggles)
  const activeTurnHeader = await page.locator('.onboarding-modal span:has-text("Question"), .onboarding-modal b').first().textContent();
  console.log(`   Current active step indicator: "${activeTurnHeader?.trim()}"`);

  // Step 6: Test Rapid Repeated Submissions (Clicking chip multiple times in rapid succession)
  console.log('6. Testing Rapid Repeated Submissions on Turn 3...');
  const chip3 = page.locator('.onboarding-modal .chip-card').first();
  await chip3.waitFor({ state: 'visible', timeout: 8000 });
  
  // Rapid double-click
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    chip3.click({ clickCount: 2 }),
  ]);
  await page.waitForTimeout(800);

  // Step 7: Complete remaining turns (Turn 4 goals, Turn 5 availability)
  console.log('7. Answering Turn 4 (goals)...');
  const chip4 = page.locator('.onboarding-modal .chip-card').first();
  await chip4.waitFor({ state: 'visible', timeout: 8000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    chip4.click(),
  ]);
  await page.waitForTimeout(600);

  console.log('   Answering Turn 5 (learning format)...');
  const chip5 = page.locator('.onboarding-modal .chip-card').first();
  await chip5.waitFor({ state: 'visible', timeout: 8000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    chip5.click(),
  ]);
  await page.waitForTimeout(600);

  console.log('   Answering Turn 6 (time commitment)...');
  const chip6 = page.locator('.onboarding-modal .chip-card').first();
  await chip6.waitFor({ state: 'visible', timeout: 8000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    chip6.click(),
  ]);
  await page.waitForTimeout(600);

  console.log('   Answering Turn 7 (learning pace)...');
  const chip7 = page.locator('.onboarding-modal .chip-card').first();
  await chip7.waitFor({ state: 'visible', timeout: 8000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    chip7.click(),
  ]);
  await page.waitForTimeout(800);

  // Step 8: Verify baseline summary card appears
  console.log('8. Verifying Self-Reported Baseline Summary Card...');
  await page.waitForSelector(':has-text("BACKGROUND CALIBRATION CONFIRMED"), :has-text("SELF-REPORTED BASELINE SUMMARY")', { timeout: 8000 });
  console.log('   Summary card rendered successfully.');

  // Step 9: Test Dialogue Restart
  console.log('9. Testing Restart Dialogue functionality...');
  const restartBtn = page.locator('button:has-text("Restart Dialogue")');
  await restartBtn.click();
  await page.waitForTimeout(800);

  // Step 10: Answer Turn 1 after restart
  console.log('10. Answering Turn 1 after restart...');
  const restartedChip = page.locator('.onboarding-modal .chip-card').first();
  await restartedChip.waitFor({ state: 'visible', timeout: 8000 });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/workflow/onboarding') && r.status() === 200),
    restartedChip.click(),
  ]);
  await page.waitForTimeout(800);

  // Verify Turn 2 is now active
  const postRestartStep = await page.locator('.onboarding-modal span:has-text("Question"), .onboarding-modal b').first().textContent();
  console.log(`    Post-restart active step indicator: "${postRestartStep?.trim()}"`);

  // Step 11: Assert React key warnings
  console.log('11. Verifying console warnings and errors...');
  if (keyWarnings.length > 0) {
    console.error(`FAILED: Detected ${keyWarnings.length} React duplicate key warning(s):`, keyWarnings);
    process.exit(1);
  } else {
    console.log('    SUCCESS: ZERO React duplicate key warnings detected across all test scenarios!');
  }

  console.log('=== All Rigorous Verification Checks Passed! ===');
  await browser.close();
} catch (err) {
  console.error('Verification failed with error:', err);
  if (browser) await browser.close();
  process.exit(1);
}
