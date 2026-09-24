// Excel export (ExcelJS). The same builder makes the in-app export and the blank template
// (tools/build-template.js runs it in Node), so both files always have the same layout.
(function (root) {
  const TR = root.SM.tracker;
  const ROWS = 300; // rows pre-formatted with dropdowns and formulas
  const FONT = { name: 'Arial', size: 10 };
  const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E5A6B' } };
  const INPUT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
  const fill = (hex) => ({ type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF' + hex }, fgColor: { argb: 'FF' + hex } });

  const LISTS = {
    Status: TR.APP_STATUS, FeeWaiver: TR.FEE_WAIVER, GRE: TR.GRE, DocStatus: TR.DOC_STATUS,
    YesNo: TR.YES_NO, Stage: TR.STAGES, Reply: TR.REPLY_TYPES, Verdict: ['Strong', 'Moderate', 'Weak']
  };

  function dateOrNull(s) {
    const d = TR.parse(s);
    return d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null;
  }
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

  function header(ws, cols) {
    ws.columns = cols.map((c) => ({ header: c.h, key: c.k, width: c.w || 16 }));
    const row = ws.getRow(1);
    row.height = 30;
    row.eachCell((cell) => {
      cell.font = { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = HEAD_FILL;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }

  function listRef(name) {
    const idx = Object.keys(LISTS).indexOf(name);
    const col = String.fromCharCode(65 + idx);
    return `Lists!$${col}$2:$${col}$${LISTS[name].length + 1}`;
  }

  function dropdown(ws, colLetter, listName) {
    for (let r = 2; r <= ROWS + 1; r++) {
      ws.getCell(`${colLetter}${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [listRef(listName)],
        showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Pick from the list', error: `Choose one of: ${LISTS[listName].join(', ')}`
      };
    }
  }

  function styleBody(ws, ncols) {
    for (let r = 2; r <= ROWS + 1; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= ncols; c++) {
        const cell = row.getCell(c);
        cell.font = cell.font && cell.font.color ? cell.font : FONT;
        cell.alignment = { vertical: 'top', wrapText: c === ncols };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD9DFE6' } } };
      }
    }
  }

  function addLists(wb) {
    const ws = wb.addWorksheet('Lists', { state: 'hidden' });
    Object.entries(LISTS).forEach(([name, values], i) => {
      const col = i + 1;
      ws.getCell(1, col).value = name;
      values.forEach((v, j) => { ws.getCell(j + 2, col).value = v; });
    });
  }

  // ---------------- Dashboard ----------------
  function addDashboard(wb, state, opts) {
    const ws = wb.addWorksheet('Dashboard', { properties: { tabColor: { argb: 'FF0E5A6B' } } });
    ws.columns = [{ width: 38 }, { width: 18 }, { width: 70 }];
    ws.getCell('A1').value = 'Gradfessor by Afridi: Application Tracker';
    ws.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0E5A6B' } };
    ws.getCell('A2').value = opts.template
      ? 'Blank template. Fill the yellow columns on the Applications and Professor Outreach sheets; grey columns are formulas.'
      : `Exported ${new Date().toLocaleDateString()} from Gradfessor by Afridi. Numbers below recalculate as you edit the other sheets.`;
    ws.getCell('A2').font = { ...FONT, italic: true, color: { argb: 'FF5A6776' } };

    const A = 'Applications', O = "'Professor Outreach'";
    const rows = [
      ['APPLICATIONS', null, null, true],
      ['Programs tracked', `COUNTA(${A}!A2:A${ROWS + 1})`, 'Every row with a university name'],
      ['Submitted (or further along)', `COUNTIF(${A}!R2:R${ROWS + 1},"Submitted")+COUNTIF(${A}!R2:R${ROWS + 1},"Interview")+COUNTIF(${A}!R2:R${ROWS + 1},"Admitted")+COUNTIF(${A}!R2:R${ROWS + 1},"Rejected")+COUNTIF(${A}!R2:R${ROWS + 1},"Waitlisted")`, 'Status column'],
      ['Admitted', `COUNTIF(${A}!R2:R${ROWS + 1},"Admitted")`, ''],
      ['Deadlines in the next 14 days', `COUNTIFS(${A}!F2:F${ROWS + 1},">=0",${A}!F2:F${ROWS + 1},"<=14")`, 'Uses the Days left column'],
      ['Overdue (deadline passed, not submitted)', `COUNTIFS(${A}!F2:F${ROWS + 1},"<0",${A}!R2:R${ROWS + 1},"<>Submitted",${A}!R2:R${ROWS + 1},"<>Interview",${A}!R2:R${ROWS + 1},"<>Admitted",${A}!R2:R${ROWS + 1},"<>Rejected",${A}!R2:R${ROWS + 1},"<>Waitlisted",${A}!R2:R${ROWS + 1},"<>Withdrawn")`, 'Check these first'],
      ['Total application fees (USD)', `SUM(${A}!H2:H${ROWS + 1})`, ''],
      ['Fees waived (USD)', `SUMIF(${A}!I2:I${ROWS + 1},"Granted",${A}!H2:H${ROWS + 1})`, 'Fee waiver = Granted'],
      ['Fee waivers still available to request', `COUNTIF(${A}!I2:I${ROWS + 1},"Available")`, 'Email the graduate school before you pay'],
      ['PROFESSOR OUTREACH', null, null, true],
      ['Professors tracked', `COUNTA(${O}!A2:A${ROWS + 1})`, ''],
      ['Emails sent', `COUNT(${O}!F2:F${ROWS + 1})`, 'Rows with an email sent date'],
      ['Replies received', `COUNT(${O}!I2:I${ROWS + 1})`, 'Rows with a reply date'],
      ['Reply rate', `IF(B15=0,0,B16/B15)`, ''],
      ['Follow-ups due now', `COUNTIF(${O}!H2:H${ROWS + 1},"DUE")`, 'Follow-up status = DUE'],
      ['Interviews / calls scheduled', `COUNT(${O}!K2:K${ROWS + 1})`, ''],
      ['Confirmed support', `COUNTIF(${O}!E2:E${ROWS + 1},"Confirmed support")`, 'Professor agreed to support or fund you'],
      ['SETTINGS', null, null, true],
      ['Follow up after (business days)', null, 'Edit this number; the follow-up formulas use it']
    ];
    rows.forEach((r, i) => {
      const rowN = i + 4;
      const [label, formula, note, isHead] = r;
      const a = ws.getCell(`A${rowN}`), b = ws.getCell(`B${rowN}`), c = ws.getCell(`C${rowN}`);
      a.value = label;
      if (isHead) {
        a.font = { ...FONT, bold: true, color: { argb: 'FF0E5A6B' } };
        a.border = { bottom: { style: 'thin', color: { argb: 'FF0E5A6B' } } };
        return;
      }
      a.font = FONT;
      if (formula) { b.value = { formula }; b.font = { ...FONT, bold: true }; }
      c.value = note || null;
      c.font = { ...FONT, color: { argb: 'FF5A6776' } };
    });
    // Settings value (input cell)
    const setCell = ws.getCell('B22');
    setCell.value = Number((state.settings || {}).followUpDays) || 10;
    setCell.fill = INPUT_FILL;
    setCell.font = { ...FONT, bold: true, color: { argb: 'FF0000FF' } };
    ws.getCell('B17').numFmt = '0%';
    ws.getCell('B10').numFmt = '$#,##0';
    ws.getCell('B11').numFmt = '$#,##0';

    ws.getCell('A24').value = 'How to use';
    ws.getCell('A24').font = { ...FONT, bold: true };
    [
      'Yellow header columns are for you to fill. Grey header columns are formulas; do not type over them.',
      'Dropdowns: Status, Fee waiver, GRE, SOP/RS status, Stage and Reply type only accept listed values.',
      'Days left turns red within 7 days and amber within 21. Follow-up status shows DUE when it is time to send a polite follow-up.',
      'Match scores are text-overlap guides, not admission predictions.'
    ].forEach((t, i) => { const c = ws.getCell(`A${25 + i}`); c.value = `• ${t}`; c.font = { ...FONT, color: { argb: 'FF5A6776' } }; });
    return ws;
  }

  // ---------------- Applications ----------------
  const APP_COLS = [
    { h: 'University', k: 'university', w: 26, input: true }, { h: 'Program', k: 'program', w: 26, input: true },
    { h: 'Degree', k: 'degree', w: 9, input: true }, { h: 'Term', k: 'term', w: 11, input: true },
    { h: 'Deadline', k: 'deadline', w: 12, input: true }, { h: 'Days left', k: 'daysLeft', w: 9 },
    { h: 'Funding / priority deadline', k: 'fundingDeadline', w: 14, input: true }, { h: 'App fee (USD)', k: 'fee', w: 10, input: true },
    { h: 'Fee waiver', k: 'feeWaiver', w: 14, input: true }, { h: 'GRE', k: 'greReq', w: 12, input: true },
    { h: 'English minimum', k: 'englishMin', w: 18, input: true }, { h: 'SOP', k: 'sopStatus', w: 11, input: true },
    { h: 'Research statement', k: 'rsStatus', w: 12, input: true }, { h: 'LORs required', k: 'lorsRequired', w: 9, input: true },
    { h: 'LORs submitted', k: 'lorsSubmitted', w: 9, input: true }, { h: 'Transcripts sent', k: 'transcripts', w: 10, input: true },
    { h: 'Test scores sent', k: 'scoresSent', w: 10, input: true }, { h: 'Status', k: 'status', w: 13, input: true },
    { h: 'Portal link', k: 'portal', w: 26, input: true }, { h: 'Notes', k: 'notes', w: 40, input: true }
  ];

  function addApplications(wb, apps) {
    const ws = wb.addWorksheet('Applications', { properties: { tabColor: { argb: 'FF2F7D5B' } } });
    header(ws, APP_COLS);
    APP_COLS.forEach((c, i) => { if (!c.input) ws.getRow(1).getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A6776' } }; });
    apps.forEach((a, i) => {
      const r = i + 2;
      const row = ws.getRow(r);
      APP_COLS.forEach((c, ci) => {
        if (c.k === 'daysLeft') return;
        let v = a[c.k];
        if (['deadline', 'fundingDeadline'].includes(c.k)) v = dateOrNull(v);
        else if (['fee', 'lorsRequired', 'lorsSubmitted'].includes(c.k)) v = num(v);
        else if (c.k === 'portal' && v) v = { text: v, hyperlink: v };
        else v = v || null;
        row.getCell(ci + 1).value = v;
      });
    });
    for (let r = 2; r <= ROWS + 1; r++) {
      ws.getCell(`F${r}`).value = { formula: `IF(E${r}="","",E${r}-TODAY())` };
      ws.getCell(`E${r}`).numFmt = 'yyyy-mm-dd';
      ws.getCell(`G${r}`).numFmt = 'yyyy-mm-dd';
      ws.getCell(`H${r}`).numFmt = '$#,##0';
      ws.getCell(`F${r}`).numFmt = '0';
    }
    styleBody(ws, APP_COLS.length);
    dropdown(ws, 'I', 'FeeWaiver'); dropdown(ws, 'J', 'GRE'); dropdown(ws, 'L', 'DocStatus'); dropdown(ws, 'M', 'DocStatus');
    dropdown(ws, 'P', 'YesNo'); dropdown(ws, 'Q', 'YesNo'); dropdown(ws, 'R', 'Status');
    const rng = (c) => `${c}2:${c}${ROWS + 1}`;
    ws.addConditionalFormatting({ ref: rng('F'), rules: [
      { type: 'expression', priority: 1, formulae: ['AND(ISNUMBER(F2),F2<0)'], style: { fill: fill('E5E7EB'), font: { color: { argb: 'FF6B7280' } } } },
      { type: 'expression', priority: 2, formulae: ['AND(ISNUMBER(F2),F2<=7)'], style: { fill: fill('F8D7DA'), font: { bold: true, color: { argb: 'FF9B1C1C' } } } },
      { type: 'expression', priority: 3, formulae: ['AND(ISNUMBER(F2),F2<=21)'], style: { fill: fill('FDECC8') } }
    ] });
    ws.addConditionalFormatting({ ref: rng('R'), rules: [
      { type: 'cellIs', operator: 'equal', priority: 4, formulae: ['"Admitted"'], style: { fill: fill('D1F0DF') } },
      { type: 'cellIs', operator: 'equal', priority: 5, formulae: ['"Submitted"'], style: { fill: fill('DCEBF5') } },
      { type: 'cellIs', operator: 'equal', priority: 6, formulae: ['"Interview"'], style: { fill: fill('E9DDF7') } },
      { type: 'cellIs', operator: 'equal', priority: 7, formulae: ['"Rejected"'], style: { fill: fill('F3F4F6') } }
    ] });
    ws.addConditionalFormatting({ ref: rng('I'), rules: [
      { type: 'cellIs', operator: 'equal', priority: 8, formulae: ['"Available"'], style: { fill: fill('FDECC8') } },
      { type: 'cellIs', operator: 'equal', priority: 9, formulae: ['"Granted"'], style: { fill: fill('D1F0DF') } }
    ] });
    return ws;
  }

  // ---------------- Professor outreach ----------------
  const OUT_COLS = [
    { h: 'Professor', k: 'name', w: 24, input: true }, { h: 'University', k: 'university', w: 24, input: true },
    { h: 'Email', k: 'email', w: 24, input: true }, { h: 'Match score', k: 'matchScore', w: 8, input: true },
    { h: 'Stage', k: 'stage', w: 18, input: true }, { h: 'Email sent', k: 'sentDate', w: 12, input: true },
    { h: 'Follow-up due', k: 'followUpDue', w: 12 }, { h: 'Follow-up status', k: 'followStatus', w: 11 },
    { h: 'Reply date', k: 'replyDate', w: 12, input: true }, { h: 'Reply type', k: 'replyType', w: 18, input: true },
    { h: 'Interview / call date', k: 'interviewDate', w: 13, input: true }, { h: 'Notes', k: 'notes', w: 44, input: true }
  ];

  function addOutreach(wb, contacts) {
    const ws = wb.addWorksheet('Professor Outreach', { properties: { tabColor: { argb: 'FFB7791F' } } });
    header(ws, OUT_COLS);
    OUT_COLS.forEach((c, i) => { if (!c.input) ws.getRow(1).getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A6776' } }; });
    contacts.forEach((c, i) => {
      const row = ws.getRow(i + 2);
      OUT_COLS.forEach((col, ci) => {
        if (['followUpDue', 'followStatus'].includes(col.k)) return;
        let v = c[col.k];
        if (['sentDate', 'replyDate', 'interviewDate'].includes(col.k)) v = dateOrNull(v);
        else if (col.k === 'matchScore') v = num(v);
        else v = v || null;
        row.getCell(ci + 1).value = v;
      });
      if (c.followUpDate) row.getCell(7).value = dateOrNull(c.followUpDate); // manual override
    });
    for (let r = 2; r <= ROWS + 1; r++) {
      const g = ws.getCell(`G${r}`);
      if (!g.value) g.value = { formula: `IF(OR(F${r}="",I${r}<>""),"",WORKDAY(F${r},Dashboard!$B$22))` };
      ws.getCell(`H${r}`).value = { formula: `IF(G${r}="","",IF(I${r}<>"","Replied",IF(G${r}<=TODAY(),"DUE","Waiting")))` };
      ['F', 'G', 'I', 'K'].forEach((c) => { ws.getCell(`${c}${r}`).numFmt = 'yyyy-mm-dd'; });
    }
    styleBody(ws, OUT_COLS.length);
    dropdown(ws, 'E', 'Stage'); dropdown(ws, 'J', 'Reply');
    const rng = (c) => `${c}2:${c}${ROWS + 1}`;
    ws.addConditionalFormatting({ ref: rng('H'), rules: [
      { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"DUE"'], style: { fill: fill('F8D7DA'), font: { bold: true, color: { argb: 'FF9B1C1C' } } } },
      { type: 'cellIs', operator: 'equal', priority: 2, formulae: ['"Replied"'], style: { fill: fill('D1F0DF') } }
    ] });
    ws.addConditionalFormatting({ ref: rng('D'), rules: [
      { type: 'cellIs', operator: 'greaterThanOrEqual', priority: 3, formulae: ['75'], style: { fill: fill('D1F0DF') } },
      { type: 'cellIs', operator: 'between', priority: 4, formulae: ['50', '74.99'], style: { fill: fill('FDECC8') } },
      { type: 'cellIs', operator: 'lessThan', priority: 5, formulae: ['50'], style: { fill: fill('F8D7DA') } }
    ] });
    const stageColors = { 'Identified': 'F3F4F6', 'Email drafted': 'FEF9C3', 'Email sent': 'FDECC8', 'Follow-up sent': 'FDE2C8', 'Replied': 'E9DDF7', 'Interview scheduled': 'DCEBF5', 'Confirmed support': 'D1F0DF', 'Declined': 'E5E7EB', 'No response': 'E5E7EB' };
    ws.addConditionalFormatting({ ref: rng('E'), rules: Object.entries(stageColors).map(([k, v], i) => ({ type: 'cellIs', operator: 'equal', priority: 10 + i, formulae: [`"${k}"`], style: { fill: fill(v) } })) });
    return ws;
  }

  // ---------------- Match results ----------------
  function addMatches(wb, matches) {
    const ws = wb.addWorksheet('Match Results');
    const cols = [
      { h: 'Professor', k: 'name', w: 24 }, { h: 'University', k: 'university', w: 22 }, { h: 'Department', k: 'department', w: 22 },
      { h: 'Overall', k: 'overall', w: 8 }, { h: 'Verdict', k: 'verdict', w: 10 }, { h: 'Topic fit', k: 'topic', w: 8 },
      { h: 'Evidence overlap', k: 'evidence', w: 9 }, { h: 'Methods', k: 'methods', w: 8 }, { h: 'Research style', k: 'style', w: 8 },
      { h: 'Shared keywords', k: 'overlap', w: 34 }, { h: 'Gap keywords', k: 'gaps', w: 34 }, { h: 'Methods to learn / add', k: 'missing', w: 28 },
      { h: 'Profile URL', k: 'url', w: 28 }
    ];
    header(ws, cols);
    matches.forEach((m) => ws.addRow(m));
    ws.eachRow((row, n) => { if (n > 1) row.eachCell((c) => { c.font = FONT; c.alignment = { vertical: 'top', wrapText: true }; }); });
    ws.addConditionalFormatting({ ref: `D2:D${Math.max(2, matches.length + 1)}`, rules: [
      { type: 'cellIs', operator: 'greaterThanOrEqual', priority: 1, formulae: ['75'], style: { fill: fill('D1F0DF') } },
      { type: 'cellIs', operator: 'between', priority: 2, formulae: ['50', '74.99'], style: { fill: fill('FDECC8') } },
      { type: 'cellIs', operator: 'lessThan', priority: 3, formulae: ['50'], style: { fill: fill('F8D7DA') } }
    ] });
    const note = ws.getCell(`A${matches.length + 3}`);
    note.value = 'Scores are based on text overlap between your profile and the professor’s listed interests and papers. They are guides for where to look, not predictions of admission.';
    note.font = { ...FONT, italic: true, color: { argb: 'FF5A6776' } };
    return ws;
  }

  // ---------------- Profile ----------------
  function addProfile(wb, p) {
    const ws = wb.addWorksheet('My Profile');
    ws.columns = [{ width: 28 }, { width: 90 }];
    const t = p.tests || {};
    const rows = [
      ['Name', p.name], ['Email', p.email], ['Target degree', p.targetDegree], ['Target term', p.targetTerm], ['Field', p.field],
      ...(p.education || []).map((e, i) => [`Education ${i + 1}`, [e.degree, e.field, e.institution, e.year, e.gpa ? `GPA ${e.gpa}/${e.scale || '4.0'}` : ''].filter(Boolean).join(' | ')]),
      ['IELTS', t.ielts && t.ielts.overall ? `Overall ${t.ielts.overall} (L ${t.ielts.l || '-'}, R ${t.ielts.r || '-'}, W ${t.ielts.w || '-'}, S ${t.ielts.s || '-'})` : ''],
      ['TOEFL iBT', t.toefl && t.toefl.total ? String(t.toefl.total) : ''], ['Duolingo', t.duolingo || ''],
      ['GRE', t.gre && (t.gre.q || t.gre.v) ? `V ${t.gre.v || '-'}, Q ${t.gre.q || '-'}, AW ${t.gre.aw || '-'}` : ''], ['GMAT', t.gmat || ''],
      ['Research interests', p.interests], ['Skills', p.skills], ['Coursework', p.coursework], ['Publications', p.publications], ['Projects', p.projects]
    ];
    rows.forEach(([k, v], i) => {
      const a = ws.getCell(`A${i + 1}`), b = ws.getCell(`B${i + 1}`);
      a.value = k; a.font = { ...FONT, bold: true };
      b.value = v || ''; b.font = FONT; b.alignment = { wrapText: true, vertical: 'top' };
    });
    return ws;
  }

  function buildWorkbook(ExcelJS, state, opts) {
    opts = opts || {};
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Gradfessor by Afridi';
    wb.created = new Date();
    wb.calcProperties = { fullCalcOnLoad: true };
    addDashboard(wb, state, opts);
    addApplications(wb, state.applications || []);
    addOutreach(wb, state.contacts || []);
    addMatches(wb, opts.matches || []);
    addProfile(wb, state.profile || {});
    addLists(wb);
    return wb;
  }

  async function downloadXlsx(state, matches) {
    if (!root.ExcelJS) throw new Error('Excel library not loaded');
    const wb = buildWorkbook(root.ExcelJS, state, { matches });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(blob, `Gradfessor_Tracker_${stamp}.xlsx`);
  }

  function csvEscape(v) { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCsv(rows, cols) { return [cols.map((c) => csvEscape(c.h)).join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c.k])).join(','))].join('\n'); }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  root.SM = root.SM || {};
  root.SM.exporter = { buildWorkbook, downloadXlsx, toCsv, triggerDownload, APP_COLS, OUT_COLS };
})(typeof self !== 'undefined' ? self : globalThis);
