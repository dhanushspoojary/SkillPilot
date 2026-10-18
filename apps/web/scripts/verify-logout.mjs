import pg from 'pg';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

if (!process.env.DATABASE_URL) {
  for (const f of ['.env.local', '../.env.local', '.env', '../.env']) {
    if (fs.existsSync(f)) {
      try { process.loadEnvFile(f); } catch {}
      if (process.env.DATABASE_URL) break;
    }
  }
}

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const ORIGIN = BASE_URL;
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 15000,
});

const q = async (sql, params = []) => (await pool.query(sql, params)).rows;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const check = (cond, msg) => {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
};

async function api(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  return { res, status: res.status, headers: res.headers, data };
}

console.log('=== SKILLPILOT LOGOUT & SESSION INVALIDATION REGRESSION SUITE ===');
console.log(`Target: ${BASE_URL}\n`);

const stamp = Date.now();
let browser;

try {
  // =========================================================================
  // TEST 1: Prefetch protection (GET /api/auth/logout must be rejected)
  // =========================================================================
  console.log('Test 1: Testing prefetch prevention on GET /api/auth/logout...');
  const getLogout = await api('/api/auth/logout', { method: 'GET' });
  check(getLogout.status === 405, `GET /api/auth/logout should return 405 Method Not Allowed, got ${getLogout.status}`);
  console.log('  ✔ GET /api/auth/logout correctly rejected with 405 Method Not Allowed\n');

  // =========================================================================
  // TEST 2: Student Login, DB Session Invalidation & Cookie Clearing
  // =========================================================================
  console.log('Test 2: Student session creation, DB record check, and secure logout...');
  const studentEmail = `logout-student-${stamp}@test.skillpilot`;
  const studentPassword = 'Secure-Student-Pass-123';
  const studentSignup = await api('/api/auth/signup', {
    method: 'POST',
    body: { email: studentEmail, name: 'Logout Student', password: studentPassword, role: 'student' }
  });
  check(studentSignup.status === 201, `Student signup failed: ${studentSignup.status}`);

  const rawSetCookie = studentSignup.headers.get('set-cookie');
  check(rawSetCookie && rawSetCookie.includes('skillpilot_session='), 'Signup response did not issue skillpilot_session cookie');
  const tokenMatch = rawSetCookie.match(/skillpilot_session=([^;]+)/);
  check(tokenMatch && tokenMatch[1], 'Could not extract session token from cookie header');
  const sessionTokenA = tokenMatch[1];
  const tokenHashA = hashToken(sessionTokenA);

  // Verify session exists in PostgreSQL
  const dbSessionsA = await q('select id, user_id, expires_at from sessions where token_hash=$1', [tokenHashA]);
  check(dbSessionsA.length === 1, 'Expected exactly 1 session row in DB for active session');
  const userId = dbSessionsA[0].user_id;
  console.log(`  ✔ Session verified in PostgreSQL database (user_id: ${userId})`);

  // Ensure test student has completed onboarding calibration
  await api('/api/profile', {
    method: 'PATCH',
    headers: { cookie: `skillpilot_session=${sessionTokenA}` },
    body: {
      careerGoal: 'Software Engineer',
      capabilityProfile: {
        educationLevel: 'third_year',
        programmingExperience: 'small_programs',
        careerInterests: ['Software Engineer'],
        weeklyHours: 10,
        onboardingCompleted: true,
      }
    }
  });

  // Verify authenticated endpoints work with this cookie
  const authHeadersA = { cookie: `skillpilot_session=${sessionTokenA}` };
  const meBefore = await api('/api/auth/me', { headers: authHeadersA });
  check(meBefore.status === 200 && meBefore.data.user?.email === studentEmail, 'Pre-logout /api/auth/me did not return user');
  const profileBefore = await api('/api/profile', { headers: authHeadersA });
  check(profileBefore.status === 200, 'Pre-logout /api/profile did not return 200');
  console.log('  ✔ Authenticated endpoints (/api/auth/me, /api/profile) accessible before logout');

  // Perform logout
  const logoutRes = await api('/api/auth/logout', { method: 'POST', headers: authHeadersA });
  check(logoutRes.status === 200, `POST /api/auth/logout failed with status ${logoutRes.status}`);
  check(logoutRes.data.ok === true, 'Logout response JSON missing { ok: true }');

  // Verify Set-Cookie header clears the cookie
  const logoutCookieHeader = logoutRes.headers.get('set-cookie') || '';
  check(logoutCookieHeader.includes('skillpilot_session='), 'Logout response missing Set-Cookie for skillpilot_session');
  check(
    logoutCookieHeader.toLowerCase().includes('max-age=0') || logoutCookieHeader.includes('1970'),
    'Logout Set-Cookie header must invalidate cookie with Max-Age=0 or expired date'
  );
  check(logoutCookieHeader.toLowerCase().includes('httponly'), 'Logout Set-Cookie must have HttpOnly flag');
  check(logoutCookieHeader.includes('path=/') || logoutCookieHeader.includes('Path=/'), 'Logout Set-Cookie must specify Path=/');
  console.log('  ✔ Cookie clearing header verified with HttpOnly, Path=/, and Max-Age=0');

  // Verify session row is deleted in PostgreSQL
  const dbSessionsAfter = await q('select id from sessions where token_hash=$1', [tokenHashA]);
  check(dbSessionsAfter.length === 0, 'Session row was NOT deleted from PostgreSQL sessions table');
  console.log('  ✔ Session row successfully deleted from PostgreSQL sessions table');

  // Verify subsequent requests with old session cookie are rejected
  const meAfter = await api('/api/auth/me', { headers: authHeadersA });
  check(meAfter.status === 200 && meAfter.data.user === null, 'Old session cookie still returned user in /api/auth/me');
  const profileAfter = await api('/api/profile', { headers: authHeadersA });
  check(profileAfter.status === 401, `Old session cookie was NOT rejected by /api/profile (got ${profileAfter.status})`);
  const agentAfter = await api('/api/agent', { method: 'POST', headers: authHeadersA, body: { question: 'hello' } });
  check(agentAfter.status === 401, `Old session cookie was NOT rejected by /api/agent (got ${agentAfter.status})`);
  console.log('  ✔ Subsequent requests using old cookie strictly rejected with 401 Unauthorized\n');

  // =========================================================================
  // TEST 3: Multi-Session Isolation (Logging out Session 1 preserves Session 2)
  // =========================================================================
  console.log('Test 3: Multi-session isolation (device 1 logout does NOT kill device 2)...');
  // Login twice to create two concurrent sessions for the same user
  const login1 = await api('/api/auth/login', { method: 'POST', body: { email: studentEmail, password: studentPassword } });
  const token1 = login1.headers.get('set-cookie').match(/skillpilot_session=([^;]+)/)[1];

  const login2 = await api('/api/auth/login', { method: 'POST', body: { email: studentEmail, password: studentPassword } });
  const token2 = login2.headers.get('set-cookie').match(/skillpilot_session=([^;]+)/)[1];
  check(token1 !== token2, 'Two logins should generate two distinct session tokens');

  const hash1 = hashToken(token1);
  const hash2 = hashToken(token2);
  const dbBoth = await q('select token_hash from sessions where user_id=$1 and token_hash in ($2, $3)', [userId, hash1, hash2]);
  check(dbBoth.length === 2, 'Expected 2 active sessions in DB for concurrent logins');

  // Logout from Session 1 only
  await api('/api/auth/logout', { method: 'POST', headers: { cookie: `skillpilot_session=${token1}` } });

  // Verify Session 1 is deleted, but Session 2 remains in DB
  const dbS1 = await q('select id from sessions where token_hash=$1', [hash1]);
  check(dbS1.length === 0, 'Session 1 should be deleted from DB');
  const dbS2 = await q('select id from sessions where token_hash=$1', [hash2]);
  check(dbS2.length === 1, 'Session 2 MUST remain active in DB after Session 1 logged out');

  // Verify Session 2 can still access protected routes
  const profileS2 = await api('/api/profile', { headers: { cookie: `skillpilot_session=${token2}` } });
  check(profileS2.status === 200, `Session 2 should still be able to access /api/profile (got ${profileS2.status})`);
  console.log('  ✔ Multi-session isolation verified: logging out device 1 keeps device 2 active\n');

  // =========================================================================
  // TEST 4: Mentor Account Logout
  // =========================================================================
  console.log('Test 4: Mentor account logout and role isolation...');
  const mentorEmail = `logout-mentor-${stamp}@test.skillpilot`;
  const mentorPassword = 'Secure-Mentor-Pass-123';
  const mentorSignup = await api('/api/auth/signup', {
    method: 'POST',
    body: { email: mentorEmail, name: 'Logout Mentor', password: mentorPassword, role: 'mentor' }
  });
  check(mentorSignup.status === 201, `Mentor signup failed: ${mentorSignup.status}`);
  const mentorToken = mentorSignup.headers.get('set-cookie').match(/skillpilot_session=([^;]+)/)[1];
  const mentorHash = hashToken(mentorToken);

  // Approve mentor in DB so they have mentor permissions
  const mentorUserRow = (await q('select id from users where email=$1', [mentorEmail]))[0];
  await q("insert into mentor_profiles(user_id,bio,focus,status) values($1,'A sufficiently long bio for logout verification.','System Architecture','approved') on conflict(user_id) do update set status='approved'", [mentorUserRow.id]);

  const mentorAuth = { cookie: `skillpilot_session=${mentorToken}` };
  const mentorReqs = await api('/api/mentor/requests', { headers: mentorAuth });
  check(mentorReqs.status === 200, `Mentor requests route failed: ${mentorReqs.status}`);

  // Logout mentor
  const mentorLogout = await api('/api/auth/logout', { method: 'POST', headers: mentorAuth });
  check(mentorLogout.status === 200, 'Mentor logout failed');

  // Check DB deletion
  const mentorDbSession = await q('select id from sessions where token_hash=$1', [mentorHash]);
  check(mentorDbSession.length === 0, 'Mentor session was not removed from DB');

  // Check route rejection
  const mentorReqsAfter = await api('/api/mentor/requests', { headers: mentorAuth });
  check(mentorReqsAfter.status === 401 || mentorReqsAfter.status === 403, `Mentor requests not rejected after logout: ${mentorReqsAfter.status}`);
  console.log('  ✔ Mentor logout verified: DB session deleted and mentor routes protected\n');

  // =========================================================================
  // TEST 5: Admin Account Logout
  // =========================================================================
  console.log('Test 5: Admin account logout and role isolation...');
  const adminEmail = `logout-admin-${stamp}@test.skillpilot`;
  const adminPassword = 'Secure-Admin-Pass-123';
  const adminUser = (await q(
    `insert into users(email,password_hash,role,name,status,email_verified_at)
     values($1, crypt($2, gen_salt('bf', 12)), 'admin', 'Logout Admin', 'active', now())
     returning id`,
    [adminEmail, adminPassword]
  ))[0];

  const adminLogin = await api('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
  check(adminLogin.status === 200, `Admin login failed: ${adminLogin.status}`);
  const adminToken = adminLogin.headers.get('set-cookie').match(/skillpilot_session=([^;]+)/)[1];
  const adminHash = hashToken(adminToken);

  const adminAuth = { cookie: `skillpilot_session=${adminToken}` };
  const adminMentors = await api('/api/admin/mentors', { headers: adminAuth });
  check(adminMentors.status === 200, `Admin mentors route failed: ${adminMentors.status}`);

  // Logout admin
  const adminLogout = await api('/api/auth/logout', { method: 'POST', headers: adminAuth });
  check(adminLogout.status === 200, 'Admin logout failed');

  // Check DB deletion
  const adminDbSession = await q('select id from sessions where token_hash=$1', [adminHash]);
  check(adminDbSession.length === 0, 'Admin session was not removed from DB');

  // Check route rejection
  const adminMentorsAfter = await api('/api/admin/mentors', { headers: adminAuth });
  check(adminMentorsAfter.status === 403, `Admin mentors not rejected with 403 after logout: ${adminMentorsAfter.status}`);
  console.log('  ✔ Admin logout verified: DB session deleted and admin control plane protected\n');

  // =========================================================================
  // TEST 6: Playwright E2E UI Dropdown & Interaction Verification
  // =========================================================================
  console.log('Test 6: Playwright E2E verification of sidebar profile dropdown...');
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('skillpilot_cinematic_seen', 'true'); } catch {}
  });
  const page = await context.newPage();

  // Sign in as student via UI
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', studentEmail);
  await page.fill('input[type="password"]', studentPassword);
  await page.click('button.auth-submit');

  // Wait for sidebar profile trigger
  await page.waitForSelector('.side-profile-trigger', { state: 'visible', timeout: 15000 });
  const trigger = page.locator('.side-profile-trigger');
  check(await trigger.isVisible(), 'Sidebar profile trigger button is not visible');
  check((await trigger.getAttribute('aria-haspopup')) === 'menu', 'Trigger missing aria-haspopup="menu"');
  check((await trigger.getAttribute('aria-expanded')) === 'false', 'Trigger aria-expanded should be false initially');

  const studentNameText = await page.locator('.side-profile-text b').textContent();
  check(studentNameText.includes('Logout Student'), `Trigger profile name mismatch, got: ${studentNameText}`);
  console.log(`  ✔ Bottom-left sidebar profile trigger visible with student name "${studentNameText.trim()}"`);

  // Step 6a: Click trigger to open dropdown
  await trigger.click();
  await page.waitForSelector('.profile-dropdown-menu', { state: 'visible', timeout: 3000 });
  check((await trigger.getAttribute('aria-expanded')) === 'true', 'Trigger aria-expanded should be true when open');

  const menuLocator = page.locator('.profile-dropdown-menu');
  check(await menuLocator.isVisible(), 'Profile dropdown menu did not render');
  const dropdownEmail = await page.locator('.profile-dropdown-email').textContent();
  check(dropdownEmail.includes(studentEmail), `Dropdown email mismatch, got: ${dropdownEmail}`);
  const roleBadge = await page.locator('.profile-dropdown-role-badge').textContent();
  check(roleBadge.includes('STUDENT'), `Dropdown role badge mismatch, got: ${roleBadge}`);
  check(await page.locator('.profile-dropdown-item:has-text("Account Settings")').isVisible(), 'Account Settings link not visible');
  check(await page.locator('.profile-dropdown-item.logout-item').isVisible(), 'Log out button not visible');
  console.log('  ✔ Profile dropdown opened cleanly displaying name, email, role badge, settings, and logout');

  // Step 6b: Test Escape key dismisses menu and returns focus
  await page.keyboard.press('Escape');
  await page.waitForSelector('.profile-dropdown-menu', { state: 'detached', timeout: 3000 });
  check((await trigger.getAttribute('aria-expanded')) === 'false', 'Trigger aria-expanded should be false after Escape');
  const isTriggerFocused = await trigger.evaluate((node) => document.activeElement === node);
  check(isTriggerFocused, 'Trigger button should receive focus when closed via Escape key');
  console.log('  ✔ Keyboard Escape key closed dropdown and restored focus to trigger button');

  // Step 6c: Test Click outside dismisses menu
  await trigger.click();
  await page.waitForSelector('.profile-dropdown-menu', { state: 'visible' });
  // Click outside in main content
  await page.locator('#main-content').click({ position: { x: 400, y: 200 } });
  await page.waitForSelector('.profile-dropdown-menu', { state: 'detached', timeout: 3000 });
  check((await trigger.getAttribute('aria-expanded')) === 'false', 'Trigger aria-expanded should be false after outside click');
  console.log('  ✔ Click-outside behavior closed dropdown cleanly');

  // Step 6d: Test Settings navigation from dropdown
  await trigger.click();
  await page.waitForSelector('.profile-dropdown-menu', { state: 'visible' });
  await page.locator('.profile-dropdown-item:has-text("Account Settings")').click();
  await page.waitForSelector('.profile-dropdown-menu', { state: 'detached', timeout: 3000 });
  // Check that settings view is rendered
  await page.waitForSelector('.crumb b:has-text("Settings")', { timeout: 5000 });
  console.log('  ✔ "Account Settings" item navigated to settings view and closed dropdown');

  // Step 6e: Test Log out action in UI
  await trigger.click();
  await page.waitForSelector('.profile-dropdown-menu', { state: 'visible' });
  const logoutBtn = page.locator('.profile-dropdown-item.logout-item');
  await logoutBtn.click();

  // Wait for login screen to appear
  await page.waitForSelector('.auth-shell', { state: 'visible', timeout: 8000 });
  const authTitle = await page.locator('.auth-card-head h2').textContent();
  check(authTitle.includes('Welcome back'), `Auth screen did not display after logout, got: ${authTitle}`);
  console.log('  ✔ Clicking "Log out" smoothly transitioned UI to unauthenticated AuthGate');

  // Step 6f: Back-button and Page Reload verification (no session leak)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.auth-shell', { state: 'visible', timeout: 8000 });
  check(await page.locator('.auth-shell').isVisible(), 'AuthGate not visible after reload');
  check(await page.locator('.sidebar').count() === 0, 'Sidebar should NOT be visible after reload when logged out');
  console.log('  ✔ Page reload verified: User remains unauthenticated with zero session leak\n');

  // =========================================================================
  // TEST 7: Mentor & Admin UI Logout Verification
  // =========================================================================
  console.log('Test 7: Playwright E2E verification of Mentor & Admin UI logout...');
  // Log in as mentor in UI
  await page.fill('input[type="email"]', mentorEmail);
  await page.fill('input[type="password"]', mentorPassword);
  await page.click('button.auth-submit');
  await page.waitForSelector('.workspace-user', { state: 'visible', timeout: 8000 });
  const mentorLogoutBtn = page.locator('.workspace-user button.logout-btn');
  check(await mentorLogoutBtn.isVisible(), 'Mentor header logout button not visible');
  await mentorLogoutBtn.click();
  await page.waitForSelector('.auth-shell', { state: 'visible', timeout: 8000 });
  console.log('  ✔ Mentor UI header logout transitioned cleanly to AuthGate');

  // Log in as admin in UI
  await page.fill('input[type="email"]', adminEmail);
  await page.fill('input[type="password"]', adminPassword);
  await page.click('button.auth-submit');
  await page.waitForSelector('.workspace-user', { state: 'visible', timeout: 8000 });
  const adminLogoutBtn = page.locator('.workspace-user button.logout-btn');
  check(await adminLogoutBtn.isVisible(), 'Admin header logout button not visible');
  await adminLogoutBtn.click();
  await page.waitForSelector('.auth-shell', { state: 'visible', timeout: 8000 });
  console.log('  ✔ Admin UI header logout transitioned cleanly to AuthGate\n');

  // Clean up test users safely
  try {
    await q("set skillpilot.allow_account_delete = 'on'");
    await q('delete from users where email in ($1, $2, $3)', [studentEmail, mentorEmail, adminEmail]);
    await q("set skillpilot.allow_account_delete = 'off'");
  } catch {}

  console.log('=================================================================');
  console.log('🎉 ALL LOGOUT & SESSION INVALIDATION REGRESSION TESTS PASSED!');
  console.log('=================================================================');
} catch (err) {
  console.error('\n❌ Verification Failed:', err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await pool.end();
}
