// CV upload: reads PDF / DOCX / TXT on the student's own computer (nothing is uploaded anywhere)
// and suggests profile values. The student reviews every suggestion before it is applied.
(function (root) {
  async function fileToText(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdfToText(await file.arrayBuffer());
    if (name.endsWith('.docx')) {
      if (!root.mammoth) throw new Error('Word reader not loaded');
      const r = await root.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return r.value || '';
    }
    if (name.endsWith('.doc')) throw new Error('Old .doc files are not supported. Save it as .docx or PDF first.');
    return file.text();
  }

  async function pdfToText(buf) {
    const pdfjs = await import(new URL('lib/pdf.min.mjs', document.baseURI).href);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('lib/pdf.worker.min.mjs', document.baseURI).href;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 15); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let lastY = null;
      let line = '';
      const lines = [];
      tc.items.forEach((it) => {
        const y = it.transform ? Math.round(it.transform[5]) : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; }
        line += (line && !line.endsWith(' ') && it.str && !it.str.startsWith(' ') ? ' ' : '') + it.str;
        lastY = y;
        if (it.hasEOL) { lines.push(line); line = ''; lastY = null; }
      });
      if (line) lines.push(line);
      pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'));
    }
    return pages.join('\n');
  }

  // ---------- Suggestions from CV text ----------
  function section(text, names) {
    const lines = String(text || '').split(/\n/);
    const idx = lines.findIndex((l) => new RegExp(`^\\s*(${names})\\s*:?\\s*$`, 'i').test(l.trim()) || new RegExp(`^\\s*(${names})\\s*:`, 'i').test(l.trim()));
    if (idx < 0) return '';
    const out = [];
    const first = lines[idx].split(':').slice(1).join(':').trim();
    if (first) out.push(first);
    for (let i = idx + 1; i < lines.length && out.length < 25; i++) {
      const l = lines[i].trim();
      if (/^[A-Z][A-Za-z &/]{2,40}:?$/.test(l) && l === l.toUpperCase()) break; // next ALL-CAPS heading
      if (/^(education|experience|research experience|work experience|publications?|projects?|awards?|honou?rs|teaching|references|certifications?|languages|interests|research interests|skills|technical skills|coursework|relevant coursework)\s*:?$/i.test(l)) break;
      if (l) out.push(l);
    }
    return out.join('\n');
  }

  function extract(text) {
    const t = String(text || '');
    const one = (re) => { const m = t.match(re); return m ? m : null; };
    const s = {};
    const email = one(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (email) s.email = email[0];
    const li = one(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_\-%]+/i); if (li) s.linkedin = li[0];
    const gh = one(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_\-]+/i); if (gh) s.github = gh[0];
    const gs = one(/(?:https?:\/\/)?scholar\.google\.[a-z.]+\/citations\?user=[A-Za-z0-9_\-]+/i); if (gs) s.scholar = gs[0];
    const firstLine = t.split('\n').map((l) => l.trim()).find((l) => l.length > 3);
    if (firstLine && /^[A-Z][A-Za-z.'\- ]{3,60}$/.test(firstLine) && firstLine.split(' ').length <= 6) s.name = firstLine;

    const gpa = one(/\b(?:c?gpa|grade point average)\b[^0-9]{0,15}(\d\.\d{1,2})\s*(?:\/|out of)\s*(\d(?:\.\d{1,2})?)/i) || one(/(\d\.\d{1,2})\s*\/\s*(4\.0|4|5\.0|5)\s*(?:c?gpa)?/i);
    if (gpa) { s.gpa = gpa[1]; s.gpaScale = gpa[2]; }

    const ielts = one(/ielts[^0-9\n]{0,40}(\d(?:\.\d)?)/i);
    if (ielts && Number(ielts[1]) >= 4 && Number(ielts[1]) <= 9) s.ielts = ielts[1];
    const ieltsBands = {};
    [['l', 'listening'], ['r', 'reading'], ['w', 'writing'], ['s', 'speaking']].forEach(([k, w]) => {
      const m = t.match(new RegExp(`${w}[^0-9\\n]{0,6}(\\d(?:\\.\\d)?)`, 'i'));
      if (m && Number(m[1]) >= 4 && Number(m[1]) <= 9 && ielts) ieltsBands[k] = m[1];
    });
    if (Object.keys(ieltsBands).length) s.ieltsBands = ieltsBands;
    const toefl = one(/toefl[^0-9\n]{0,30}(\d{2,3})/i); if (toefl && Number(toefl[1]) <= 120) s.toefl = toefl[1];
    const duo = one(/duolingo[^0-9\n]{0,30}(\d{2,3})/i); if (duo && Number(duo[1]) <= 160) s.duolingo = duo[1];
    const greLine = t.split('\n').find((l) => /\bgre\b/i.test(l));
    if (greLine) {
      const v = greLine.match(/(?:verbal|\bv\b)[^0-9]{0,6}(1[3-7]\d)/i);
      const q = greLine.match(/(?:quant(?:itative)?|\bq\b)[^0-9]{0,6}(1[3-7]\d)/i);
      const aw = greLine.match(/(?:aw|awa|analytical writing|writing)[^0-9]{0,6}([0-6](?:\.\d)?)/i);
      if (v || q) s.gre = { v: v ? v[1] : '', q: q ? q[1] : '', aw: aw ? aw[1] : '' };
    }

    // Degrees: lines that look like "MS in Industrial Engineering, New Mexico State University, 2025"
    const degRe = /\b(Ph\.?\s?D\.?|Doctor(?:ate)?|M\.?\s?S\.?c?|M\.?\s?Phil|Master(?:'s)?(?: of [A-Za-z]+)?|MEng|MBA|B\.?\s?S\.?c?|B\.?\s?E\.?|B\.?\s?Tech|Bachelor(?:'s)?(?: of [A-Za-z]+)?)\b/;
    const edu = [];
    t.split('\n').forEach((l, i, arr) => {
      if (edu.length >= 4) return;
      const m = l.match(degRe);
      if (!m || l.length > 200) return;
      const ctx = [l, arr[i + 1] || ''].join(' ');
      const inst = ctx.match(/([A-Z][A-Za-z&.' -]*(?:University|Institute|College|School)[A-Za-z&.' -]*|(?:University|Institute) of [A-Z][A-Za-z&.' -]+)/);
      if (!inst) return;
      const year = ctx.match(/\b(19[89]\d|20[0-4]\d)\b(?!.*\b(19[89]\d|20[0-4]\d)\b)/);
      const field = l.match(/\b(?:in|of)\s+([A-Z][A-Za-z &]+?)(?:,|\(|\s+-|\s+at\b|$)/);
      let deg = m[1].replace(/\s+/g, '').replace(/\./g, '');
      deg = /^ph/i.test(deg) || /^doctor/i.test(deg) ? 'PhD' : /^m/i.test(deg) ? (/mba/i.test(deg) ? 'MBA' : /meng/i.test(deg) ? 'MEng' : /mphil/i.test(deg) ? 'MPhil' : 'MS') : 'BS';
      const near = [l, arr[i + 1] || '', arr[i + 2] || ''].join(' ');
      const g = near.match(/\b(?:c?gpa)\b[^0-9]{0,10}(\d\.\d{1,2})\s*(?:\/|out of)\s*(\d(?:\.\d{1,2})?)/i);
      edu.push({ degree: deg, field: field ? field[1].trim() : '', institution: inst[1].trim().replace(/[,.]$/, ''), year: year ? year[1] : '', gpa: g ? g[1] : '', scale: g ? g[2] : '4.0' });
    });
    if (edu.length) s.education = edu;

    const skills = section(t, 'technical skills|skills|skills & tools|tools');
    if (skills) s.skills = skills.replace(/\n/g, ', ').replace(/\s*[•·|]\s*/g, ', ').replace(/,\s*,/g, ',').slice(0, 600);
    const interests = section(t, 'research interests|interests');
    if (interests) s.interests = interests.replace(/\n/g, ', ').slice(0, 400);
    const courses = section(t, 'relevant coursework|coursework|graduate coursework|courses');
    if (courses) s.coursework = courses.replace(/\n/g, ', ').slice(0, 600);
    const pubs = section(t, 'publications|selected publications|journal publications|papers');
    if (pubs) s.publications = pubs.slice(0, 2500);
    const awards = section(t, 'awards|honors|honours|awards and honors|awards & honors|scholarships');
    if (awards) s.awards = awards.slice(0, 1200);
    return s;
  }

  root.SM = root.SM || {};
  root.SM.cvimport = { fileToText, extract, section };
})(typeof self !== 'undefined' ? self : globalThis);
