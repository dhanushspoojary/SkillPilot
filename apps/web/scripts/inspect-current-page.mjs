import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dhanush S Poojary/.gemini/antigravity-ide/brain/df4a9773-11d5-40c8-b581-bbff2f7f2d2f');

async function check() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'diagnostic_page_state.png'), fullPage: true });
  const title = await page.title();
  const url = page.url();
  const html = await page.content();
  console.log(`URL: ${url}`);
  console.log(`Title: ${title}`);
  console.log(`Has auth-tabs: ${html.includes('auth-tabs')}`);
  console.log(`Has nav-item: ${html.includes('nav-item')}`);
  console.log(`Has onboarding: ${html.includes('onboarding')}`);
  console.log(`Has assess: ${html.includes('assessment-shell')}`);
  await browser.close();
}

check().catch(console.error);
