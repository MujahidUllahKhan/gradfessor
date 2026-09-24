// Gradfessor by Afridi - background service worker (Manifest V3)
// 1. Department scans: fetches faculty profile pages from the student's own browser,
//    politely (robots.txt, one page every few seconds), and parses them locally.
// 2. Inbox: holds page/email captures and scan results until the app picks them up.
// 3. Reminders: twice a day, notifies about due follow-ups and close deadlines.
// Nothing is sent to any Gradfessor server (there is none).

importScripts('js/textkit.js', 'js/matcher.js', 'js/scan-utils.js');

const INBOX_KEY = 'gradfessor_inbox_v1';
const JOBS_KEY = 'gradfessor_jobs_v1';
const REM_KEY = 'gradfessor_reminders_v1';
const APP_URL_KEY = 'gradfessor_app_url_v1';
const DELAY_MS = 2500;
const MAX_PROFILES = 80;
const DAY_MS = 24 * 60 * 60 * 1000;

const get = async (k, d) => { const r = await chrome.storage.local.get(k); return r[k] == null ? d : r[k]; };
const set = (k, v) => chrome.storage.local.set({ [k]: v });
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- setup ----------------
function ensureAlarm() {
  chrome.alarms.get('sm-daily-check', (a) => { if (!a) chrome.alarms.create('sm-daily-check', { periodInMinutes: 60 * 12, delayInMinutes: 1 }); });
}
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); runJobs(); });

// ---------------- inbox ----------------
async function addCapture(cap) {
  const inbox = await get(INBOX_KEY, []);
  inbox.push({ id: uid(), capturedAt: new Date().toISOString(), ...cap });
  await set(INBOX_KEY, inbox.slice(-50));
}

// ---------------- department scan jobs ----------------
let running = false;
const robotsCache = {};

async function robotsFor(origin) {
  if (robotsCache[origin]) return robotsCache[origin];
  let rules = [];
  try {
    const r = await fetch(origin + '/robots.txt', { credentials: 'omit' });
    if (r.ok) rules = self.SM.scan.parseRobots(await r.text());
  } catch (e) { /* no robots.txt = allowed */ }
  robotsCache[origin] = rules;
  return rules;
}

async function fetchProfile(link) {
  const u = new URL(link.url);
  const rules = await robotsFor(u.origin);
  if (!self.SM.scan.robotsAllowed(rules, u.pathname + u.search)) return { ...link, status: 'skipped', error: 'Blocked by the site’s robots.txt' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(link.url, { credentials: 'omit', signal: ctrl.signal, headers: { Accept: 'text/html' } });
    if (!res.ok) return { ...link, status: 'error', error: `HTTP ${res.status}` };
    const html = await res.text();
    const S = self.SM.scan;
    const text = S.htmlToText(html);
    const heading = S.firstTag(html, 'h1');
    const parsed = self.SM.matcher.parseFacultyText(text, { heading: link.name || heading, url: link.url });
    const emails = S.mailtos(html);
    return {
      ...link,
      status: 'ok',
      name: link.name || parsed.name,
      title: S.guessTitle(text),
      email: parsed.email || emails[0] || '',
      interests: parsed.interests,
      papers: parsed.papers,
      bio: text.slice(0, 5000)
    };
  } catch (e) {
    return { ...link, status: 'error', error: e.name === 'AbortError' ? 'Timed out' : e.message };
  } finally {
    clearTimeout(t);
  }
}

async function runJobs() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const jobs = await get(JOBS_KEY, []);
      const job = jobs.find((j) => j.status === 'queued' || j.status === 'running');
      if (!job) break;
      const next = job.links.findIndex((l, i) => !job.results[i]);
      if (next < 0) {
        job.status = 'done'; job.finishedAt = new Date().toISOString();
        await saveJob(job);
        notify('sm-scan-' + job.id, 'Department scan finished', `${job.results.filter((r) => r.status === 'ok').length} profiles read from ${job.meta.heading || job.meta.hostname}. Open Gradfessor to see the ranking.`);
        continue;
      }
      job.status = 'running';
      job.results[next] = await fetchProfile(job.links[next]);
      job.done = job.results.filter(Boolean).length;
      // re-read in case the job was cancelled meanwhile
      const fresh = (await get(JOBS_KEY, [])).find((j) => j.id === job.id);
      if (!fresh || fresh.status === 'cancelled') continue;
      await saveJob(job);
      await sleep(DELAY_MS);
    }
  } finally {
    running = false;
  }
}

async function saveJob(job) {
  const jobs = await get(JOBS_KEY, []);
  const i = jobs.findIndex((j) => j.id === job.id);
  if (i >= 0) jobs[i] = job; else jobs.push(job);
  await set(JOBS_KEY, jobs);
}

async function startJob(payload) {
  const links = (payload.links || []).slice(0, MAX_PROFILES);
  const job = { id: uid(), createdAt: new Date().toISOString(), status: 'queued', meta: payload.meta || {}, links, results: new Array(links.length).fill(null), done: 0 };
  const jobs = (await get(JOBS_KEY, [])).filter((j) => j.status !== 'cancelled');
  jobs.push(job);
  await set(JOBS_KEY, jobs.slice(-10));
  runJobs();
  return job;
}

// ---------------- reminders ----------------
function parseDate(s) { if (!s) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? null : d; }
function addBusinessDays(date, n) {
  const d = new Date(date); let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) added++; }
  return d;
}

