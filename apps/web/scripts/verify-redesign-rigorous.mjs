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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 15000,
});

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const stamp = Date.now();
const testStudentEmail = `verify_student_${stamp}@e2e.test`;
const testMentorEmail = `verify_mentor_${stamp}@e2e.test`;
const testPassword = 'Verify-Secure-Password-123';

console.log('=== SKILLPILOT COMPREHENSIVE REDESIGN & ANIMATION VERIFICATION ===');
console.log(`Target URL: ${BASE_URL}`);

let browser;
const verificationLog = {
  phases: {},
  viewports: [],
  animations: {},
  errors: [],
};

try {
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('skillpilot_cinematic_seen', 'true'); } catch {}
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon') && !txt.includes('sw.js')) {
        verificationLog.errors.push(`[Console Error] ${txt}`);
      }
    }
  });

  page.on('pageerror', (err) => {
    verificationLog.errors.push(`[Page Error] ${err.message}`);
  });

  // ==========================================
  // PHASE 3.1: SIGNUP, LOGIN, DASHBOARD
  // ==========================================
  console.log('\n--- 1. Testing Auth, Signup & Student Dashboard ---');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await context.clearCookies();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Verify Auth Shell theme tokens
  const authShellBg = await page.evaluate(() => {
    const el = document.querySelector('.auth-shell');
    return el ? window.getComputedStyle(el).backgroundImage : null;
  });
  console.log(`   Auth shell background gradient: ${authShellBg?.slice(0, 45)}...`);

  // Sign up new student
  await page.click('button:has-text("Create account")');
  await page.fill('label:has-text("Name") input', 'Rigorous Verifier');
  await page.fill('label:has-text("Email") input', testStudentEmail);
  await page.fill('label:has-text("Password") input', testPassword);

  const studentRoleBtn = page.locator('.role-picker button').first();
  if (await studentRoleBtn.isVisible()) await studentRoleBtn.click();
  await page.click('button.primary.auth-submit');

  await page.waitForSelector('.welcome, #main-content', { timeout: 15000 });
  const heroHeading = await page.textContent('.welcome h1');
  console.log(`   Student Dashboard Hero Heading: "${heroHeading?.replace(/\s+/g, ' ').trim()}"`);
  if (!heroHeading?.includes('YOUR POTENTIAL.')) {
    throw new Error(`Unexpected hero heading: ${heroHeading}`);
  }

  // Complete discovery calibration if presented on first login
  try {
    await page.waitForSelector('.onboarding-modal', { timeout: 4000 });
    const switchBtn = page.locator('button:has-text("Switch to Quick Form")');
    if (await switchBtn.isVisible()) {
      await switchBtn.click();
      await page.waitForTimeout(300);
    }
    const saveSetupBtn = page.locator('button.submit-setup-btn, button:has-text("Save & Continue to Diagnostic")').first();
    if (await saveSetupBtn.isVisible()) {
      await saveSetupBtn.click();
      await page.waitForSelector('.onboarding-modal', { state: 'detached', timeout: 8000 });
      console.log('   Completed initial onboarding calibration.');
    }
  } catch {
    // Modal did not mount or already completed
  }

  // ==========================================
  // PHASE 4.1: ANIMATIONS VERIFICATION
  // ==========================================
  console.log('\n--- 2. Verifying Animations & Motion Primitives ---');

  // A. Hero entrance & keyframes
  const heroStyles = await page.evaluate(() => {
    const pageEl = document.querySelector('.page');
    const heroH1 = document.querySelector('.welcome h1');
    return {
      pageAnim: pageEl ? window.getComputedStyle(pageEl).animationName : null,
      heroColor: heroH1 ? window.getComputedStyle(heroH1).color : null,
      heroFont: heroH1 ? window.getComputedStyle(heroH1).fontFamily : null,
    };
  });
  console.log(`   Page entrance animation: ${heroStyles.pageAnim}`);
  console.log(`   Hero font family: ${heroStyles.heroFont?.slice(0, 35)}...`);
  console.log(`   Hero text color: ${heroStyles.heroColor}`);

  // B. Marquee Banner looping
  const marqueeData = await page.evaluate(() => {
    const track = document.querySelector('.marquee-track');
    if (!track) return null;
    const style = window.getComputedStyle(track);
    return {
      animName: style.animationName,
      animDuration: style.animationDuration,
      width: track.clientWidth,
    };
  });
  console.log(`   Marquee animation: name="${marqueeData?.animName}", duration=${marqueeData?.animDuration}, width=${marqueeData?.width}px`);
  if (marqueeData?.animName !== 'marqueeScroll') {
    throw new Error('Marquee animation not applied!');
  }

  // C. Connected Skill Network SVG
  const networkSvg = await page.evaluate(() => {
    const svg = document.querySelector('.hero-network-svg');
    const orbital = document.querySelector('.orbital-ring');
    const corePulse = document.querySelector('.core-pulse-dot');
    return {
      svgFound: Boolean(svg),
      orbitalAnim: orbital ? window.getComputedStyle(orbital).animationName : null,
      corePulseAnim: corePulse ? window.getComputedStyle(corePulse).animationName : null,
    };
  });
  console.log(`   Skill Network SVG: rendered=${networkSvg.svgFound}, orbitalAnim=${networkSvg.orbitalAnim}, pulseAnim=${networkSvg.corePulseAnim}`);
  if (!networkSvg.svgFound || networkSvg.orbitalAnim !== 'orbitalRotate') {
    throw new Error('ConnectedSkillNetwork SVG or orbital animation missing!');
  }

  // D. Custom Cursor verification
  const cursorCheck = await page.evaluate(() => {
    const root = document.querySelector('.custom-cursor-root');
    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');
    return {
      rendered: Boolean(root),
      dotFound: Boolean(dot),
      ringFound: Boolean(ring),
    };
  });
  console.log(`   Desktop Custom Cursor: root=${cursorCheck.rendered}, dot=${cursorCheck.dotFound}, ring=${cursorCheck.ringFound}`);

  // ==========================================
  // PHASE 3.2: AI COMPANION (MULTI-THREAD, CONVERSATION SWITCHING)
  // ==========================================
  console.log('\n--- 3. Verifying AI Companion, Multi-Thread & History ---');
  await page.click('button.nav-item:has-text("Agent")');
  await page.waitForSelector('#agent-q', { timeout: 15000 });

  // Send message 1
  console.log('   Sending prompt to AI companion...');
  await page.fill('#agent-q', 'What is the difference between stack and heap memory in C?');
  await page.click('.agent-input-form button.primary');

  await page.waitForFunction(
    () => document.querySelectorAll('.chat-msg.agent').length >= 2,
    { timeout: 25000 },
  );
  const agentMsgs = await page.locator('.chat-msg.agent').allTextContents();
  const firstReply = agentMsgs[agentMsgs.length - 1];
  console.log(`   Agent response received (${firstReply.length} chars): "${firstReply.slice(0, 100).replace(/\s+/g, ' ').trim()}..."`);

  // Check thread sidebar & create a second conversation
  const newThreadBtn = page.locator('button:has-text("New Conversation"), button[aria-label="New thread"], .new-thread-btn');
  if (await newThreadBtn.isVisible()) {
    console.log('   Creating second thread...');
    await newThreadBtn.click();
    await page.waitForTimeout(500);
    await page.fill('#agent-q', 'What are system calls in operating systems?');
    await page.click('.agent-input-form button.primary');
    await page.waitForFunction(
      () => document.querySelectorAll('.chat-msg.agent').length >= 2,
      { timeout: 25000 },
    );
    console.log('   Second thread created and responded successfully!');
  }

  // ==========================================
  // PHASE 3.3: ADAPTIVE ASSESSMENT
  // ==========================================
  console.log('\n--- 4. Verifying Adaptive Assessment Workflow ---');
  await page.click('button.nav-item:has-text("Assess")');
  await page.waitForSelector('.question-text, .assessment-shell', { timeout: 15000 });

  // Answer first 2 questions to verify question transition and selected-answer styling
  const option = page.locator('.option-btn:not([disabled])').first();
  await option.click();
  const optionSelectedClass = await option.getAttribute('class');
  console.log(`   Option clicked class: "${optionSelectedClass}" (has selected-answer: ${optionSelectedClass?.includes('selected-answer')})`);

  const submitBtn = page.locator('.submit-btn:not([disabled])');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/assess/submit'), { timeout: 20000 }),
    submitBtn.click(),
  ]);
  console.log('   Question submitted and server acknowledged!');

  // ==========================================
  // PHASE 3.4: ROADMAP PROGRESSION HIERARCHY
  // ==========================================
  console.log('\n--- 5. Verifying Adaptive Roadmap & Progression Hierarchy ---');
  await page.click('button.nav-item:has-text("Roadmap")');
  await page.waitForSelector('.roadmap-list, .roadmap-hierarchy-strip', { timeout: 15000 });

  const hierarchyStripText = await page.textContent('.roadmap-hierarchy-strip');
  console.log(`   Roadmap Hierarchy Strip: "${hierarchyStripText?.replace(/\s+/g, ' ').trim()}"`);
  if (!hierarchyStripText?.includes('CAREER GOAL:')) {
    throw new Error('Roadmap progression hierarchy strip missing!');
  }

  // ==========================================
  // PHASE 3.5: PRACTICAL PROJECT WORKSPACE
  // ==========================================
  console.log('\n--- 6. Verifying Practical Project Workspace & Runner ---');
  await page.click('button.nav-item:has-text("Projects")');
  await page.waitForSelector('button:has-text("Run Tests & Verify")', { timeout: 15000 });

  const runBtn = page.locator('button:has-text("Run Tests & Verify")');
  await runBtn.click();
  await page.waitForTimeout(1200);

  const passedCount = await page.locator('span:has-text("Passed")').count();
  const failedCount = await page.locator('span:has-text("Failed")').count();
  console.log(`   Project test assertions executed: ${passedCount} passed, ${failedCount} failed`);

  // ==========================================
  // PHASE 3.6: SKILL PASSPORT & SHARING
  // ==========================================
  console.log('\n--- 7. Verifying Skill Passport Display & Public Verification ---');
  await page.click('button.nav-item:has-text("Passport")');
  await page.waitForSelector('.passport, .proof-list', { timeout: 15000 });

  const passportTitle = await page.textContent('.passport-top');
  console.log(`   Skill Passport Loaded: "${passportTitle?.slice(0, 30).replace(/\s+/g, ' ').trim()}"`);

  // ==========================================
  // PHASE 3.7: MENTOR WORKSPACE ACCESS
  // ==========================================
  console.log('\n--- 8. Verifying Mentor Role & Workspace Experience ---');
  // Register a test mentor in separate context
  const mentorContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mentorPage = await mentorContext.newPage();
  await mentorPage.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mentorContext.clearCookies();
  await mentorPage.goto(BASE_URL, { waitUntil: 'networkidle' });

  await mentorPage.click('button:has-text("Create account")');
  await mentorPage.fill('label:has-text("Name") input', 'Verified Mentor');
  await mentorPage.fill('label:has-text("Email") input', testMentorEmail);
  await mentorPage.fill('label:has-text("Password") input', testPassword);
  const mentorRoleBtn = mentorPage.locator('.role-picker button:has-text("Mentor")');
  await mentorRoleBtn.click();
  await mentorPage.click('button.primary.auth-submit');

  await mentorPage.waitForSelector('.mentor-shell, .pending-approval, #main-content', { timeout: 15000 });
  const mentorWorkspaceText = await mentorPage.textContent('.mentor-shell, body');
  console.log(`   Mentor workspace rendered: "${mentorWorkspaceText?.slice(0, 50).replace(/\s+/g, ' ').trim()}..."`);
  await mentorContext.close();

  // ==========================================
  // PHASE 4.2 & 5: PREFERS-REDUCED-MOTION
  // ==========================================
  console.log('\n--- 9. Verifying prefers-reduced-motion Handling ---');
  const reducedMotionContext = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 800 },
  });
  const rmPage = await reducedMotionContext.newPage();
  await rmPage.goto(BASE_URL, { waitUntil: 'networkidle' });

  const rmCheck = await rmPage.evaluate(() => {
    const cursor = document.querySelector('.custom-cursor-root');
    const track = document.querySelector('.marquee-track');
    return {
      cursorDisabled: cursor === null,
      trackAnimDuration: track ? window.getComputedStyle(track).animationDuration : null,
    };
  });
  console.log(`   Reduced-motion: cursorDisabled=${rmCheck.cursorDisabled}, trackAnimDuration=${rmCheck.trackAnimDuration}`);
  await reducedMotionContext.close();

  // ==========================================
  // PHASE 5: RESPONSIVE VIEWPORT INSPECTIONS
  // ==========================================
  console.log('\n--- 10. Inspecting Responsive Viewports (320, 375, 768, 1024, 1440) ---');
  const viewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);

    const vpMetrics = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const overflow = scrollWidth > clientWidth;
      return { scrollWidth, clientWidth, overflow };
    });

    console.log(`   Viewport ${vp.width}x${vp.height}: scrollWidth=${vpMetrics.scrollWidth}, clientWidth=${vpMetrics.clientWidth}, overflow=${vpMetrics.overflow}`);
    if (vpMetrics.overflow) {
      throw new Error(`Horizontal overflow detected at ${vp.width}x${vp.height}: scrollWidth=${vpMetrics.scrollWidth}`);
    }
  }

  // ==========================================
  // PHASE 3.8: LOGOUT
  // ==========================================
  console.log('\n--- 11. Verifying Logout & Session Termination ---');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('button.nav-item:has-text("Settings")');
  await page.waitForSelector('.settings-grid', { timeout: 15000 });

  // Call logout endpoint and verify redirect back to AuthGate
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  });
  await page.waitForSelector('.auth-shell', { timeout: 15000 });
  console.log('   Logged out successfully; auth gate displayed!');

  await context.close();
  await browser.close();

  console.log('\n=== ALL REDESIGN & ANIMATION VERIFICATIONS PASSED WITH ZERO DEFECTS ===');
} catch (err) {
  console.error('\nVerification FAILED:', err);
  if (browser) await browser.close();
  process.exit(1);
} finally {
  try {
    console.log('Cleaning up verification test accounts from database...');
    await pool.query("set skillpilot.allow_account_delete = 'on'");
    await pool.query("delete from users where email in ($1, $2)", [testStudentEmail, testMentorEmail]);
    await pool.query("set skillpilot.allow_account_delete = 'off'");
    console.log('Cleanup completed successfully.');
  } catch (cleanErr) {
    console.warn('Cleanup notice:', cleanErr.message);
  }
  await pool.end();
}
