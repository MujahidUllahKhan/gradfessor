// v0.4 end-to-end in the real extension: CV upload (PDF + Word), requirements capture,
// eligibility, and per-university Excel/Word downloads under the MV3 security policy.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

(async () => {
  const root = path.join(__dirname, '..');
  const out = process.argv[2] || path.join(root, '.smoke');
  fs.mkdirSync(out, { recursive: true });
  const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'suext-'));
  fs.cpSync(path.join(root, 'extension'), ext, { recursive: true });
  const ctx = await chromium.launchPersistentContext('', {
    headless: true, executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chromium',
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`], acceptDownloads: true
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto(`chrome-extension://${id}/app.html`);
  console.log('first view:', await page.$eval('.view:not([hidden]) h2', (h) => h.textContent));

  // 1) CV upload: PDF
  await page.click('[data-go=profile]');
  await page.setInputFiles('#cv-file', path.join(__dirname, 'fixtures/cv/sample_cv.pdf'));
  await page.waitForSelector('#cv-suggest:not([hidden]) .suggest', { timeout: 20000 });
  const sugg = await page.$$eval('.suggest b', (b) => b.map((x) => x.textContent));
  console.log('PDF suggestions:', sugg.join(', '));
  await page.click('#cv-apply');
  console.log('after apply:', await page.inputValue('#p-name'), '| IELTS', await page.inputValue('#t-ielts-o'), '| GRE Q', await page.inputValue('#t-gre-q'), '| degrees', await page.$$eval('.edu-row', (r) => r.length), '| courses', await page.$$eval('.course-row', (r) => r.length));
  await page.screenshot({ path: path.join(out, 'v04-profile.png'), fullPage: false });

  // 2) CV upload: Word
  await page.setInputFiles('#cv-file', path.join(__dirname, 'fixtures/cv/sample_cv.docx'));
  await page.waitForFunction(() => /Read sample_cv\.docx/.test(document.querySelector('#cv-status').textContent), null, { timeout: 15000 });
  console.log('DOCX:', await page.textContent('#cv-status'));

  // 3) Requirements capture (what the popup sends)
  const text = fs.readFileSync(path.join(__dirname, 'fixtures/program/requirements.txt'), 'utf8');
  await page.evaluate((t) => chrome.runtime.sendMessage({ type: 'addCapture', payload: { kind: 'requirements', title: 'PhD in Industrial Engineering | Graduate School | Example State University', heading: 'PhD in Industrial Engineering', url: 'https://grad.example.edu/ie-phd', text: t } }), text);
  await page.waitForSelector('.req-card', { timeout: 10000 });
  console.log('found pill:', await page.textContent('.req-card .pill'));
  await page.screenshot({ path: path.join(out, 'v04-capture.png'), fullPage: true });
  await page.click('.req-card [data-save]');
  console.log('form:', await page.inputValue('#a-university'), '|', await page.inputValue('#a-deadline'), '| IELTS', await page.inputValue('#a-ieltsMin'), '| fee', await page.inputValue('#a-fee'), '| waiver', await page.inputValue('#a-feeWaiver'));
  await page.click('#app-save');
  await page.waitForSelector('#app-table tr[data-id]');
  console.log('eligibility cell:', (await page.textContent('#app-table tbody tr td:nth-child(5)')).replace(/\s+/g, ' ').slice(0, 160));
  console.log('req cards left:', await page.$$eval('.req-card', (c) => c.length));

  // 4) Add demo professors at the same university, then reports
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'ping' }));
  await page.click('[data-view=match]');
  await page.fill('#f-name', 'Dr. Mei Chen'); await page.fill('#f-university', 'Example State University');
  await page.fill('#f-interests', 'supply chain optimization, reinforcement learning, inventory');
  await page.fill('#f-papers', 'Deep reinforcement learning for multi-echelon inventory control (2026)\nStochastic optimization for hospital supply chains (2025)');
  await page.click('#f-save');
  await page.click('[data-view=universities]');
  await page.waitForSelector('.uni');
  await page.screenshot({ path: path.join(out, 'v04-universities.png'), fullPage: true });
  const [x] = await Promise.all([page.waitForEvent('download'), page.click('.uni [data-x]')]);
  const xf = path.join(out, x.suggestedFilename()); await x.saveAs(xf);
  const [w] = await Promise.all([page.waitForEvent('download'), page.click('.uni [data-w]')]);
  const wf = path.join(out, w.suggestedFilename()); await w.saveAs(wf);
  const [a] = await Promise.all([page.waitForEvent('download'), page.click('#uni-all-xlsx')]);
  const af = path.join(out, a.suggestedFilename()); await a.saveAs(af);
  console.log('downloads:', [xf, wf, af].map((f) => `${path.basename(f)} ${fs.statSync(f).size}B`).join(' | '));

  // 5) popup has the new button
  const pop = await ctx.newPage();
  await pop.goto(`chrome-extension://${id}/popup.html`);
  console.log('popup:', await pop.$$eval('button', (b) => b.map((x) => x.textContent).join(' / ')));
  console.log('errors', errors);
  await ctx.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
