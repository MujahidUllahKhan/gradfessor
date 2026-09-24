// Reads an admissions / program page (text the student captured) and pulls out the numbers
// students care about: deadlines, fee, fee waiver, English tests, GRE/GMAT, minimum GPA,
// letters and documents. Every value keeps the sentence it came from, so the student can check it.
(function (root) {
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

  function sentences(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .split(/\n+|(?<=[.!?;])\s+(?=[A-Z0-9(])/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 2);
  }

  function iso(y, m, d) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

  // Returns [{date:'YYYY-MM-DD', raw}] found in one sentence. Missing year -> next occurrence after `today`.
  function findDates(s, today) {
    const out = [];
    const now = today || new Date();
    const pick = (y, m, d, raw) => {
      if (m < 0 || m > 11 || d < 1 || d > 31) return;
      let year = y;
      if (!year) {
        year = now.getFullYear();
        const cand = new Date(year, m, d);
        const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (cand < t0) year += 1;
      }
      out.push({ date: iso(year, m, d), raw });
    };
    let m;
    const re1 = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?`, 'gi');
    while ((m = re1.exec(s))) pick(m[3] ? Number(m[3]) : null, MONTHS[m[1].toLowerCase().slice(0, 3)], Number(m[2]), m[0]);
    const re2 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?(?:,?\\s*(20\\d{2}))?`, 'gi');
    while ((m = re2.exec(s))) pick(m[3] ? Number(m[3]) : null, MONTHS[m[2].toLowerCase().slice(0, 3)], Number(m[1]), m[0]);
    const re3 = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g; // US style M/D/YYYY
    while ((m = re3.exec(s))) pick(Number(m[3]), Number(m[1]) - 1, Number(m[2]), m[0]);
    const re4 = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
    while ((m = re4.exec(s))) pick(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[0]);
    return out;
  }

  function firstNumberIn(s, re, lo, hi) {
    const m = s.match(re);
    if (!m) return null;
    const nums = (m[0].match(/\d{1,3}(?:\.\d)?/g) || []).map(Number).filter((n) => n >= lo && n <= hi);
    return nums.length ? nums[0] : null;
  }
  // Text window after a keyword that does not stop at decimal points ("6.5")
  const WIN = '(?:[^.;]|\\.(?=\\d)){0,140}';
  function numberAfter(s, key, lo, hi) {
    const m = s.match(new RegExp(key + WIN, 'i'));
    if (!m) return null;
    const nums = (m[0].match(/\d{1,3}(?:\.\d)?/g) || []).map(Number).filter((n) => n >= lo && n <= hi);
    return nums.length ? nums[0] : null;
  }

  function parse(text, meta) {
    meta = meta || {};
    const S = sentences(text);
    const low = (s) => s.toLowerCase();
    const r = { evidence: {}, deadlines: [], docs: [] };
    const note = (k, s) => { if (!r.evidence[k]) r.evidence[k] = s.slice(0, 220); };

    // ---- Deadlines ----
    S.forEach((s) => {
      const l = low(s);
      if (!/deadline|\bdue\b|apply|applica|admission|submit|priority|closing date|last date|\bfall\b|\bspring\b/.test(l)) return;
      if (/updated|posted|last modified|©|copyright|webinar|info(?:rmation)? session|open house|orientation|classes (?:begin|start)|semester (?:begins|starts)|event/.test(l)) return;
      findDates(s, meta.today).forEach((d) => {
        let label = 'Application deadline';
        if (/fund|assistantship|scholarship|fellowship/.test(l)) label = 'Funding / priority deadline';
        else if (/priority/.test(l)) label = 'Priority deadline';
        const tags = [];
        if (/international/.test(l)) tags.push('international');
        if (/domestic/.test(l)) tags.push('domestic');
        if (/\bfall\b|autumn/.test(l)) tags.push('fall');
        if (/\bspring\b/.test(l)) tags.push('spring');
        if (/\bsummer\b/.test(l)) tags.push('summer');
        r.deadlines.push({ label, date: d.date, tags, source: s.slice(0, 220) });
      });
    });
    const upcoming = r.deadlines.filter((d) => d.label === 'Application deadline');
    const pickBest = (list) => {
      const score = (d) => (d.tags.includes('international') ? 3 : 0) + (d.tags.includes('fall') ? 1 : 0) - (d.tags.includes('domestic') ? 3 : 0);
      return [...list].sort((a, b) => score(b) - score(a) || a.date.localeCompare(b.date))[0];
    };
    const main = pickBest(upcoming.length ? upcoming : r.deadlines.filter((d) => d.label === 'Priority deadline'));
    if (main) { r.deadline = main.date; note('deadline', main.source); }
    const fund = r.deadlines.filter((d) => d.label !== 'Application deadline').sort((a, b) => a.date.localeCompare(b.date))[0];
    if (fund && fund.date !== r.deadline) { r.fundingDeadline = fund.date; note('fundingDeadline', fund.source); }

    S.forEach((s) => {
      const l = low(s);
      // ---- Fee ----
      if (r.fee == null && /application fee|fee of|non-?refundable|processing fee/.test(l)) {
        const m = s.match(/(?:\$|USD\s?|US\$)\s?(\d{2,3})(?:\.\d{2})?|(\d{2,3})\s?(?:USD|US dollars|dollars)/i);
        if (m) { r.fee = Number(m[1] || m[2]); note('fee', s); }
      }
      // ---- Fee waiver ----
      if (/fee waiver|waive(?:d|r)? (?:the )?(?:application )?fee|fee (?:is |may be )?waived/.test(l)) {
        const neg = /(not|no|n't|unable to|do not|does not|cannot) (?:\w+ ){0,3}(?:offer|provide|grant|available|accept|waive)|no fee waivers?|not eligible/.test(l);
        const cond = /eligible|may|if |qualify|request|mcnair|veteran|financial need|domestic/.test(l);
        const v = neg ? 'Not available' : 'Available';
        if (!r.feeWaiver || (r.feeWaiver === 'Available' && neg)) { r.feeWaiver = v; r.evidence.feeWaiver = s.slice(0, 220); }
        if (cond && !neg) r.feeWaiverNote = 'Check eligibility: ' + s.slice(0, 160);
      }
      // ---- English tests ----
      if (/ielts/.test(l)) {
        const v = numberAfter(s, 'ielts', 5, 9);
        if (v != null && r.ieltsMin == null) { r.ieltsMin = v; note('ieltsMin', s); }
        const band = s.match(/(?:no (?:band|section|sub-?score|module)s? (?:score )?(?:below|lower than|less than|under)|each (?:band|section|module)(?: score)?(?: of)?(?: at least)?|all (?:bands|sections)(?: of)?(?: at least)?|sub-?scores? of(?: at least)?|individual (?:band|section)s?(?: scores?)?(?: of)?(?: at least)?)\s*(\d(?:\.\d)?)/i);
        if (band && Number(band[1]) >= 4 && Number(band[1]) <= 9 && r.ieltsBand == null) r.ieltsBand = Number(band[1]);
      }
      if (/toefl/.test(l) && r.toeflMin == null) {
        const v = numberAfter(s, 'toefl', 60, 120);
        if (v != null) { r.toeflMin = v; note('toeflMin', s); }
      }
      if (/duolingo|\bdet\b/.test(l) && r.duolingoMin == null) {
        const v = numberAfter(s, '(?:duolingo|\\bdet\\b)', 80, 160);
        if (v != null) { r.duolingoMin = v; note('duolingoMin', s); }
      }
      if (/\bpte\b/.test(l) && r.pteMin == null) {
        const v = numberAfter(s, '\\bpte\\b', 36, 90);
        if (v != null) { r.pteMin = v; note('pteMin', s); }
      }
      // ---- GRE / GMAT ----
      if (/\bgre\b/.test(l) && !r.greReq) {
        let v = null;
        if (/(not|no longer) (?:be )?(?:accepted|considered|reviewed)|do(?:es)? not (?:accept|consider|review)|will not be (?:considered|reviewed)/.test(l)) v = 'Not accepted';
        else if (/waive/.test(l)) v = 'Waived';
        else if (/optional|not required|no longer required|is not required|are not required|not needed/.test(l)) v = 'Optional';
        else if (/required|must submit|mandatory/.test(l)) v = 'Required';
        if (v) { r.greReq = v; note('greReq', s); }
      }
      if (/\bgmat\b/.test(l) && !r.gmatReq) {
        if (/optional|not required/.test(l)) r.gmatReq = 'Optional';
        else if (/required/.test(l)) r.gmatReq = 'Required';
      }
      // ---- Minimum GPA ----
      if (/\bgpa\b|grade point average/.test(l) && r.minGpa == null) {
        const m = s.match(/(?:minimum|at least|of|above|required)[^.;]{0,40}?(\d\.\d{1,2})|(\d\.\d{1,2})[^.;]{0,25}(?:minimum|or higher|or above|or better)/i);
        const v = m ? Number(m[1] || m[2]) : null;
        if (v && v >= 2 && v <= 4.5) { r.minGpa = v; note('minGpa', s); }
      }
      // ---- Letters ----
      if (/letters? of (?:recommendation|reference)|recommendation letters?|references|recommenders/.test(l) && r.lorsRequired == null) {
        const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
        const m = l.match(/\b(one|two|three|four|five|[1-5])\b[^.;]{0,30}?(?:letters?|recommend|references|recommenders)/);
        if (m) { r.lorsRequired = words[m[1]] || Number(m[1]); note('lorsRequired', s); }
      }
    });

    // ---- Documents ----
    const all = low(String(text || ''));
    [
      ['Statement of purpose', /statement of purpose|\bsop\b/],
      ['Personal statement', /personal statement|personal history statement/],
      ['Research statement', /research statement|statement of research|research proposal/],
      ['CV / resume', /\bcv\b|curriculum vitae|resume|résumé/],
      ['Transcripts', /transcripts?/],
      ['Writing sample', /writing sample/],
      ['Diversity statement', /diversity statement/],
      ['Portfolio', /portfolio/]
    ].forEach(([name, re]) => { if (re.test(all)) r.docs.push(name); });

    // ---- Program / university / degree ----
    const title = String(meta.title || '');
    const parts = title.split(/\s[|\-–—]\s/).map((x) => x.trim()).filter(Boolean);
    r.university = meta.site || parts.find((x) => /universit|college|institute|school of/i.test(x)) || parts[parts.length - 1] || '';
    r.program = meta.heading || parts[0] || '';
    const degreeText = `${meta.heading || ''} ${title}`;
    r.degree = /ph\.?\s?d|doctor/i.test(degreeText) ? 'PhD' : /\bm\.?\s?s\b|master|\bmeng\b|\bmsc\b/i.test(degreeText) ? 'MS' : '';
    r.url = meta.url || '';

    const eng = [];
    if (r.ieltsMin) eng.push(`IELTS ${r.ieltsMin}${r.ieltsBand ? ` (no band < ${r.ieltsBand})` : ''}`);
    if (r.toeflMin) eng.push(`TOEFL ${r.toeflMin}`);
    if (r.duolingoMin) eng.push(`Duolingo ${r.duolingoMin}`);
    if (r.pteMin) eng.push(`PTE ${r.pteMin}`);
    r.englishMin = eng.join(' / ');
    r.found = ['deadline', 'fee', 'feeWaiver', 'ieltsMin', 'toeflMin', 'duolingoMin', 'greReq', 'minGpa', 'lorsRequired'].filter((k) => r[k] != null && r[k] !== '').length + (r.docs.length ? 1 : 0);
    return r;
  }

  // Compare a program's requirements with the student's profile.
  function eligibility(app, profile) {
    const p = profile || {};
    const t = p.tests || {};
    const out = [];
    const add = (level, text) => out.push({ level, text });
    const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
    const ielts = num(t.ielts && t.ielts.overall), toefl = num(t.toefl && t.toefl.total), duo = num(t.duolingo), pte = num(t.pte && t.pte.overall);
    const needs = [];
    if (num(app.ieltsMin) != null) needs.push(['IELTS', ielts, num(app.ieltsMin)]);
    if (num(app.toeflMin) != null) needs.push(['TOEFL', toefl, num(app.toeflMin)]);
    if (num(app.duolingoMin) != null) needs.push(['Duolingo', duo, num(app.duolingoMin)]);
    if (num(app.pteMin) != null) needs.push(['PTE', pte, num(app.pteMin)]);
    if (needs.length) {
      const have = needs.filter(([, mine]) => mine != null);
      const met = have.filter(([, mine, min]) => mine >= min);
      if (met.length) add('good', `English: your ${met.map(([n, m]) => `${n} ${m}`).join(', ')} meets the minimum (${met.map(([n, , min]) => `${n} ${min}`).join(', ')}).`);
      else if (have.length) add('bad', `English: ${have.map(([n, m, min]) => `your ${n} ${m} is below ${min}`).join('; ')}.`);
      else add('warn', `English: this program asks for ${needs.map(([n, , min]) => `${n} ${min}`).join(' or ')}. Add your score in My profile, or check if you qualify for a waiver.`);
      if (app.ieltsBand && ielts != null && t.ielts) {
        const bands = ['l', 'r', 'w', 's'].map((k) => num(t.ielts[k])).filter((v) => v != null);
        const low = bands.filter((b) => b < Number(app.ieltsBand));
        if (low.length) add('bad', `IELTS: one or more of your bands is below the ${app.ieltsBand} section minimum.`);
      }
    }
    if (app.greReq === 'Required') {
      const g = t.gre || {};
      add(g.q || g.v ? 'good' : 'bad', g.q || g.v ? `GRE required: you have V${g.v || '-'} Q${g.q || '-'}.` : 'GRE is required and your profile has no GRE score.');
    } else if (app.greReq === 'Optional') add('good', 'GRE is optional here.');
    else if (app.greReq === 'Not accepted') add('warn', 'This program does not consider GRE scores; leave them out.');
    if (num(app.minGpa) != null) {
      const e = (p.education || []).find((x) => x.gpa);
      if (e) {
        const gpa4 = (Number(e.gpa) / (Number(e.scale) || 4)) * 4;
        add(gpa4 >= Number(app.minGpa) ? 'good' : 'bad', `GPA: your ${e.gpa}/${e.scale || '4.0'} (${gpa4.toFixed(2)} on a 4.0 scale) vs minimum ${app.minGpa}.`);
      } else add('warn', `Minimum GPA ${app.minGpa}: add your GPA in My profile.`);
    }
    if (app.fee) {
      if (app.feeWaiver === 'Available') add('warn', `Application fee $${app.fee}: a fee waiver may be available. Ask before paying.`);
      else if (app.feeWaiver === 'Granted') add('good', `Fee $${app.fee} waived.`);
      else add('warn', `Application fee $${app.fee}.`);
    }
    if (num(app.lorsRequired)) add('warn', `Needs ${app.lorsRequired} recommendation letters: ask recommenders at least 4 weeks before the deadline.`);
    return out;
  }

  root.SM = root.SM || {};
  root.SM.requirements = { parse, eligibility, findDates, sentences };
})(typeof self !== 'undefined' ? self : globalThis);
