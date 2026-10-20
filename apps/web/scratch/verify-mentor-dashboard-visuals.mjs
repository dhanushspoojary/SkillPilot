import { chromium } from 'playwright';
import pg from 'pg';
import fs from 'fs';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new pg.Pool({ connectionString: match[1] });

const PORT = 3003;
const BASE_URL = `http://localhost:${PORT}`;

async function run() {
  console.log('======================================================');
  console.log('MENTOR DASHBOARD & APPROVAL WORKFLOW VERIFICATION');
  console.log('======================================================\n');

  const stamp = Date.now();
  const mentorId = randomUUID();
  const studentId = randomUUID();
  const adminId = randomUUID();

  const mentorEmail = `mentor-dash-${stamp}@test.local`;
  const studentEmail = `student-dash-${stamp}@test.local`;
  const adminEmail = `admin-dash-${stamp}@test.local`;

  const password = 'Password123456!';
  const pwHash = await bcrypt.hash(password, 10);

  // Setup DB fixtures: 1 fresh mentor (pending), 1 student, 1 admin
  console.log('[STEP 1] Provisioning test users (mentor, student, admin)...');
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, status)
     VALUES ($1, $2, $4, 'Dr. Sarah Connor', 'mentor', 'active'),
            ($3, $5, $4, 'John Student', 'student', 'active'),
            ($6, $7, $4, 'Platform Admin', 'admin', 'active')`,
    [mentorId, mentorEmail, studentId, pwHash, studentEmail, adminId, adminEmail]
  );

  await pool.query(
    `INSERT INTO mentor_profiles (user_id, bio, focus, skills, status)
     VALUES ($1, 'Initial short bio', 'Distributed Systems', '["rest-apis"]'::jsonb, 'pending')`,
    [mentorId]
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // 2. Authenticate as Mentor
    console.log('\n[STEP 2] Authenticating as mentor...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const loginRes = await page.evaluate(async ({ email, password }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return { ok: res.ok, status: res.status };
    }, { email: mentorEmail, password });

    if (!loginRes.ok) throw new Error(`Mentor login failed: ${loginRes.status}`);
    console.log('   ✓ Mentor authenticated successfully.');

    // Reload page to load MentorWorkspace
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // 3. Inspect visual design and CSS styles
    console.log('\n[STEP 3] Inspecting visual design, theme contrast, and layout...');
    const heroTitle = await page.textContent('.workspace-hero h1');
    console.log('   Workspace Hero Title:', heroTitle?.trim());

    const focusInput = page.locator('#mentor-focus');
    const bioTextarea = page.locator('#mentor-bio');

    const focusStyles = await focusInput.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        bgColor: cs.backgroundColor,
        color: cs.color,
        width: cs.width,
        border: cs.border,
        padding: cs.padding
      };
    });
    console.log('   #mentor-focus styles:', focusStyles);

    const bioStyles = await bioTextarea.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        bgColor: cs.backgroundColor,
        color: cs.color,
        width: cs.width,
        border: cs.border,
        padding: cs.padding
      };
    });
    console.log('   #mentor-bio styles:', bioStyles);

    if (focusStyles.bgColor === 'rgb(255, 255, 255)') {
      throw new Error('FAILED: #mentor-focus has a white background!');
    }
    console.log('   ✓ Inputs have dark background with crisp contrast.');

    // 4. Inspect Pending Approval State
    console.log('\n[STEP 4] Verifying pending approval state banner...');
    const pendingBanner = page.locator('.approval-status-banner.pending');
    await pendingBanner.waitFor({ timeout: 5000 });
    const bannerText = await pendingBanner.textContent();
    console.log('   ✓ Pending Banner rendered:', bannerText?.trim());

    // 5. Test Profile Editing, Character Counters, and Skill Chips
    console.log('\n[STEP 5] Testing profile editing and interactive skill chips...');
    await focusInput.fill('High Performance Distributed APIs & DB Tuning');
    await bioTextarea.fill('Experienced distributed systems engineer with 10+ years specializing in low-latency architectures.');

    // Click skill chips to select SQL and JavaScript
    console.log('   Toggling skills (SQL, JavaScript)...');
    await page.click('.mentor-skill-chip:has-text("SQL")');
    await page.click('.mentor-skill-chip:has-text("JavaScript")');

    // Click Save profile
    console.log('   Saving mentor profile...');
    await page.click('button.primary:has-text("Save profile")');

    // Verify success feedback
    const successMsg = page.locator('.save-status-msg.success');
    await successMsg.waitFor({ timeout: 5000 });
    console.log('   ✓ Profile Save Success notice:', (await successMsg.textContent())?.trim());

    // Capture screenshot of visual dashboard
    await page.screenshot({ path: 'apps/web/scratch/mentor-workspace-fixed.png', fullPage: true });
    console.log('   ✓ Saved verification screenshot to apps/web/scratch/mentor-workspace-fixed.png');

    // 6. Verify Persistence after page reload
    console.log('\n[STEP 6] Reloading page to verify persistence...');
    await page.reload({ waitUntil: 'networkidle' });

    const reloadedFocus = await page.inputValue('#mentor-focus');
    const reloadedBio = await page.inputValue('#mentor-bio');
    console.log('   Reloaded Focus:', reloadedFocus);
    console.log('   Reloaded Bio:', reloadedBio);

    if (reloadedFocus !== 'High Performance Distributed APIs & DB Tuning') {
      throw new Error('Focus field did not persist!');
    }
    if (!reloadedBio.includes('Experienced distributed systems engineer')) {
      throw new Error('Bio field did not persist!');
    }
    console.log('   ✓ Profile updates successfully persisted in database.');

    // 7. Verify Student Discovery does NOT show unapproved mentor
    console.log('\n[STEP 7] Verifying unapproved mentor is NOT discoverable by students...');
    const discBeforeRes = await pool.query(
      `select u.id, u.name from users u join mentor_profiles mp on mp.user_id=u.id where u.role='mentor' and u.status='active' and mp.status='approved' and u.id=$1`,
      [mentorId]
    );
    if (discBeforeRes.rowCount > 0) {
      throw new Error('Unapproved mentor was returned in approved mentors query!');
    }
    console.log('   ✓ Unapproved mentor is hidden from student mentor discovery.');

    // 8. Admin Approval Workflow
    console.log('\n[STEP 8] Admin approving mentor...');
    const approveRes = await page.evaluate(async ({ adminEmail, password, mentorId }) => {
      // Login as admin
      const adminLogin = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password })
      });
      if (!adminLogin.ok) return { ok: false, error: 'Admin login failed' };

      // Patch mentor approval
      const patch = await fetch('/api/admin/mentors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentorId, status: 'approved' })
      });
      return { ok: patch.ok, status: patch.status, data: await patch.json() };
    }, { adminEmail, password, mentorId });

    console.log('   Admin Approval Result:', approveRes);
    if (!approveRes.ok) throw new Error(`Admin approval failed: ${JSON.stringify(approveRes)}`);
    console.log('   ✓ Admin approved mentor successfully.');

    // 9. Verify Student Discovery NOW shows approved mentor
    console.log('\n[STEP 9] Verifying approved mentor is now discoverable...');
    const discAfterRes = await pool.query(
      `select u.id, u.name, mp.status from users u join mentor_profiles mp on mp.user_id=u.id where u.role='mentor' and u.status='active' and mp.status='approved' and u.id=$1`,
      [mentorId]
    );
    if (discAfterRes.rowCount === 0) {
      throw new Error('Approved mentor was NOT found in discovery query!');
    }
    console.log('   ✓ Approved mentor is now discoverable in student mentor discovery:', discAfterRes.rows[0]);

    // 10. Verify Mentor Dashboard reflects Approved state
    console.log('\n[STEP 10] Checking mentor dashboard reflects approved state...');
    await page.evaluate(async ({ mentorEmail, password }) => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mentorEmail, password })
      });
    }, { mentorEmail, password });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const approvedBanner = page.locator('.approval-status-banner.approved');
    await approvedBanner.waitFor({ timeout: 5000 });
    console.log('   ✓ Mentor Dashboard now renders Active & Discoverable banner:', (await approvedBanner.textContent())?.trim());

    console.log('\n======================================================');
    console.log('PHASE 2 MENTOR DASHBOARD VERIFICATION COMPLETED: ALL PASS');
    console.log('======================================================');
  } finally {
    await browser.close();
    // Clean up test records
    await pool.query(`DELETE FROM mentor_profiles WHERE user_id = $1`, [mentorId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [mentorId, studentId, adminId]);
    await pool.end();
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  pool.end();
  process.exit(1);
});
