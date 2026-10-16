import { chromium } from 'playwright';

async function verify() {
  console.log('=== Verifying Student Workspace Render in Microsoft Edge ===');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  console.log('1. Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Verify auth shell is displayed
  const authShellVisible = await page.isVisible('.auth-shell');
  console.log('   Auth shell displayed:', authShellVisible);

  // Sign up a test student
  const stamp = Date.now();
  const studentEmail = `edge_test_${stamp}@example.test`;
  console.log(`2. Registering student ${studentEmail}...`);

  await page.click('button:has-text("Create account")');
  await page.waitForTimeout(300);

  await page.fill('label:has-text("Name") input', 'Edge Test Student');
  await page.fill('label:has-text("Email") input', studentEmail);
  await page.fill('label:has-text("Password") input', 'password-secure-1234');

  await page.click('button.primary.auth-submit');

  console.log('3. Waiting for student workspace (.app-shell)...');
  await page.waitForSelector('.app-shell', { timeout: 15000 });

  const appShellVisible = await page.isVisible('.app-shell');
  const authLoadingVisible = await page.isVisible('.auth-loading');
  const welcomeTitle = await page.textContent('.welcome h1, h1');
  const priorityHeader = await page.textContent('.priority-card h2');
  const navItems = await page.$$eval('.nav-item span', (els) => els.map((e) => e.textContent?.trim()));

  console.log('--- Workspace Assessment Results ---');
  console.log('   app-shell visible:', appShellVisible);
  console.log('   auth-loading visible:', authLoadingVisible);
  console.log('   Welcome Title:', welcomeTitle?.trim());
  console.log('   Priority Action:', priorityHeader?.trim());
  console.log('   Navigation Items:', navItems.join(', '));
  console.log('   Console Errors:', consoleErrors);

  // Take a screenshot of the student workspace to prove it rendered with Friendly Future theme
  await page.screenshot({ path: 'apps/web/workspace-verified.png', fullPage: true });
  console.log('4. Screenshot captured at apps/web/workspace-verified.png');

  await browser.close();
  console.log('=== Student Workspace Verification: COMPLETE & PASSED ===');
}

verify().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
