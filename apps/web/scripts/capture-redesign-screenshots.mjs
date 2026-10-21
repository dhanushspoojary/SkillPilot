import { chromium } from 'playwright';
import path from 'node:path';

async function detectActiveBaseUrl() {
  if (process.env.API_URL) return process.env.API_URL;
  for (const port of [3000, 3003, 3001, 3002]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) return `http://localhost:${port}`;
    } catch {}
  }
  return 'http://localhost:3000';
}
const BASE_URL = await detectActiveBaseUrl();
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/df4a9773-11d5-40c8-b581-bbff2f7f2d2f');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  try { sessionStorage.setItem('skillpilot_cinematic_seen', 'true'); } catch {}
});
const page = await context.newPage();

try {
  // 1. Landing Page
  console.log('Capturing Landing Page...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesign_landing_hero.png'), fullPage: false });

  // 2. Register fresh student to capture Student Dashboard
  const testEmail = `screenshot_student_${Date.now()}@e2e.test`;
  const tab = page.locator('.auth-tabs button', { hasText: 'Create account' });
  await tab.click();
  await page.waitForTimeout(200);
  await page.fill('label:has-text("Name") input', 'Devin Chen');
  await page.fill('label:has-text("Email") input', testEmail);
  await page.fill('label:has-text("Password") input', 'SecureStudentPass123!');
  await page.click('button.primary.auth-submit');

  await page.waitForSelector('.welcome, #main-content', { timeout: 15000 });
  await page.waitForTimeout(500);

  // If onboarding modal appears, complete it
  try {
    const switchBtn = page.locator('button:has-text("Switch to Quick Form")');
    if (await switchBtn.isVisible({ timeout: 2000 })) {
      await switchBtn.click();
      await page.waitForTimeout(200);
      const saveBtn = page.locator('button.submit-setup-btn, button:has-text("Save & Continue to Diagnostic")').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForSelector('.onboarding-modal', { state: 'detached', timeout: 5000 });
      }
    }
  } catch {}

  // Scroll to very top of dashboard
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  console.log('Capturing Student Dashboard (top view with Next Action)...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesign_student_dashboard.png'), fullPage: false });

  // 3. Capture Practice Arena
  console.log('Capturing Practice Arena...');
  await page.click('button.nav-item:has-text("Practice")');
  await page.waitForSelector('.practice-arena-shell, .problem-detail-card', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesign_practice_arena.png'), fullPage: false });

  // 4. Capture Assessment with options loaded
  console.log('Capturing Assessment with Question...');
  await page.click('button.nav-item:has-text("Assess")');
  await page.waitForSelector('.option-btn', { timeout: 25000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesign_assessment_view.png'), fullPage: false });

  // 5. Capture Roadmap
  console.log('Capturing Roadmap...');
  await page.click('button.nav-item:has-text("Roadmap")');
  await page.waitForSelector('.roadmap-list, .roadmap-hierarchy-strip', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesign_roadmap_view.png'), fullPage: false });

  // 6. Capture Passport
  console.log('Capturing Passport...');
  await page.click('button.nav-item:has-text("Passport")');
  await page.waitForSelector('.passport, .proof-list', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'redesign_passport_view.png'), fullPage: false });

  // 5. Capture Mentor Workspace in second context
  console.log('Capturing Mentor Workspace...');
  const mentorCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mentorPage = await mentorCtx.newPage();
  await mentorPage.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mentorPage.locator('.auth-tabs button', { hasText: 'Create account' }).click();
  await mentorPage.waitForTimeout(200);
  await mentorPage.fill('label:has-text("Name") input', 'Dr. Sarah Vance');
  await mentorPage.fill('label:has-text("Email") input', `mentor_screenshot_${Date.now()}@e2e.test`);
  await mentorPage.fill('label:has-text("Password") input', 'SecureMentorPass123!');
  await mentorPage.locator('.role-picker button:has-text("Mentor")').click();
  await mentorPage.click('button.primary.auth-submit');
  await mentorPage.waitForSelector('.workspace', { timeout: 15000 });
  await mentorPage.waitForTimeout(400);
  await mentorPage.screenshot({ path: path.join(ARTIFACT_DIR, 'redesign_mentor_workspace.png'), fullPage: false });
  await mentorCtx.close();

  console.log('All comprehensive screenshots captured!');
} catch (err) {
  console.error('Screenshot error:', err);
} finally {
  await browser.close();
}
