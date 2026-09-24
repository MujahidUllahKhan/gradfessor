// Small text toolkit shared by the matcher and the writing coach.
// Pure functions, no DOM, so they run in the browser and in Node tests.
(function (root) {
  const STOP = new Set((
    'a about above after again against all also am an and any are as at be because been before being below between both but by ' +
    'can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into ' +
    'is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should so some ' +
    'such than that the their theirs them then there these they this those through to too under until up very was we were what when ' +
    'where which while who whom why will with would you your yours et al using use used based via within without toward towards ' +
    'new novel study studies approach approaches method methods paper papers research work works result results analysis model models ' +
    'system systems data application applications problem problems case framework frameworks toward among across one two three ' +
    'first second high low large small also may however thus well able many much several various including include includes ' +
    'journal conference proceedings ieee acm international vol pp doi cited citations year years professor prof dr department university ' +
    'lab laboratory group interests interest current currently areas area include email phone office page home publications publication selected recent students student associate assistant full faculty engineering science sciences ' +
    'experience skills project projects course courses gpa ielts toefl gre'
  ).split(/\s+/));

  // Very light stemmer: enough to join "optimization/optimizations", "networks/network", "learning/learned" is left alone.
  function stem(w) {
    if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && w.endsWith('sses')) return w.slice(0, -2);
    if (w.endsWith('ics') || w.endsWith('sis')) return w;
    if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
    return w;
  }

  function words(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9+#\-\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/^-+|-+$/g, ''))
      .filter(Boolean);
  }

  // Terms = unigrams (non-stopword, len>2, not pure numbers) + bigrams of adjacent content words.
  // Bigrams never cross punctuation or line breaks, so "supply chain, stochastic" gives no "chain stochastic".
  function terms(text) {
    const out = [];
    String(text || '').split(/[\n\r,;:.!?()\[\]{}"\u201c\u201d|/\u2022\u00b7]+/).forEach((seg) => {
      let prev = null;
      for (const raw of words(seg)) {
        const isContent = raw.length > 2 && !STOP.has(raw) && !/^\d+$/.test(raw);
        if (isContent) {
          const t = stem(raw);
          out.push(t);
          if (prev) out.push(prev + ' ' + t);
          prev = t;
        } else {
          prev = null;
        }
      }
    });
    return out;
  }

  function tf(text, weight) {
    const m = new Map();
    const w = weight == null ? 1 : weight;
    for (const t of terms(text)) {
      const inc = (t.includes(' ') ? 1.5 : 1) * w;
      m.set(t, (m.get(t) || 0) + inc);
    }
    return m;
  }

  function addInto(a, b) {
    for (const [k, v] of b) a.set(k, (a.get(k) || 0) + v);
    return a;
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const [, v] of a) na += v * v;
    for (const [, v] of b) nb += v * v;
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    for (const [k, v] of small) { const o = big.get(k); if (o) dot += v * o; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // Top keywords: repeated bigrams first (they are more specific), then unigrams not already covered.
  function topTerms(map, k) {
    const entries = [...map.entries()];
    const bigrams = entries.filter(([t, v]) => t.includes(' ') && v >= 2.2).sort((x, y) => y[1] - x[1]);
    const out = [];
    const covered = new Set();
    for (const [t, v] of bigrams) {
      if (out.length >= Math.ceil(k / 2)) break;
      const parts = t.split(' ');
      if (parts.every((p) => covered.has(p))) continue;
      parts.forEach((p) => covered.add(p));
      out.push({ term: t, weight: v });
    }
    const unigrams = entries.filter(([t, v]) => !t.includes(' ') && v >= 1 && !covered.has(t)).sort((x, y) => y[1] - x[1]);
    for (const [t, v] of unigrams) {
      if (out.length >= k) break;
      out.push({ term: t, weight: v });
    }
    return out.sort((x, y) => y.weight - x.weight);
  }

  function sentences(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);
  }

  function wordCount(text) {
    const m = String(text || '').trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  function splitList(text) {
    return String(text || '')
      .split(/[\n,;•·]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function containsTerm(textTermsSet, term) {
    if (textTermsSet.has(term)) return true;
    return false;
  }

  function termSet(text) { return new Set(terms(text)); }

  function titleCase(s) { return String(s).replace(/\b\w/g, (c) => c.toUpperCase()); }

  root.SM = root.SM || {};
  root.SM.text = { STOP, stem, words, terms, tf, addInto, cosine, topTerms, sentences, wordCount, splitList, termSet, containsTerm, titleCase };
})(typeof self !== 'undefined' ? self : globalThis);
