// Profile stays saved: lock/edit, survives reload, optional Chrome-account copy restores after local data is lost.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
(async () => {
  const root = path.join(__dirname, '..');
  const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'suext-'));
  fs.cpSync(path.join(root, 'extension'), ext, { recursive: true });
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'suprof-'));
  const launch = () => chromium.launchPersistentContext(userDir, {
    headless: true, executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chromium',
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
  });
  let ctx = await launch();
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  const errors = [];
  let page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${id}/app.html#profile`);
  await page.setInputFiles('#cv-file', path.join(__dirname, 'fixtures/cv/sample_cv.pdf'));
  await page.waitForSelector('#cv-apply', { timeout: 20000 });
  await page.click('#cv-apply');
  await page.check('#set-sync');
  await page.click('#lock-btn');
  await page.waitForTimeout(800);
  console.log('locked:', await page.$eval('#p-name', (e) => e.disabled), '| title:', await page.textContent('#lock-title'), '| status:', await page.textContent('#save-status'));
  await ctx.close();

  // Restart the browser: data must still be there
  ctx = await launch();
  [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${id}/app.html#profile`);
  await page.waitForTimeout(800);
  console.log('after restart:', await page.inputValue('#p-name'), '| IELTS', await page.inputValue('#t-ielts-o'), '| still locked:', await page.$eval('#p-name', (e) => e.disabled));

  // Lose the local copy (e.g. reinstall on a new computer), keep the Chrome-account copy
  await page.evaluate(() => chrome.storage.local.clear());
  await page.reload();
  await page.waitForSelector('#sync-restore', { timeout: 8000 });
  await page.click('#sync-restore');
  console.log('restored from Chrome account:', await page.inputValue('#p-name'), '| degrees', await page.$$eval('.edu-row', (r) => r.length));
  console.log('errors', errors);
  await ctx.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
