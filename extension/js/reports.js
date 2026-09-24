// Per-university reports: everything a student knows about one university in one Excel file
// and one Word file (programs, requirements vs. their profile, best-fit professors, outreach, checklist).
(function (root) {
  const M = root.SM.matcher;
  const RQ = root.SM.requirements;
  const TR = root.SM.tracker;
  const FONT = { name: 'Arial', size: 10 };
  const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E5A6B' } };
  const fill = (hex) => ({ type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF' + hex }, fgColor: { argb: 'FF' + hex } });

  function key(name) { return String(name || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

  function group(state) {
    const map = new Map();
    const get = (name) => {
      const k = key(name) || 'unassigned';
      if (!map.has(k)) map.set(k, { key: k, name: name || 'University not set', programs: [], professors: [], contacts: [] });
      return map.get(k);
    };
    (state.applications || []).forEach((a) => get(a.university).programs.push(a));
    (state.faculty || []).forEach((f) => { get(f.university).professors.push({ f, r: M.score(state.profile, f) }); });
    (state.contacts || []).forEach((c) => { if (c.university) get(c.university).contacts.push(c); });
    const list = [...map.values()];
    list.forEach((u) => {
      u.professors.sort((a, b) => b.r.overall - a.r.overall);
      const dls = u.programs.map((p) => TR.daysLeft(p.deadline)).filter((d) => d != null && d >= 0);
      u.nextDays = dls.length ? Math.min(...dls) : null;
      u.fees = u.programs.reduce((s, p) => s + (Number(p.fee) || 0), 0);
      u.best = u.professors[0] || null;
      u.flags = u.programs.flatMap((p) => RQ.eligibility(p, state.profile)).filter((c) => c.level === 'bad').length;
    });
    return list.sort((a, b) => (a.nextDays ?? 9999) - (b.nextDays ?? 9999) || (b.best ? b.best.r.overall : 0) - (a.best ? a.best.r.overall : 0));
  }

  const safeSheet = (s) => String(s).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  const dateOrNull = (s) => { const d = TR.parse(s); return d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null; };
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

  function sheet(wb, name, cols, rows, opts) {
    const ws = wb.addWorksheet(safeSheet(name), opts || {});
    ws.columns = cols.map((c) => ({ header: c.h, key: c.k, width: c.w || 14 }));
    const hr = ws.getRow(1);
    hr.height = 30;
    hr.eachCell((c) => { c.font = { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEAD; c.alignment = { vertical: 'middle', wrapText: true }; });
    rows.forEach((r) => ws.addRow(r));
    ws.eachRow((row, n) => { if (n > 1) row.eachCell({ includeEmpty: true }, (c) => { c.font = c.font && c.font.color ? c.font : FONT; c.alignment = { vertical: 'top', wrapText: true }; }); });
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
  }

  function scoreColors(ws, col, n) {
    if (n < 1) return;
    ws.addConditionalFormatting({ ref: `${col}2:${col}${n + 1}`, rules: [
      { type: 'cellIs', operator: 'greaterThanOrEqual', priority: 1, formulae: ['75'], style: { fill: fill('D1F0DF') } },
      { type: 'cellIs', operator: 'between', priority: 2, formulae: ['50', '74.99'], style: { fill: fill('FDECC8') } },
      { type: 'cellIs', operator: 'lessThan', priority: 3, formulae: ['50'], style: { fill: fill('F8D7DA') } }
    ] });
  }

  const PROGRAM_COLS = [
    { h: 'University', k: 'university', w: 24 }, { h: 'Program', k: 'program', w: 26 }, { h: 'Degree', k: 'degree', w: 8 }, { h: 'Term', k: 'term', w: 10 },
    { h: 'Deadline', k: 'deadline', w: 12 }, { h: 'Days left', k: 'days', w: 8 }, { h: 'Funding deadline', k: 'fundingDeadline', w: 12 },
    { h: 'Fee (USD)', k: 'fee', w: 9 }, { h: 'Fee waiver', k: 'feeWaiver', w: 13 }, { h: 'IELTS min', k: 'ieltsMin', w: 8 }, { h: 'TOEFL min', k: 'toeflMin', w: 8 },
    { h: 'Duolingo min', k: 'duolingoMin', w: 9 }, { h: 'GRE', k: 'greReq', w: 11 }, { h: 'Min GPA', k: 'minGpa', w: 8 }, { h: 'Letters', k: 'lorsRequired', w: 7 },
    { h: 'Documents', k: 'docsRequired', w: 30 }, { h: 'Status', k: 'status', w: 12 }, { h: 'My eligibility', k: 'elig', w: 50 }, { h: 'Program page', k: 'portal', w: 30 }
  ];

  function programRows(programs, profile) {
    return programs.map((p) => ({
      ...p,
      deadline: dateOrNull(p.deadline), fundingDeadline: dateOrNull(p.fundingDeadline),
      fee: num(p.fee), ieltsMin: num(p.ieltsMin), toeflMin: num(p.toeflMin), duolingoMin: num(p.duolingoMin), minGpa: num(p.minGpa), lorsRequired: num(p.lorsRequired),
      elig: RQ.eligibility(p, profile).map((c) => `${c.level === 'good' ? '✓' : c.level === 'bad' ? '✗' : '!'} ${c.text}`).join('\n'),
      portal: p.portal ? { text: p.portal, hyperlink: p.portal } : null
    }));
  }

  function finishPrograms(ws, n) {
    for (let r = 2; r <= n + 1; r++) {
      ws.getCell(`F${r}`).value = { formula: `IF(E${r}="","",E${r}-TODAY())` };
      ['E', 'G'].forEach((c) => { ws.getCell(`${c}${r}`).numFmt = 'yyyy-mm-dd'; });
      ws.getCell(`H${r}`).numFmt = '$#,##0';
    }
    if (n) ws.addConditionalFormatting({ ref: `F2:F${n + 1}`, rules: [
      { type: 'expression', priority: 1, formulae: ['AND(ISNUMBER(F2),F2<0)'], style: { fill: fill('E5E7EB') } },
      { type: 'expression', priority: 2, formulae: ['AND(ISNUMBER(F2),F2<=14)'], style: { fill: fill('F8D7DA'), font: { bold: true, color: { argb: 'FF9B1C1C' } } } },
      { type: 'expression', priority: 3, formulae: ['AND(ISNUMBER(F2),F2<=30)'], style: { fill: fill('FDECC8') } }
    ] });
  }

  const PROF_COLS = [
    { h: 'University', k: 'university', w: 22 }, { h: 'Rank', k: 'rank', w: 6 }, { h: 'Professor', k: 'name', w: 24 }, { h: 'Title', k: 'title', w: 18 }, { h: 'Email', k: 'email', w: 24 },
    { h: 'Match', k: 'overall', w: 7 }, { h: 'Verdict', k: 'verdict', w: 9 }, { h: 'Topic fit', k: 'topic', w: 7 }, { h: 'Evidence', k: 'evidence', w: 8 },
    { h: 'Methods', k: 'methods', w: 8 }, { h: 'Style', k: 'style', w: 7 }, { h: 'Shared keywords', k: 'overlap', w: 30 }, { h: 'Gap keywords', k: 'gaps', w: 30 },
    { h: 'Recent papers', k: 'papers', w: 50 }, { h: 'Outreach stage', k: 'stage', w: 14 }, { h: 'Profile page', k: 'url', w: 28 }
  ];

  function profRows(u, contacts) {
    return u.professors.map(({ f, r }, i) => {
      const c = contacts.find((x) => x.facultyId === f.id || (x.name && x.name === f.name));
      const papers = (f.paperLinks && f.paperLinks.length ? f.paperLinks.map((p) => `${p.title} (${p.year || 'n.d.'})`) : String(f.papers || '').split('\n')).filter(Boolean).slice(0, 3).join('\n');
      return {
        university: u.name, rank: i + 1, name: f.name, title: f.title, email: f.email, overall: r.overall, verdict: r.verdict,
        topic: r.axes.topic, evidence: r.axes.evidence, methods: r.axes.methods, style: r.axes.style,
        overlap: r.overlap.join(', '), gaps: r.gaps.map((g) => g.term).join(', '), papers, stage: c ? c.stage : '',
        url: f.url ? { text: f.url, hyperlink: f.url } : null
      };
    });
  }

  function profileSheet(wb, profile) {
    const p = profile || {};
    const t = p.tests || {};
    const rows = [
      ['Name', p.name], ['Target', `${p.targetDegree || ''} ${p.field || ''} ${p.targetTerm || ''}`.trim()],
      ...(p.education || []).map((e, i) => [`Degree ${i + 1}`, [e.degree, e.field, e.institution, e.year, e.gpa ? `GPA ${e.gpa}/${e.scale || '4.0'}` : ''].filter(Boolean).join(' | ')]),
      ['IELTS', t.ielts && t.ielts.overall ? `${t.ielts.overall} (L ${t.ielts.l || '-'}, R ${t.ielts.r || '-'}, W ${t.ielts.w || '-'}, S ${t.ielts.s || '-'})` : ''],
      ['TOEFL iBT', (t.toefl && t.toefl.total) || ''], ['Duolingo', t.duolingo || ''], ['PTE', (t.pte && t.pte.overall) || ''],
      ['GRE', t.gre && (t.gre.v || t.gre.q) ? `V ${t.gre.v || '-'} Q ${t.gre.q || '-'} AW ${t.gre.aw || '-'}` : ''],
      ['Research interests', p.interests], ['Skills', p.skills],
      ['Courses', (p.courses || []).map((c) => `${c.name}${c.grade ? ` (${c.grade})` : ''}`).join(', ') || p.coursework]
    ];
    const ws = wb.addWorksheet('My profile');
    ws.columns = [{ width: 22 }, { width: 90 }];
    rows.forEach(([k, v], i) => { ws.getCell(`A${i + 1}`).value = k; ws.getCell(`A${i + 1}`).font = { ...FONT, bold: true }; ws.getCell(`B${i + 1}`).value = v || ''; ws.getCell(`B${i + 1}`).font = FONT; ws.getCell(`B${i + 1}`).alignment = { wrapText: true }; });
  }

  function checklistSheet(wb, programs) {
    const items = ['Statement of purpose', 'Research statement', 'CV', 'Transcripts', 'English test score sent', 'GRE score sent', 'Recommender 1 asked', 'Recommender 2 asked', 'Recommender 3 asked', 'Fee paid or waiver granted', 'Application submitted'];
    const ws = wb.addWorksheet('Checklist');
    ws.columns = [{ header: 'Program', width: 34 }, { header: 'Item', width: 30 }, { header: 'Status', width: 14 }, { header: 'Notes', width: 40 }];
    ws.getRow(1).eachCell((c) => { c.font = { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEAD; });
    let r = 2;
    programs.forEach((p) => items.forEach((it) => {
      if (it.startsWith('GRE') && p.greReq && p.greReq !== 'Required') return;
      ws.addRow([`${p.university}: ${p.program || p.degree || ''}`, it, 'Not started', '']);
      ws.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Not started,In progress,Done,N/A"'] };
      r++;
    }));
    if (r > 2) ws.addConditionalFormatting({ ref: `C2:C${r - 1}`, rules: [
      { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"Done"'], style: { fill: fill('D1F0DF') } },
      { type: 'cellIs', operator: 'equal', priority: 2, formulae: ['"In progress"'], style: { fill: fill('FDECC8') } }
    ] });
  }

  function universityWorkbook(ExcelJS, u, state) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Gradfessor by Afridi';
    wb.calcProperties = { fullCalcOnLoad: true };
    const s = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF0E5A6B' } } });
    s.columns = [{ width: 32 }, { width: 70 }];
    s.getCell('A1').value = u.name; s.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0E5A6B' } };
    s.getCell('A2').value = `Prepared ${new Date().toLocaleDateString()} with Gradfessor by Afridi`; s.getCell('A2').font = { ...FONT, italic: true };
    const best = u.professors.slice(0, 3).map(({ f, r }) => `${f.name} (${r.overall}, ${r.verdict})`).join('; ');
    [['Programs tracked', u.programs.length], ['Next deadline', u.nextDays != null ? `in ${u.nextDays} days` : 'none set'], ['Application fees (USD)', u.fees],
      ['Fee waiver available', u.programs.some((p) => p.feeWaiver === 'Available') ? 'Yes, ask before paying' : 'Not found'], ['Professors ranked', u.professors.length],
      ['Best-fit professors', best || 'Scan the department to rank professors'], ['Requirements you do not meet yet', u.flags]]
      .forEach(([k, v], i) => { const r = i + 4; s.getCell(`A${r}`).value = k; s.getCell(`A${r}`).font = { ...FONT, bold: true }; s.getCell(`B${r}`).value = v; s.getCell(`B${r}`).font = FONT; });
    s.getCell('A12').value = 'Match scores compare the text of your profile with each professor’s interests and papers. They are guides, not admission predictions.';
    s.getCell('A12').font = { ...FONT, italic: true, color: { argb: 'FF5A6776' } };
    const pr = programRows(u.programs, state.profile);
    finishPrograms(sheet(wb, 'Programs & requirements', PROGRAM_COLS, pr), pr.length);
    const fr = profRows(u, state.contacts || []);
    scoreColors(sheet(wb, 'Professors', PROF_COLS, fr), 'F', fr.length);
    checklistSheet(wb, u.programs);
    profileSheet(wb, state.profile);
    return wb;
  }

  function allWorkbook(ExcelJS, unis, state) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Gradfessor by Afridi';
    wb.calcProperties = { fullCalcOnLoad: true };
    const over = unis.map((u) => ({ university: u.name, programs: u.programs.length, next: u.nextDays != null ? u.nextDays : null, fees: u.fees,
      waiver: u.programs.some((p) => p.feeWaiver === 'Available') ? 'Available' : '', profs: u.professors.length,
      best: u.best ? `${u.best.f.name} (${u.best.r.overall})` : '', bestScore: u.best ? u.best.r.overall : null, flags: u.flags }));
    const ws = sheet(wb, 'Overview', [
      { h: 'University', k: 'university', w: 28 }, { h: 'Programs', k: 'programs', w: 9 }, { h: 'Days to next deadline', k: 'next', w: 12 }, { h: 'Fees (USD)', k: 'fees', w: 10 },
      { h: 'Fee waiver', k: 'waiver', w: 11 }, { h: 'Professors ranked', k: 'profs', w: 10 }, { h: 'Best-fit professor', k: 'best', w: 30 }, { h: 'Best match', k: 'bestScore', w: 9 },
      { h: 'Requirements not met', k: 'flags', w: 11 }
    ], over, { properties: { tabColor: { argb: 'FF0E5A6B' } } });
    scoreColors(ws, 'H', over.length);
    const allPrograms = unis.flatMap((u) => u.programs);
    const pr = programRows(allPrograms, state.profile);
    finishPrograms(sheet(wb, 'All programs', PROGRAM_COLS, pr), pr.length);
    const fr = unis.flatMap((u) => profRows(u, state.contacts || []));
    scoreColors(sheet(wb, 'All professors', PROF_COLS, fr), 'F', fr.length);
    checklistSheet(wb, allPrograms);
    profileSheet(wb, state.profile);
    return wb;
  }

  // ---------- Word report ----------
  function universityDoc(D, u, state) {
    const p = state.profile || {};
    const t = p.tests || {};
    const P = (text, o) => new D.Paragraph({ children: [new D.TextRun({ text: String(text == null ? '' : text), ...(o || {}) })], spacing: { after: 80 } });
    const H = (text, level) => new D.Paragraph({ text, heading: level || D.HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 } });
    const B = (text) => new D.Paragraph({ text: String(text), bullet: { level: 0 } });
    const cell = (text, bold, shade, width) => new D.TableCell({
      width: width ? { size: width, type: D.WidthType.PERCENTAGE } : undefined,
      children: String(text == null ? '' : text).split('\n').map((line) => new D.Paragraph({ children: [new D.TextRun({ text: line, bold: !!bold, size: 19, color: shade === '0E5A6B' ? 'FFFFFF' : '1F2A36' })] })),
      shading: shade ? { fill: shade, type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 }
    });
    const table = (head, rows) => new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      rows: [new D.TableRow({ tableHeader: true, children: head.map((h) => cell(h, true, '0E5A6B')) }), ...rows.map((r) => new D.TableRow({ children: r.map((c) => cell(c)) }))]
    });
    const kv = (rows) => new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: rows.map(([k, v]) => new D.TableRow({ children: [cell(k, true, 'E6EEF1', 32), cell(v, false, null, 68)] })) });

    const kids = [];
    kids.push(new D.Paragraph({ text: u.name, heading: D.HeadingLevel.TITLE }));
    kids.push(P(`Application report for ${p.name || 'you'} · ${new Date().toLocaleDateString()} · Gradfessor by Afridi`, { italics: true, color: '5A6776', size: 18 }));

    kids.push(H('Your profile at a glance'));
    const e0 = (p.education || [])[0];
    kids.push(kv([
      ['Target', `${p.targetDegree || ''} in ${p.field || '-'} (${p.targetTerm || '-'})`],
      ['Latest degree', e0 ? `${e0.degree} ${e0.field}, ${e0.institution}${e0.gpa ? `, GPA ${e0.gpa}/${e0.scale || '4.0'}` : ''}` : '-'],
      ['English', [t.ielts && t.ielts.overall ? `IELTS ${t.ielts.overall}` : '', t.toefl && t.toefl.total ? `TOEFL ${t.toefl.total}` : '', t.duolingo ? `Duolingo ${t.duolingo}` : ''].filter(Boolean).join(' · ') || '-'],
      ['GRE', t.gre && (t.gre.v || t.gre.q) ? `V ${t.gre.v || '-'} · Q ${t.gre.q || '-'} · AW ${t.gre.aw || '-'}` : '-'],
      ['Research interests', p.interests || '-']
    ]));

    kids.push(H('Programs and requirements'));
    if (!u.programs.length) kids.push(P('No program saved yet. Open the program’s admissions page and click "Capture program requirements" in the extension.'));
    u.programs.forEach((a) => {
      kids.push(H(`${a.degree ? a.degree + ' – ' : ''}${a.program || 'Program'}`, D.HeadingLevel.HEADING_3));
      kids.push(kv([
        ['Deadline', a.deadline ? `${a.deadline}${TR.daysLeft(a.deadline) != null ? ` (${TR.daysLeft(a.deadline)} days left)` : ''}` : '-'],
        ['Funding / priority deadline', a.fundingDeadline || '-'],
        ['Application fee', a.fee ? `$${a.fee}${a.feeWaiver ? ` · fee waiver: ${a.feeWaiver}` : ''}` : '-'],
        ['English minimum', a.englishMin || [a.ieltsMin && `IELTS ${a.ieltsMin}`, a.toeflMin && `TOEFL ${a.toeflMin}`, a.duolingoMin && `Duolingo ${a.duolingoMin}`].filter(Boolean).join(' / ') || '-'],
        ['GRE', a.greReq || '-'], ['Minimum GPA', a.minGpa || '-'], ['Letters of recommendation', a.lorsRequired || '-'],
        ['Documents', a.docsRequired || '-'], ['Program page', a.portal || '-']
      ]));
      const el = RQ.eligibility(a, p);
      if (el.length) { kids.push(P('Your eligibility', { bold: true })); el.forEach((c) => kids.push(B(`${c.level === 'good' ? '✓' : c.level === 'bad' ? '✗' : '!'} ${c.text}`))); }
    });

    kids.push(H('Best-fit professors'));
    if (!u.professors.length) kids.push(P('No professors yet. Open the department’s faculty page and click "Scan whole department" in the extension.'));
    else {
      kids.push(table(['#', 'Professor', 'Match', 'Shared keywords', 'Email'], u.professors.slice(0, 12).map(({ f, r }, i) => [i + 1, `${f.name}${f.title ? '\n' + f.title : ''}`, `${r.overall} (${r.verdict})`, r.overlap.slice(0, 5).join(', '), f.email || '-'])));
      u.professors.slice(0, 3).forEach(({ f, r }) => {
        kids.push(H(`${f.name} – ${r.overall}/100`, D.HeadingLevel.HEADING_3));
        r.rationale.forEach((x) => kids.push(B(x)));
        if (r.gaps.length) kids.push(P(`Their keywords missing from your profile (add only if true): ${r.gaps.map((g) => g.term).join(', ')}`, { italics: true }));
        const papers = (f.paperLinks && f.paperLinks.length ? f.paperLinks.map((x) => `${x.title} (${x.year || 'n.d.'})`) : String(f.papers || '').split('\n')).filter(Boolean).slice(0, 4);
        if (papers.length) { kids.push(P('Recent papers to read before you email', { bold: true })); papers.forEach((x) => kids.push(B(x))); }
      });
    }

    const cs = (state.contacts || []).filter((c) => key(c.university) === u.key);
    if (cs.length) {
      kids.push(H('Professor outreach'));
      kids.push(table(['Professor', 'Stage', 'Emailed', 'Reply', 'Interview'], cs.map((c) => [c.name, c.stage || '', c.sentDate || '-', c.replyDate ? `${c.replyDate} ${c.replyType || ''}` : '-', c.interviewDate || '-'])));
    }

    kids.push(H('Next steps'));
    const steps = [];
    u.programs.forEach((a) => {
      if (a.feeWaiver === 'Available') steps.push(`Email the graduate school to request a fee waiver for ${a.program || 'this program'} before paying $${a.fee || ''}.`);
      if (a.lorsRequired) steps.push(`Ask ${a.lorsRequired} recommenders now and give them your CV and the ${a.deadline || ''} deadline.`);
    });
    u.professors.slice(0, 3).forEach(({ f }) => steps.push(`Read two recent papers by ${f.name}, then send one personal email (Gradfessor → Draft email).`));
    if (!steps.length) steps.push('Capture the program page and scan the department to fill this report.');
    steps.forEach((x) => kids.push(B(x)));
    kids.push(P('Scores compare text overlap between your profile and each professor’s work. They are guides, not admission predictions. Always confirm requirements on the official program page.', { italics: true, color: '5A6776', size: 16 }));

    return new D.Document({
      creator: 'Gradfessor by Afridi', title: `${u.name} report`,
      styles: { default: { document: { run: { font: 'Calibri', size: 21 } } } },
      sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: kids }]
    });
  }

  const fileSafe = (s) => String(s || 'University').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

  root.SM = root.SM || {};
  root.SM.reports = { group, universityWorkbook, allWorkbook, universityDoc, fileSafe, key };
})(typeof self !== 'undefined' ? self : globalThis);
