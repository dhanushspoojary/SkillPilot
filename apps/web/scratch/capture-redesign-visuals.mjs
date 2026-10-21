import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.API_URL || 'http://localhost:3003';
const outDir = 'c:/Users/Dhanush S Poojary/Downloads/SkillPilot/skillpilot-final/apps/web/scratch';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('=== CAPTURING VISUAL SCREENSHOTS OF REDESIGN ===');

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 1. Landing Page Top / Hero
  console.log('1. Capturing Landing Page Hero...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${outDir}/01-landing-hero.png` });

  // 2. Landing Page Lime Feature Section
  console.log('2. Capturing Vibrant Lime Feature Section...');
  const limeSection = page.locator('#spotlight');
  if (await limeSection.isVisible()) {
    await limeSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/02-landing-lime-spotlight.png` });
  }

  // 3. Landing Page Roadmap & Dual Section
  console.log('3. Capturing Roadmap & AI Mentorship Highlights...');
  const roadmapSection = page.locator('#roadmap');
  if (await roadmapSection.isVisible()) {
    await roadmapSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/03-landing-roadmap-mentorship.png` });
  }

  // 4. Landing Page Auth Station
  console.log('4. Capturing Landing Auth Station...');
  const authStation = page.locator('#auth-station');
  if (await authStation.isVisible()) {
    await authStation.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/04-landing-auth-station.png` });
  }

  // 5. Full page screenshot of landing
  console.log('5. Capturing Full Landing Page...');
  await page.screenshot({ path: `${outDir}/05-landing-full-page.png`, fullPage: true });

  await context.close();
} catch (err) {
  console.error('Screenshot error:', err);
} finally {
  await browser.close();
}
console.log('=== SCREENSHOTS CAPTURED SUCCESSFULLY ===');
