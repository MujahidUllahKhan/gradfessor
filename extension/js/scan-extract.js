// Injected into a faculty directory page when the student clicks "Scan whole department".
// Finds the links that point to individual faculty profiles. Returns a plain object
// (the value of this file is the value of the last expression).
(() => {
  const NAV_WORDS = /^(home|about( us)?|contact( us)?|news|events?|faculty|staff|people|directory|research|apply( now)?|give|donate|search|menu|log ?in|more|read more|view (full )?profile|profile|email|website|cv|next|previous|back|students?|alumni|courses?|programs?|admissions?|undergraduate|graduate|departments?|centers?|labs?|resources|careers|jobs|visit|calendar|faculty & staff|emeriti|all people)$/i;
  const PARTICLES = /^(de|van|von|da|del|della|di|la|le|bin|bint|al|el|ul|ullah|khan|abu|dos|das|du|ter|ten|mac|mc)$/i;

  function nameLike(raw) {
    let t = String(raw || '').replace(/\s+/g, ' ').trim();
    t = t.replace(/^(dr\.?|prof\.?|professor)\s+/i, '').replace(/,?\s*(ph\.?\s?d\.?|p\.?\s?e\.?|m\.?d\.?|dr\.)$/i, '').trim();
    if (t.length < 5 || t.length > 60) return null;
    if (/\d|@|\||:|\/|\?|!|\(|\)/.test(t)) return null;
    if (NAV_WORDS.test(t)) return null;
    if (/,/.test(t)) { const [last, first] = t.split(',').map((s) => s.trim()); if (last && first) t = `${first} ${last}`; }
    const w = t.split(' ');
    if (w.length < 2 || w.length > 5) return null;
    const ok = w.every((x) => /^[\p{Lu}][\p{L}'’.\-]*$/u.test(x) || PARTICLES.test(x) || /^[\p{Lu}]\.$/u.test(x));
    return ok ? t : null;
  }

  const base = (() => {
    const p = location.hostname.replace(/^www\./, '').split('.');
    if (p.length > 2 && p[p.length - 1].length === 2 && ['edu', 'ac', 'co', 'gov', 'org', 'com'].includes(p[p.length - 2])) return p.slice(-3).join('.');
    return p.slice(-2).join('.');
  })();

  const here = location.href.split('#')[0];
  const items = [];
  document.querySelectorAll('a[href]').forEach((a) => {
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
    if (!/^https?:$/.test(url.protocol)) return;
    const host = url.hostname.replace(/^www\./, '');
    if (!(host === base || host.endsWith('.' + base))) return;
    const clean = url.href.split('#')[0];
    if (clean === here) return;
    if (/\.(pdf|jpe?g|png|gif|docx?|pptx?|zip|ics)$/i.test(url.pathname)) return;
    let name = nameLike(a.innerText || a.textContent);
    if (!name) {
      let el = a;
      for (let i = 0; i < 4 && el && !name; i++) {
        el = el.parentElement;
        if (!el) break;
        const h = el.querySelector('h2, h3, h4, h5, strong, b, [class*="name" i], [class*="title" i]');
        if (h && el.querySelectorAll('a[href]').length <= 6) name = nameLike(h.innerText || h.textContent);
      }
    }
    if (!name) return;
    const pattern = url.hostname + url.pathname.replace(/\/[^/]+\/?$/, '/*');
    items.push({ name, url: clean, pattern });
  });

  const groups = {};
  items.forEach((i) => { (groups[i.pattern] = groups[i.pattern] || []).push(i); });
  const ranked = Object.values(groups).sort((a, b) => b.length - a.length);
  let chosen = ranked[0] && ranked[0].length >= 3 ? ranked[0] : items;
  // Merge other big groups that share the same parent path (e.g. /people/faculty/* and /people/emeriti/*)
  if (ranked[0] && ranked[0].length >= 3) {
    ranked.slice(1).forEach((g) => { if (g.length >= 3) chosen = chosen.concat(g); });
  }
  const seen = new Set();
  const links = [];
  chosen.forEach((i) => { if (!seen.has(i.url)) { seen.add(i.url); links.push({ name: i.name, url: i.url }); } });

  const h1 = document.querySelector('h1');
  const site = document.querySelector('meta[property="og:site_name"]');
  return {
    links: links.slice(0, 80),
    found: links.length,
    title: document.title,
    heading: h1 ? h1.innerText.trim() : '',
    site: site ? site.getAttribute('content') : '',
    url: location.href,
    hostname: location.hostname
  };
})();
