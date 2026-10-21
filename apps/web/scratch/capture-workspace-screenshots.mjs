import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.API_URL || 'http://localhost:3003';
const outDir = 'c:/Users/Dhanush S Poojary/Downloads/SkillPilot/skillpilot-final/apps/web/scratch';

console.log('=== CAPTURING WORKSPACE SCREENSHOTS ===');

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('skillpilot_cinematic_seen', 'true'); } catch {}
  });

  const page = await context.newPage();

  // Create a student account
  const stamp = Date.now();
  const studentEmail = `visual_student_${stamp}@e2e.test`;
  const password = 'Verify-Secure-Password-123';

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Create account")');
  await page.fill('label:has-text("Name") input', 'Alex Mercer');
  await page.fill('label:has-text("Email") input', studentEmail);
  await page.fill('label:has-text("Password") input', password);
  await page.click('button.primary.auth-submit');

  await page.waitForSelector('.welcome, #main-content', { timeout: 15000 });

  // Dismiss onboarding modal if present
  try {
    await page.waitForSelector('.onboarding-modal', { timeout: 3000 });
    const switchBtn = page.locator('button:has-text("Switch to Quick Form")');
    if (await switchBtn.isVisible()) {
      await switchBtn.click();
      await page.waitForTimeout(300);
    }
    const saveSetupBtn = page.locator('button.submit-setup-btn, button:has-text("Save & Continue to Diagnostic")').first();
    if (await saveSetupBtn.isVisible()) {
      await saveSetupBtn.click();
      await page.waitForSelector('.onboarding-modal', { state: 'detached', timeout: 8000 });
    }
  } catch {}

  // 1. Student Workspace: Today View
  console.log('1. Capturing Student Workspace Today View...');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/06-student-today-view.png` });

  // 2. Student Workspace: Roadmap View
  console.log('2. Capturing Student Workspace Roadmap View...');
  await page.click('button.nav-item:has-text("Roadmap")');
  await page.waitForSelector('.roadmap-hierarchy-strip, .roadmap-list', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/07-student-roadmap-view.png` });

  // 3. Student Workspace: Skill Passport View
  console.log('3. Capturing Student Workspace Passport View...');
  await page.click('button.nav-item:has-text("Passport")');
  await page.waitForSelector('.passport, .proof-list', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/08-student-passport-view.png` });

  await context.close();
} catch (err) {
  console.error('Error during workspace capture:', err);
} finally {
  await browser.close();
}
console.log('=== WORKSPACE SCREENSHOTS CAPTURED ===');
