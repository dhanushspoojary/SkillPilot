import { chromium } from 'playwright';

async function diagnose() {
  console.log('Launching browser (msedge)...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const page = await browser.newPage();

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err.message);
  });

  page.on('requestfailed', (req) => {
    networkErrors.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText);
  const bodyHtml = await page.evaluate(() => document.body.innerHTML);
  const authLoadingVisible = await page.isVisible('.auth-loading');
  const authShellVisible = await page.isVisible('.auth-shell');
  const appShellVisible = await page.isVisible('.app-shell');

  console.log('--- Page Assessment ---');
  console.log('Title:', title);
  console.log('Body Text Snippet:', bodyText.slice(0, 300).replace(/\n/g, ' '));
  console.log('auth-loading visible:', authLoadingVisible);
  console.log('auth-shell visible:', authShellVisible);
  console.log('app-shell visible:', appShellVisible);
  console.log('Console Logs count:', consoleLogs.length);
  if (consoleLogs.length > 0) {
    console.log('Console Logs:', JSON.stringify(consoleLogs, null, 2));
  }
  if (networkErrors.length > 0) {
    console.log('Network Errors:', JSON.stringify(networkErrors, null, 2));
  }

  await browser.close();
}

diagnose().catch((err) => {
  console.error('DIAGNOSE ERROR:', err);
  process.exit(1);
});
