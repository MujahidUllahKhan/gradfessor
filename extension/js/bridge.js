// App-side connection to the extension.
// - Inside the extension (chrome-extension:// page): talks to the background directly.
// - In the desktop/web app: talks through js/bridge-content.js via window.postMessage.
(function (root) {
  const inExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && location.protocol === 'chrome-extension:';
  let present = inExtension;
  let version = inExtension ? chrome.runtime.getManifest().version : null;
  const waiting = new Map();
  const listeners = [];
  let seq = 0;

  if (!inExtension) {
    root.addEventListener('message', (e) => {
      if (e.source !== root || !e.data || e.data.source !== 'sm-ext') return;
      if (e.data.type === 'present') {
        if (present) return;
        present = true; version = e.data.version;
        listeners.forEach((fn) => fn(true));
        call('hello', { appUrl: location.href.split('#')[0] });
        return;
      }
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.err) w.reject(new Error(e.data.err)); else w.resolve(e.data.res);
    });
  }

  if (!inExtension) root.postMessage({ source: 'sm-app', type: 'discover' }, location.origin);

  function call(type, payload) {
    if (inExtension) return chrome.runtime.sendMessage({ type, payload });
    if (!present) return Promise.reject(new Error('Extension not connected'));
    return new Promise((resolve, reject) => {
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      root.postMessage({ source: 'sm-app', id, type, payload }, location.origin);
      setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); reject(new Error('Extension did not answer')); } }, 8000);
    });
  }

  root.SM = root.SM || {};
  root.SM.bridge = {
    call,
    get connected() { return present; },
    get version() { return version; },
    inExtension,
    onConnect(fn) { listeners.push(fn); if (present) fn(true); }
  };
})(typeof self !== 'undefined' ? self : globalThis);
