import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/cab808ac-15ac-4ba0-973c-986b08bd8096');

async function captureOnboarding() {
  console.log('Capturing adaptive onboarding screenshots...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('skillpilot_cinematic_seen', 'true');
      localStorage.setItem('skillpilot_sidebar_collapsed', 'false');
    } catch {}
  });
  const page = await context.newPage();
  page.on('console', (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', (err) => console.log('[Browser Error]:', err.message));
  page.on('request', (req) => {
    if (req.url().includes('/api/')) console.log(`[Request]: ${req.method()} ${req.url()}`);
  });
  page.on('response', (res) => {
    if (res.url().includes('/api/')) console.log(`[Response]: ${res.status()} ${res.url()}`);
  });

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

  // Sign in or register if needed
  const authTab = page.locator('.auth-tabs button', { hasText: 'Create account' });
  if (await authTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Registering student for onboarding test...');
    const testEmail = `onboard_diag_${Date.now()}@skillpilot.test`;
    await authTab.click();
    await page.waitForTimeout(200);
    await page.fill('label:has-text("Name") input', 'Sam Onboarding');
    await page.fill('label:has-text("Email") input', testEmail);
    await page.fill('label:has-text("Password") input', 'OnboardPass123!');
    await page.click('button.primary.auth-submit');
    await page.waitForSelector('.welcome, #main-content', { timeout: 15000 });
  }

  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.waitForTimeout(800);

  // Check if onboarding modal is already open
  let modal = page.locator('.onboarding-modal');
  let isModalVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);

  if (!isModalVisible) {
    console.log('Clicking Calibrate background button on Today dashboard...');
    const calibBtn = page.locator('button.calibrate-btn, button:has-text("Calibrate background")').first();
    await calibBtn.waitFor({ state: 'visible', timeout: 8000 });
    await calibBtn.click();
    await page.waitForSelector('.onboarding-modal', { timeout: 8000 });
  }

  console.log('Switching to Tab 2: Technical Diagnostic...');
  const diagTab = page.locator('button:has-text("2. Technical Diagnostic")');
  await diagTab.waitFor({ state: 'visible', timeout: 5000 });
  await diagTab.click();

  console.log('Waiting for active technical question...');
  await page.waitForSelector('.adaptive-assessment-container, textarea', { timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log('Capturing: adaptive_onboarding_question.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'adaptive_onboarding_question.png'), fullPage: false });

  console.log('Submitting technical answer...');
  const textarea = page.locator('.adaptive-assessment-container textarea');
  await textarea.click();
  await textarea.fill('An array is stored in contiguous memory providing O(1) index access, whereas a linked list uses nodes connected by pointers allowing efficient O(1) prepends but requiring O(N) linear time to access arbitrary elements.');
  await page.waitForTimeout(500);

  const submitBtn = page.locator('.adaptive-assessment-container button[type="submit"]');
  console.log('Submit button disabled?', await submitBtn.getAttribute('disabled'));
  await submitBtn.click({ force: true });

  console.log('Waiting for evaluation results...');
  await page.waitForSelector('.adaptive-assessment-container span:has-text("CORRECT"), .adaptive-assessment-container span:has-text("PARTIAL"), .adaptive-assessment-container span:has-text("INCORRECT"), .adaptive-assessment-container b:has-text("ACTIVE QUESTION")', { timeout: 75000 });
  await page.waitForTimeout(1500);

  console.log('Capturing: adaptive_onboarding_evaluation.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'adaptive_onboarding_evaluation.png'), fullPage: false });

  await browser.close();
  console.log('Onboarding screenshots captured successfully!');
}

captureOnboarding().catch((err) => {
  console.error('Onboarding capture failed:', err);
  process.exit(1);
});
