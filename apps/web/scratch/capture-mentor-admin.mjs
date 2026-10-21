import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.API_URL || 'http://localhost:3003';
const outDir = 'c:/Users/Dhanush S Poojary/Downloads/SkillPilot/skillpilot-final/apps/web/scratch';

console.log('=== CAPTURING MENTOR & ADMIN WORKSPACES ===');

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // 1. Mentor Workspace
  console.log('1. Signing up a Mentor...');
  const stamp = Date.now();
  const mentorEmail = `mentor_vis_${stamp}@e2e.test`;
  const password = 'Verify-Secure-Password-123';

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Create account")');
  await page.fill('label:has-text("Name") input', 'Dr. Elena Rostova');
  await page.fill('label:has-text("Email") input', mentorEmail);
  await page.fill('label:has-text("Password") input', password);
  await page.click('.role-picker button:has-text("Mentor")');
  await page.click('button.primary.auth-submit');

  await page.waitForSelector('.workspace, .workspace-page, #main-content', { timeout: 15000 });
  await page.waitForTimeout(1000);
  console.log('2. Capturing Mentor Workspace...');
  await page.screenshot({ path: `${outDir}/09-mentor-workspace.png` });

  await context.close();
} catch (err) {
  console.error('Error during mentor capture:', err);
} finally {
  await browser.close();
}
console.log('=== MENTOR WORKSPACE CAPTURED ===');
