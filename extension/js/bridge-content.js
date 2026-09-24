// Runs only on the Gradfessor desktop app page (the installable web app).
// Relays messages between that page and the extension, like Zotero's connector.
(function () {
  if (!document.querySelector('meta[name="gradfessor-app"]')) return;
  const ALLOWED = new Set(['hello', 'ping', 'getInbox', 'ackCaptures', 'ackJob', 'cancelJob', 'syncReminders']);
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'sm-app') return;
    const { id, type, payload } = e.data;
    if (type === 'discover') { announce(); return; }
    if (!ALLOWED.has(type)) return;
    try {
      chrome.runtime.sendMessage({ type, payload }, (res) => {
        const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
        window.postMessage({ source: 'sm-ext', id, res, err }, location.origin);
      });
    } catch (err) {
      window.postMessage({ source: 'sm-ext', id, res: null, err: String(err) }, location.origin);
    }
  });
  function announce() { window.postMessage({ source: 'sm-ext', type: 'present', version: chrome.runtime.getManifest().version }, location.origin); }
  announce();
})();
