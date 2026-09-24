// End-to-end: loads the extension, scans a mock department site, imports into the app,
// then opens the desktop (web) app on localhost and checks the extension bridge + OpenAlex lookup (mocked).
// Run: node tests/scan.playwright.js   (set CHROME_PATH if Playwright has no browser installed)
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { chromium } = require('playwright');

function serve(dir, port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      fs.readFile(p, (err, buf) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain' }[path.extname(p)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type }); res.end(buf);
      });
    }).listen(port, () => resolve(srv));
  });
}

(async () => {
  const root = path.join(__dirname, '..');
  const site = await serve(path.join(__dirname, 'fixtures', 'dept'), 8765);
  const appSrv = await serve(path.join(root, 'extension'), 8766);

  // Test copy of the extension with localhost pre-granted (a real student grants it in the popup).
  const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'smext-'));
  fs.cpSync(path.join(root, 'extension'), ext, { recursive: true });
  const man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  man.host_permissions.push('http://localhost/*');
  fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(man));

  const ctx = await chromium.launchPersistentContext('', {
    headless: true, executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chromium',
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
  });
  const errors = [];
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];

  // 1) Faculty list page + extraction (what the popup does)
  const dept = await ctx.newPage();
  await dept.goto('http://localhost:8765/faculty.html');
  const extract = fs.readFileSync(path.join(root, 'extension', 'js', 'scan-extract.js'), 'utf8');
  const found = await dept.evaluate(extract);
  console.log('extracted', found.links.map((l) => l.name));

  // 2) Start the background job from an extension page
  const app = await ctx.newPage();
  app.on('pageerror', (e) => errors.push('ext app: ' + e.message));
  await app.goto(`chrome-extension://${id}/app.html#match`);
  const start = await app.evaluate((f) => chrome.runtime.sendMessage({ type: 'startJob', payload: { links: f.links, meta: { heading: f.heading, title: f.title, site: f.site, hostname: f.hostname } } }), found);
  console.log('job', start);
  // wait for completion
  for (let i = 0; i < 40; i++) {
    const jobs = await app.evaluate(async () => (await chrome.storage.local.get('gradfessor_jobs_v1')).gradfessor_jobs_v1 || []);
    const j = jobs[0];
    if (!j || j.status === 'done') break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  await app.waitForFunction(() => document.querySelectorAll('.prof').length >= 5, null, { timeout: 20000 });
  const names = await app.$$eval('.prof h3', (h) => h.map((x) => x.textContent));
  console.log('imported + ranked', names);
  const scans = await app.$eval('#scan-jobs', (e) => e.innerText);
  console.log('scan summary:', scans.replace(/\s+/g, ' '));
  const emailed = await app.$$eval('.prof', (els) => els.map((e) => e.innerText.includes('@example.edu')));
  await app.screenshot({ path: path.join(root, '.smoke', 'scan-ext.png'), fullPage: true });

  // 3) Paper lookup (OpenAlex mocked) on a hand-added professor
  const pwa = app;
  await pwa.route('https://api.openalex.org/**', (route) => {
    const u = route.request().url();
    if (u.includes('/authors')) return route.fulfill({ json: { results: [{ id: 'https://openalex.org/A1', display_name: 'Mei Chen', works_count: 40, cited_by_count: 900, summary_stats: { h_index: 15 }, last_known_institutions: [{ display_name: 'Example State University' }], topics: [{ display_name: 'Inventory Management' }] }] } });
    return route.fulfill({ json: { results: [{ id: 'W1', display_name: 'Reinforcement learning for pharmacy inventory', publication_year: 2026, cited_by_count: 3, open_access: { oa_url: 'https://example.org/p.pdf' }, primary_location: { source: { display_name: 'IISE Transactions' } }, abstract_inverted_index: { We: [0], study: [1], inventory: [2] }, keywords: [{ display_name: 'Inventory control' }] }] } });
  });
  await pwa.fill('#f-name', 'Dr. Mei Chen'); await pwa.fill('#f-university', 'Example State University'); await pwa.fill('#f-interests', 'inventory optimization');
  await pwa.click('#f-save');
  const card = pwa.locator('.prof', { hasText: 'Dr. Mei Chen' }).last();
  await card.locator('[data-act=papers]').click();
  await card.locator('.oa-line').waitFor({ timeout: 15000 });
  console.log('openalex line:', await card.locator('.oa-line').textContent());

  // 4) Email capture -> classify -> log reply
  await app.evaluate(() => chrome.runtime.sendMessage({ type: 'addCapture', payload: { kind: 'email', subject: 'Re: Prospective PhD student', from: 'Mei Chen', fromEmail: 'chen@example.edu', text: 'Thanks for your email. Could we set up a Zoom call next week to talk more?' } }));
  await pwa.click('[data-view=tracker]');
  await pwa.waitForSelector('.mail-card', { timeout: 10000 });
  console.log('suggested type:', await pwa.$eval('.mail-card [data-type]', (s) => s.value));
  await pwa.click('.mail-card [data-log]');
  await pwa.waitForSelector('#con-table tr[data-id]');
  console.log('outreach stage:', await pwa.$eval('#con-table [data-stage]', (s) => s.value), '| reply:', await pwa.$eval('#con-table tbody tr td:nth-child(5)', (td) => td.innerText.replace(/\s+/g, ' ')));

  // 5) Prompt pack
  await pwa.click('[data-view=prompts]');
  const prompt = await pwa.inputValue('#pr-text');
  console.log('prompt has humanizer:', /humanizer rules/.test(prompt), '| pdf:', /\.pdf/.test(prompt), '| words:', prompt.split(/\s+/).length);
  await pwa.screenshot({ path: path.join(root, '.smoke', 'prompts.png'), fullPage: true });

  console.log('errors', errors);
  await ctx.close(); site.close(); appSrv.close();
  if (errors.length || names.length < 5) process.exit(1);
})();
