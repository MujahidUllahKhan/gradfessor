// Offline support for the desktop (installable web) app. Not used inside the extension.
const CACHE = 'gradfessor-v0.4.2';
const SHELL = [
  'app.html', 'manifest.webmanifest', 'css/app.css',
  'lib/exceljs.min.js', 'js/config.js', 'js/storage.js', 'js/bridge.js', 'js/textkit.js', 'js/matcher.js', 'js/coach.js', 'js/tracker.js',
  'js/export.js', 'js/openalex.js', 'js/requirements.js', 'js/cvimport.js', 'js/reports.js', 'lib/docx.iife.js', 'lib/mammoth.browser.min.js', 'js/links.js', 'js/prompts.js', 'js/sample-data.js', 'js/app.js',
  'icons/icon48.png', 'icons/icon192.png', 'icons/icon512.png'
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first for our own files (so updates show up), cache when offline. Other sites are never cached.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
