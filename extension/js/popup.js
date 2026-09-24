// Popup: scan a department, capture one page, capture an email reply, or open the app.
// Every action runs only on the tab the student is looking at, and only when they click.
const statusEl = document.getElementById('pop-status');
const say = (t) => { statusEl.textContent = t; };
let tab = null;
let host = '';

const isMail = (h) => /(^|\.)mail\.google\.com$|(^|\.)outlook\.(live|office|office365)\.com$/.test(h);

chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
  tab = t;
  try { host = new URL(t.url).hostname; } catch (e) { host = ''; }
  const usable = /^https?:/.test((t && t.url) || '');
  document.getElementById('pop-site').textContent = usable ? host : 'Open a web page to capture';
  document.getElementById('sec-mail').hidden = !isMail(host);
  document.getElementById('sec-web').hidden = !usable || isMail(host);
});

function send(type, payload) { return chrome.runtime.sendMessage({ type, payload }); }

document.getElementById('open-app').addEventListener('click', async () => {
  await send('openApp', {});
  window.close();
});

// ---- Scan whole department ----
document.getElementById('scan').addEventListener('click', () => {
  if (!tab || !host) return say('Open a faculty list page first.');
  const origins = self.SM.scan.permissionOrigins(host);
  // Ask for access to this university's pages first (must happen directly in the click).
  chrome.permissions.request({ origins }).then(async (granted) => {
    if (!granted) return say('Gradfessor needs permission to read this university’s profile pages to scan them.');
    say('Looking for faculty profiles on this page…');
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['js/scan-extract.js'] });
    const found = res && res.result;
    if (!found || found.links.length < 2) return say('No list of faculty profiles found here. Open the department’s "Faculty" or "People" page, or use "Capture this page".');
    const meta = { heading: found.heading, title: found.title, site: found.site, url: found.url, hostname: found.hostname };
    const r = await send('startJob', { links: found.links, meta });
    const mins = Math.max(1, Math.round((r.total * 3) / 60));
    say(`Found ${found.found} people. Reading ${r.total} profiles in the background (about ${mins} min). You can close this and keep browsing.`);
    setTimeout(() => send('openApp', { hash: 'match' }), 1200);
  }).catch((e) => say('Could not scan: ' + e.message));
});

// ---- Capture one page ----
document.getElementById('capture').addEventListener('click', async () => {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = String(window.getSelection() || '').trim();
        const text = sel || (document.body ? document.body.innerText : '');
        const h1 = document.querySelector('h1, #gsc_prf_in');
        return { title: document.title, heading: h1 ? h1.innerText.trim() : '', url: location.href, text: text.slice(0, 25000), fromSelection: !!sel };
      }
    });
    const cap = res && res.result;
    if (!cap || !cap.text) return say('No readable text found on this page.');
    await send('addCapture', { kind: 'page', ...cap });
    await send('openApp', { hash: 'match' });
    window.close();
  } catch (e) { say('Could not read this page: ' + e.message); }
});

// ---- Capture program requirements (admissions page) ----
document.getElementById('cap-req').addEventListener('click', async () => {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = String(window.getSelection() || '').trim();
        const main = document.querySelector('main, [role="main"], #content, .content') || document.body;
        const h1 = document.querySelector('h1');
        const site = document.querySelector('meta[property="og:site_name"]');
        return {
          title: document.title, heading: h1 ? h1.innerText.trim() : '', site: site ? site.getAttribute('content') : '',
          url: location.href, text: (sel || (main ? main.innerText : '')).slice(0, 40000), fromSelection: !!sel
        };
      }
    });
    const cap = res && res.result;
    if (!cap || !cap.text) return say('No readable text found on this page.');
    await send('addCapture', { kind: 'requirements', ...cap });
    await send('openApp', { hash: 'tracker' });
    window.close();
  } catch (e) { say('Could not read this page: ' + e.message); }
});

// ---- Capture an email reply (Gmail / Outlook web) ----
document.getElementById('cap-email').addEventListener('click', async () => {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = String(window.getSelection() || '').trim();
        const bodies = document.querySelectorAll('.a3s, [aria-label="Message body"], div[role="document"]');
        const lastBody = bodies.length ? bodies[bodies.length - 1].innerText : '';
        const subj = document.querySelector('h2.hP, [role="heading"][aria-level="2"]');
        const senders = document.querySelectorAll('.gD[email], span[email]');
        const s = senders.length ? senders[senders.length - 1] : null;
        return {
          subject: subj ? subj.innerText.trim() : document.title,
          from: s ? (s.getAttribute('name') || s.innerText) : '',
          fromEmail: s ? s.getAttribute('email') : '',
          text: (sel || lastBody || (document.body ? document.body.innerText : '')).slice(0, 8000),
          url: location.href
        };
      }
    });
    const cap = res && res.result;
    if (!cap || !cap.text) return say('Open the email first, or select its text.');
    await send('addCapture', { kind: 'email', ...cap });
    await send('openApp', { hash: 'tracker' });
    window.close();
  } catch (e) { say('Could not read this email: ' + e.message); }
});
