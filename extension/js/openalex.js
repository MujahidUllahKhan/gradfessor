// Free paper lookup through OpenAlex (open scholarly database, CC0 data).
// Runs from the student's own browser, so each student uses their own free daily allowance:
// no key = $0.10/day (about 100 professor lookups), free key = $1/day. Nothing costs the project owner.
(function (root) {
  const API = 'https://api.openalex.org';

  function cleanName(n) {
    return String(n || '').replace(/\(.*?\)/g, '').replace(/\b(dr|prof|professor)\.?\s+/gi, '').replace(/,?\s*(ph\.?d\.?|p\.?e\.?)\s*$/i, '').replace(/\s+/g, ' ').trim();
  }

  function tokens(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['university', 'the', 'and', 'college', 'institute', 'school', 'department', 'state'].includes(w)); }

  function instMatch(author, university) {
    if (!university) return 0;
    const want = new Set(tokens(university));
    if (!want.size) return 0;
    const names = [
      ...(author.last_known_institutions || []).map((i) => i.display_name),
      ...(author.affiliations || []).map((a) => a.institution && a.institution.display_name)
    ].filter(Boolean);
    let best = 0;
    names.forEach((n) => {
      const t = tokens(n);
      const hit = t.filter((x) => want.has(x)).length;
      best = Math.max(best, t.length ? hit / Math.max(want.size, 1) : 0);
    });
    return best;
  }

  function pickAuthor(results, name, university) {
    const want = cleanName(name).toLowerCase();
    const last = want.split(' ').pop();
    const scored = (results || []).map((a) => {
      const dn = String(a.display_name || '').toLowerCase();
      let s = 0;
      if (dn === want) s += 3; else if (dn.includes(last)) s += 1.5;
      s += instMatch(a, university) * 4;
      s += Math.min(1, (a.works_count || 0) / 50);
      return { a, s };
    }).sort((x, y) => y.s - x.s);
    if (!scored.length) return null;
    // Without a university match, only accept an exact-name hit.
    const top = scored[0];
    if (university && instMatch(top.a, university) === 0 && top.s < 3.5) return null;
    return top.a;
  }

  function abstractFrom(inv) {
    if (!inv || typeof inv !== 'object') return '';
    const words = [];
    Object.entries(inv).forEach(([w, pos]) => pos.forEach((p) => { words[p] = w; }));
    return words.filter(Boolean).join(' ');
  }

  async function getJson(url, key, fetchImpl) {
    const f = fetchImpl || root.fetch.bind(root);
    const u = new URL(url);
    if (key) u.searchParams.set('api_key', key);
    const r = await f(u.toString());
    if (r.status === 429) throw new Error('OpenAlex daily free limit reached. Add a free OpenAlex key in Settings or try tomorrow.');
    if (!r.ok) throw new Error('OpenAlex error ' + r.status);
    return r.json();
  }

  async function enrich(faculty, opts) {
    opts = opts || {};
    const name = cleanName(faculty.name);
    if (!name) throw new Error('No name');
    const q = new URL(API + '/authors');
    q.searchParams.set('search', name);
    q.searchParams.set('per-page', '8');
    q.searchParams.set('select', 'id,display_name,orcid,works_count,cited_by_count,summary_stats,last_known_institutions,affiliations,topics');
    const res = await getJson(q.toString(), opts.key, opts.fetch);
    const author = pickAuthor(res.results, name, faculty.university);
    if (!author) return { found: false };

    const aid = String(author.id).split('/').pop();
    const w = new URL(API + '/works');
    w.searchParams.set('filter', `author.id:${aid}`);
    w.searchParams.set('sort', 'publication_year:desc');
    w.searchParams.set('per-page', String(opts.perPage || 15));
    w.searchParams.set('select', 'id,doi,display_name,publication_year,cited_by_count,primary_location,open_access,abstract_inverted_index,keywords');
    const works = await getJson(w.toString(), opts.key, opts.fetch);

    const papers = (works.results || []).filter((x) => x.display_name);
    const links = papers.map((p) => ({
      title: p.display_name,
      year: p.publication_year,
      venue: p.primary_location && p.primary_location.source ? p.primary_location.source.display_name : '',
      url: p.doi || (p.primary_location && p.primary_location.landing_page_url) || p.id,
      pdf: (p.open_access && p.open_access.oa_url) || (p.primary_location && p.primary_location.pdf_url) || '',
      cites: p.cited_by_count || 0
    }));
    const abstracts = papers.map((p) => abstractFrom(p.abstract_inverted_index)).filter(Boolean).map((a) => a.slice(0, 700)).join('\n').slice(0, 6000);
    const keywords = [...new Set(papers.flatMap((p) => (p.keywords || []).map((k) => k.display_name)))].slice(0, 20);
    const topics = (author.topics || []).slice(0, 8).map((t) => t.display_name);
    const inst = (author.last_known_institutions || [])[0];
    return {
      found: true,
      openalex: {
        id: author.id, name: author.display_name, orcid: author.orcid || '', works: author.works_count, cited: author.cited_by_count,
        hIndex: author.summary_stats ? author.summary_stats.h_index : null, institution: inst ? inst.display_name : '', fetchedAt: new Date().toISOString()
      },
      papers: links.map((l) => `${l.title} (${l.year || 'n.d.'})`).join('\n'),
      paperLinks: links,
      abstracts,
      topics: topics.concat(keywords).join(', ')
    };
  }

  root.SM = root.SM || {};
  root.SM.openalex = { enrich, pickAuthor, abstractFrom, cleanName, instMatch };
})(typeof self !== 'undefined' ? self : globalThis);
