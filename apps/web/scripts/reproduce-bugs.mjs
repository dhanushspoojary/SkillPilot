import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

// Load .env.local
const envPath = fs.existsSync(path.resolve(process.cwd(), '.env.local'))
  ? path.resolve(process.cwd(), '.env.local')
  : path.resolve(process.cwd(), 'apps/web/.env.local');

const env = fs.readFileSync(envPath, 'utf8');
const envVars = {};
for (const line of env.split(/\r?\n/)) {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
}

const pool = new pg.Pool({ connectionString: envVars.DATABASE_URL });

async function findActivePort() {
  for (const port of [3003, 3000, 3001, 3002]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) {
        console.log(`✓ Active Next.js server detected on port ${port}`);
        return port;
      }
    } catch {}
  }
  return 3003;
}

async function main() {
  const port = await findActivePort();
  const BASE_URL = `http://localhost:${port}`;
  console.log(`Using target BASE_URL: ${BASE_URL}`);

  const stamp = Date.now();
  const mentorId = randomUUID();
  const mentorEmail = `repro-mentor-${stamp}@test.local`;
  const studentId = randomUUID();
  const studentEmail = `repro-student-${stamp}@test.local`;
  const password = 'Password123456!';
  const pwHash = await bcrypt.hash(password, 10);

  let browser;

  try {
    console.log('\n[1] Creating test mentor and student in DB...');
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, role, status)
       VALUES ($1, $2, $3, 'Test Mentor User', 'mentor', 'active'),
              ($4, $5, $3, 'Test Student User', 'student', 'active')`,
      [mentorId, mentorEmail, pwHash, studentId, studentEmail]
    );

    await pool.query(
      `INSERT INTO mentor_profiles (user_id, bio, focus, status)
       VALUES ($1, 'A dedicated mentor for bug reproduction.', 'React & Fullstack', 'pending')`,
      [mentorId]
    );

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // ------------------------------------------------------------------
    // TEST 1: INSPECT MENTOR DASHBOARD VISUALS
    // ------------------------------------------------------------------
    console.log('\n[2] Logging in as Mentor to inspect MentorWorkspace visuals...');
    const mentorContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const mentorPage = await mentorContext.newPage();
    
    // Capture console errors
    const mentorErrors = [];
    mentorPage.on('console', msg => {
      if (msg.type() === 'error') mentorErrors.push(msg.text());
    });
    mentorPage.on('pageerror', err => mentorErrors.push(err.message));

    await mentorPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await mentorPage.fill('input[type="email"]', mentorEmail);
    await mentorPage.fill('input[type="password"]', password);
    await mentorPage.click('button.primary.auth-submit');

    await mentorPage.waitForSelector('.workspace, #main-content', { timeout: 10000 });
    console.log('✓ Mentor workspace loaded');

    // Inspect input computed styles
    const inputStyles = await mentorPage.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('.mentor-profile-form input, .mentor-profile-form textarea'));
      return inputs.map((el, idx) => {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          placeholder: el.placeholder,
          value: el.value,
          backgroundColor: style.backgroundColor,
          color: style.color,
          border: style.border,
          width: style.width,
          height: style.height,
        };
      });
    });

    console.log('\nMentor profile form input computed styles:');
    console.log(JSON.stringify(inputStyles, null, 2));

    await mentorPage.screenshot({ path: 'apps/web/scratch/mentor-workspace-before.png', fullPage: true });
    console.log('✓ Screenshot saved to apps/web/scratch/mentor-workspace-before.png');

    await mentorContext.close();

    // ------------------------------------------------------------------
    // TEST 2: REPRODUCE STUDENT NEXT-BUTTON BUG
    // ------------------------------------------------------------------
    console.log('\n[3] Logging in as Student to test Next button and assessment progression...');
    const studentContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const studentPage = await studentContext.newPage();

    const studentErrors = [];
    studentPage.on('console', msg => {
      if (msg.type() === 'error') studentErrors.push(msg.text());
    });
    studentPage.on('pageerror', err => studentErrors.push(err.message));

    await studentPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await studentPage.fill('input[type="email"]', studentEmail);
    await studentPage.fill('input[type="password"]', password);
    await studentPage.click('button.primary.auth-submit');

    await studentPage.waitForSelector('.app-shell, #main-content', { timeout: 10000 });
    console.log('✓ Student app-shell loaded');

    // If onboarding modal appears, dismiss or complete it
    const modal = studentPage.locator('.onboarding-modal, [role="dialog"]');
    if (await modal.count() > 0 && await modal.isVisible()) {
      console.log('   Onboarding modal visible, dismissing...');
      const closeBtn = studentPage.locator('button[aria-label="Close"], button:has-text("Skip")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }

    // Navigate to Assess
    console.log('   Navigating to Assess view...');
    await studentPage.click('button.nav-item:has-text("Assess")');
    await studentPage.waitForSelector('.assessment-shell', { timeout: 10000 });
    console.log('✓ Assessment view loaded');

    // Test answering questions sequentially
    for (let qNum = 1; qNum <= 6; qNum++) {
      console.log(`\n--- Answering Question ${qNum} ---`);
      
      // Wait for options to be present
      await studentPage.waitForSelector('.option-btn', { timeout: 8000 });
      const qText = await studentPage.textContent('.question-text');
      console.log(`   Question: "${qText?.slice(0, 60)}..."`);

      const options = studentPage.locator('.option-btn:not([disabled])');
      const optCount = await options.count();
      console.log(`   Enabled options count: ${optCount}`);

      if (optCount === 0) {
        console.error('✗ ERROR: All options are disabled!');
        break;
      }

      // Check Next button state before picking option
      const submitBtn = studentPage.locator('.submit-btn');
      const isDisabledBefore = await submitBtn.isDisabled();
      console.log(`   Next button disabled before selection: ${isDisabledBefore}`);

      // Pick option 1
      await options.first().click();
      await studentPage.waitForTimeout(200);

      const isDisabledAfter = await submitBtn.isDisabled();
      const btnText = await submitBtn.textContent();
      console.log(`   Next button text: "${btnText?.trim()}", disabled after selection: ${isDisabledAfter}`);

      if (isDisabledAfter) {
        console.error('✗ BUG REPRODUCED: Next button is STILL DISABLED after selecting an option!');
      }

      // Click Next
      console.log('   Clicking Next button...');
      const [res] = await Promise.all([
        studentPage.waitForResponse(r => r.url().includes('/api/assess/submit'), { timeout: 10000 }),
        submitBtn.click(),
      ]);

      const resStatus = res.status();
      const resJson = await res.json().catch(() => ({}));
      console.log(`   Submit response: status=${resStatus}, done=${resJson.done}, error=${resJson.error}`);

      if (resJson.done) {
        console.log('✓ Assessment complete signal received!');
        break;
      }

      // Wait a moment for UI to update to next question
      await studentPage.waitForTimeout(1000);

      // Check if button is stuck or if new question loaded
      const isStillBusy = await studentPage.locator('.submit-btn .spin').count() > 0;
      console.log(`   Button spinner active after 1s: ${isStillBusy}`);
    }

    if (studentErrors.length > 0) {
      console.log('\nStudent console/page errors detected:');
      console.log(studentErrors);
    }

    await studentContext.close();

  } finally {
    if (browser) await browser.close();
    console.log('\nCleaning up DB records...');
    try {
      await pool.query(`DELETE FROM assessment_items WHERE assessment_id IN (SELECT id FROM assessments WHERE user_id = $1)`, [studentId]);
      await pool.query(`DELETE FROM assessments WHERE user_id = $1`, [studentId]);
      await pool.query(`DELETE FROM mentor_profiles WHERE user_id = $1`, [mentorId]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [mentorId, studentId]);
      await pool.end();
      console.log('✓ Cleanup complete');
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
  }
}

main().catch(err => {
  console.error('Reproduction script failed:', err);
  process.exit(1);
});
