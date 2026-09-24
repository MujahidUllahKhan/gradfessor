// Helpers for the department scanner. No DOM needed, so they run in the
// background service worker, in pages, and in Node tests.
(function (root) {
  const GENERIC_2LD = new Set(['edu', 'ac', 'co', 'gov', 'org', 'com', 'net', 'res', 'sch']);

  // "cs.umich.edu" -> "umich.edu"; "www.nust.edu.pk" -> "nust.edu.pk"; "ox.ac.uk" -> "ox.ac.uk"
  function siteBase(hostname) {
    const parts = String(hostname || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    if (parts.length <= 2) return parts.join('.');
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (tld.length === 2 && GENERIC_2LD.has(sld)) return parts.slice(-3).join('.');
    return parts.slice(-2).join('.');
  }

  function permissionOrigins(hostname) {
    const base = siteBase(hostname);
    return [`https://${base}/*`, `https://*.${base}/*`, `http://${base}/*`, `http://*.${base}/*`];
  }

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: '...' };
  function decodeEntities(s) {
    return s
      .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch (e) { return ' '; } })
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch (e) { return ' '; } })
      .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] != null ? ENTITIES[n.toLowerCase()] : m));
  }

  // HTML -> readable text with line breaks at block elements (service workers have no DOMParser).
  function htmlToText(html) {
    let h = String(html || '');
    const main = h.match(/<main[\s\S]*?<\/main>/i);
    if (main && main[0].length > 400) h = main[0];
    h = h
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|nav|footer|form|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|hr)\b[^>]*>/gi, '\n')
      .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|td|th|section|article|header|dd|dt|blockquote|table)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    return decodeEntities(h)
      .split('\n')
      .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  function firstTag(html, tag) {
    const m = String(html || '').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
  }

  function mailtos(html) {
    const out = [];
    const re = /mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    let m;
    while ((m = re.exec(String(html || '')))) if (!out.includes(m[1])) out.push(m[1]);
    return out;
  }

  function guessTitle(text) {
    const m = String(text || '').match(/\b((?:Distinguished |Regents'? |University |Emeritus )?(?:Assistant |Associate |Full |Research |Teaching |Adjunct |Visiting |Clinical )?Professor(?: Emeritus)?|Lecturer|Senior Lecturer|Research Scientist|Department (?:Head|Chair)|Instructor)\b/);
    return m ? m[1] : '';
  }

  // ---- robots.txt ----
  function parseRobots(txt) {
    const groups = [];
    let cur = null;
    let lastWasAgent = false;
    String(txt || '').split(/\r?\n/).forEach((raw) => {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) return;
      const idx = line.indexOf(':');
      if (idx < 0) return;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (key === 'user-agent') {
        if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
        cur.agents.push(val.toLowerCase());
        lastWasAgent = true;
        return;
      }
      lastWasAgent = false;
      if (!cur) return;
      if (key === 'disallow' || key === 'allow') cur.rules.push({ allow: key === 'allow', path: val });
    });
    const star = groups.filter((g) => g.agents.includes('*'));
    return star.flatMap((g) => g.rules).filter((r) => r.path !== '' || r.allow);
  }

  function ruleRegex(path) {
    const esc = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + (esc.endsWith('\\$') ? esc.slice(0, -2) + '$' : esc));
  }

  function robotsAllowed(rules, pathWithQuery) {
    let best = null;
    for (const r of rules || []) {
      if (!r.path) continue;
      if (ruleRegex(r.path).test(pathWithQuery)) {
        if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
      }
    }
    return !best || best.allow;
  }

  root.SM = root.SM || {};
  root.SM.scan = { siteBase, permissionOrigins, htmlToText, firstTag, mailtos, guessTitle, parseRobots, robotsAllowed, decodeEntities };
})(typeof self !== 'undefined' ? self : globalThis);