async function dailyCheck() {
  const rem = await get(REM_KEY, null);
  if (!rem) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const followDays = Number(rem.followUpDays) || 10;
  const lines = [];
  (rem.contacts || []).forEach((c) => {
    if (!['Email sent', 'Follow-up sent'].includes(c.stage) || c.replyDate) return;
    const base = parseDate(c.stage === 'Follow-up sent' && c.lastFollowUp ? c.lastFollowUp : c.sentDate);
    if (!base) return;
    const due = c.followUpDate ? parseDate(c.followUpDate) : addBusinessDays(base, followDays);
    if (due && due <= today) lines.push(`Follow up: ${c.name || 'professor'} (emailed ${c.sentDate})`);
  });
  (rem.applications || []).forEach((a) => {
    if (['Submitted', 'Interview', 'Admitted', 'Rejected', 'Waitlisted', 'Withdrawn'].includes(a.status)) return;
    const dl = parseDate(a.deadline);
    if (!dl) return;
    const days = Math.round((dl - today) / DAY_MS);
    if (days >= 0 && days <= 7) lines.push(`Deadline in ${days} day${days === 1 ? '' : 's'}: ${a.university} ${a.program || ''}`.trim());
  });
  if (lines.length) notify('sm-reminder', `Gradfessor: ${lines.length} item${lines.length === 1 ? '' : 's'} need attention`, lines.slice(0, 4).join('\n'));
}

function notify(id, title, message) {
  try { chrome.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon128.png', title, message, priority: 1 }); } catch (e) { /* ignore */ }
}

async function openApp(hash) {
  const url = await get(APP_URL_KEY, '');
  chrome.tabs.create({ url: (url || chrome.runtime.getURL('app.html')) + (hash ? '#' + hash : '') });
}

chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === 'sm-daily-check') dailyCheck(); });
chrome.notifications.onClicked.addListener((id) => openApp(id.startsWith('sm-scan') ? 'match' : 'tracker'));

// ---------------- messages (popup, extension app page, and the desktop app via bridge) ----------------
async function handle(msg, sender) {
  switch (msg && msg.type) {
    case 'ping':
      return { ok: true, version: chrome.runtime.getManifest().version };
    case 'hello': // desktop app announced itself; remember where it lives
      if (msg.payload && msg.payload.appUrl) await set(APP_URL_KEY, msg.payload.appUrl);
      return { ok: true, version: chrome.runtime.getManifest().version };
    case 'addCapture':
      await addCapture(msg.payload);
      return { ok: true };
    case 'startJob': {
      const job = await startJob(msg.payload);
      return { ok: true, id: job.id, total: job.links.length };
    }
    case 'getInbox':
      return { ok: true, captures: await get(INBOX_KEY, []), jobs: await get(JOBS_KEY, []) };
    case 'ackCaptures': {
      const ids = new Set((msg.payload && msg.payload.ids) || []);
      await set(INBOX_KEY, (await get(INBOX_KEY, [])).filter((c) => !ids.has(c.id)));
      return { ok: true };
    }
    case 'ackJob': {
      await set(JOBS_KEY, (await get(JOBS_KEY, [])).filter((j) => j.id !== msg.payload.id));
      return { ok: true };
    }
    case 'cancelJob': {
      const jobs = await get(JOBS_KEY, []);
      const j = jobs.find((x) => x.id === msg.payload.id);
      if (j) j.status = 'cancelled';
      await set(JOBS_KEY, jobs);
      return { ok: true };
    }
    case 'syncReminders':
      await set(REM_KEY, { ...msg.payload, syncedAt: new Date().toISOString() });
      return { ok: true };
    case 'openApp':
      await openApp(msg.payload && msg.payload.hash);
      return { ok: true };
    default:
      return { ok: false, error: 'Unknown message' };
  }
}

// ---------------- who may talk to the background ----------------
// Extension pages (popup, built-in dashboard) may use every message.
// Web pages may only reach us through bridge-content.js, and only if their address is one of
// the app addresses listed in manifest.json -> content_scripts[0].matches. Everything else is refused.
const BRIDGE_TYPES = new Set(['hello', 'ping', 'getInbox', 'ackCaptures', 'ackJob', 'cancelJob', 'syncReminders']);
function matchToRegex(pattern) {
  const m = pattern.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
  if (!m) return null;
  const scheme = m[1] === '*' ? 'https?' : m[1];
  const host = m[2] === '*' ? '[^/]+' : m[2].replace(/[.]/g, '\\.').replace(/^\\\.?\*\\\./, '(?:[^/]+\\.)?').replace(/^\*\\\./, '(?:[^/]+\\.)?');
  const path = m[3].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${scheme}:\\/\\/${host}(?::\\d+)?${path}$`);
}
const APP_PATTERNS = ((chrome.runtime.getManifest().content_scripts || [])[0] || { matches: [] }).matches.map(matchToRegex).filter(Boolean);
function allowedSender(msg, sender) {
  if (sender.id !== chrome.runtime.id) return false;
  const url = sender.url || '';
  if (url.startsWith(chrome.runtime.getURL(''))) return true; // our own pages
  if (!msg || !BRIDGE_TYPES.has(msg.type)) return false;
  return APP_PATTERNS.some((re) => re.test(url));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!allowedSender(msg, sender)) { sendResponse({ ok: false, error: 'Not allowed' }); return false; }
  handle(msg, sender).then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
  return true;
});

// Resume any scan that was interrupted when the worker went to sleep.
runJobs();
