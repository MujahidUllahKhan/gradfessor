// Storage layer. Uses chrome.storage.local inside the extension and
// localStorage when app.html is opened as a normal web page (demo / GitHub Pages).
(function (root) {
  const KEY = 'gradfessor_state_v1';
  const OLD_KEYS = ['sahiustad_state_v1', 'labscout_state_v1', 'scholarmatch_state_v1']; // earlier names of the project
  const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local && typeof location !== 'undefined' && location.protocol === 'chrome-extension:';

  function emptyState() {
    return {
      version: 1,
      profile: {
        name: '', email: '', phone: '', country: '', targetDegree: 'PhD', targetTerm: '', field: '', targetCountries: '', funding: 'Full funding needed',
        links: { linkedin: '', scholar: '', github: '', website: '' },
        education: [], courses: [], experience: [],
        tests: { ielts: {}, toefl: {}, pte: {}, duolingo: '', gre: {}, greSubject: {}, gmat: '' },
        interests: '', skills: '', coursework: '', publications: '', projects: '', awards: '', teaching: '', languages: '', cvText: ''
      },
      faculty: [],
      applications: [],
      contacts: [],
      docs: { cv: '', sop: '', cover: '', research: '', email: '' },
      settings: { followUpDays: 10, openalexKey: '', autoPapers: true, profileLocked: false, syncProfile: false, lastBackup: '' },
      scans: {}
    };
  }

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = { ...base, ...saved };
    out.profile = { ...base.profile, ...(saved.profile || {}) };
    out.profile.tests = { ...base.profile.tests, ...((saved.profile || {}).tests || {}) };
    out.profile.links = { ...base.profile.links, ...((saved.profile || {}).links || {}) };
    ['courses', 'experience'].forEach((k) => { if (!Array.isArray(out.profile[k])) out.profile[k] = []; });
    out.docs = { ...base.docs, ...(saved.docs || {}) };
    out.settings = { ...base.settings, ...(saved.settings || {}) };
    ['faculty', 'applications', 'contacts'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
    if (!Array.isArray(out.profile.education)) out.profile.education = [];
    return out;
  }

  // IndexedDB for the web/desktop app (much more room than localStorage), localStorage as fallback.
  const idb = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((resolve, reject) => {
        if (!root.indexedDB) return reject(new Error('no indexedDB'));
        const req = root.indexedDB.open('gradfessor', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { this.db = req.result; resolve(this.db); };
        req.onerror = () => reject(req.error);
      });
    },
    async get(k) {
      const db = await this.open();
      return new Promise((resolve, reject) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    },
    async set(k, v) {
      const db = await this.open();
      return new Promise((resolve, reject) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    },
    async del(k) {
      const db = await this.open();
      return new Promise((resolve) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
    }
  };

  function lsGet() { try { const raw = root.localStorage ? root.localStorage.getItem(KEY) : null; return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

  async function load() {
    try {
      if (hasChrome) {
        const d = await chrome.storage.local.get([KEY, ...OLD_KEYS]);
        return merge(emptyState(), d[KEY] || OLD_KEYS.map((k) => d[k]).find(Boolean));
      }
      let saved = null;
      try { saved = await idb.get(KEY); } catch (e) { saved = null; }
      if (!saved) saved = lsGet();
      if (!saved) { for (const k of OLD_KEYS) { try { const raw = root.localStorage.getItem(k); if (raw) { saved = JSON.parse(raw); break; } } catch (e) { /* ignore */ } } }
      return merge(emptyState(), saved);
    } catch (e) {
      console.warn('Gradfessor: could not load saved data', e);
      return emptyState();
    }
  }

  async function save(state) {
    try {
      if (hasChrome) { await chrome.storage.local.set({ [KEY]: state }); return true; }
      try { await idb.set(KEY, JSON.parse(JSON.stringify(state))); return true; }
      catch (e) { root.localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    } catch (e) {
      console.warn('Gradfessor: could not save', e);
      return false;
    }
  }

  async function clearAll() {
    try {
      if (hasChrome) await chrome.storage.local.remove(KEY);
      else { try { await idb.del(KEY); } catch (e) { /* ignore */ } try { root.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
    } catch (e) { /* ignore */ }
  }

  // Optional: keep the profile in the student's own Chrome account (chrome.storage.sync).
  // Chrome sync allows ~100 KB in 8 KB items, so the profile JSON is split into chunks.
  const hasSync = hasChrome && !!chrome.storage.sync;
  const CHUNK = 6000;
  async function saveProfileSync(profile) {
    if (!hasSync) return false;
    let p = { ...profile };
    let json = JSON.stringify(p);
    if (json.length > 90000) { p = { ...p, cvText: '' }; json = JSON.stringify(p); } // CV text is the only large field
    if (json.length > 90000) return false;
    const parts = {};
    const n = Math.ceil(json.length / CHUNK);
    for (let i = 0; i < n; i++) parts['sp_' + i] = json.slice(i * CHUNK, (i + 1) * CHUNK);
    const old = await chrome.storage.sync.get('sp_meta');
    const oldN = (old.sp_meta && old.sp_meta.n) || 0;
    await chrome.storage.sync.set({ ...parts, sp_meta: { n, savedAt: new Date().toISOString(), name: p.name || '' } });
    const stale = []; for (let i = n; i < oldN; i++) stale.push('sp_' + i);
    if (stale.length) await chrome.storage.sync.remove(stale);
    return true;
  }
  async function loadProfileSync() {
    if (!hasSync) return null;
    const meta = (await chrome.storage.sync.get('sp_meta')).sp_meta;
    if (!meta || !meta.n) return null;
    const keys = Array.from({ length: meta.n }, (_, i) => 'sp_' + i);
    const got = await chrome.storage.sync.get(keys);
    try { return { profile: JSON.parse(keys.map((k) => got[k] || '').join('')), savedAt: meta.savedAt }; } catch (e) { return null; }
  }
  async function clearProfileSync() {
    if (!hasSync) return;
    const meta = (await chrome.storage.sync.get('sp_meta')).sp_meta;
    const keys = ['sp_meta', ...Array.from({ length: (meta && meta.n) || 0 }, (_, i) => 'sp_' + i)];
    await chrome.storage.sync.remove(keys);
  }
  // Ask the browser not to evict our data under storage pressure (web version).
  function persist() { try { if (!hasChrome && navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ } }

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

  root.SM = root.SM || {};
  root.SM.store = { KEY, load, save, clearAll, emptyState, merge, uid, isExtension: !!hasChrome, hasSync, saveProfileSync, loadProfileSync, clearProfileSync, persist };
})(typeof self !== 'undefined' ? self : globalThis);
