// Loads the unpacked extension in Chromium and checks app.html runs under the MV3 CSP.
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const ext = path.join(__dirname, '..', 'extension');
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    channel: process.env.CHROME_PATH ? undefined : 'chromium',
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    acceptDownloads: true
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  console.log('extension id', id);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`chrome-extension://${id}/app.html`);
  await page.click('#btn-sample');
  await page.waitForSelector('.prof');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
  console.log('download', dl.suggestedFilename());
  const stored = await sw.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
  console.log('storage keys', stored);
  const alarms = await sw.evaluate(async () => (await chrome.alarms.getAll()).map((a) => a.name));
  console.log('alarms', alarms);
  const pop = await ctx.newPage();
  await pop.goto(`chrome-extension://${id}/popup.html`);
  console.log('popup buttons', await pop.$$eval('button', (b) => b.map((x) => x.textContent)));
  console.log('errors', errors);
  await ctx.close();
  if (errors.length) process.exit(1);
})();
