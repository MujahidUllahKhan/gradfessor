// Gradfessor by Afridi - UI wiring. Vanilla JS, no build step.
(function () {
  const { store, text: T, matcher: M, coach: C, tracker: TR, exporter: X, sample: S, bridge: B, openalex: OA, links: L, prompts: P, requirements: RQ, cvimport: CV, reports: REP } = window.SM;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  // Only http(s) links are ever rendered, so text scraped from a web page can't smuggle in a javascript: link.
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '#');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let state = store.emptyState();
  let editingProf = null;
  let editingApp = null;
  let editingCon = null;
  let docType = 'sop';
  let saveTimer = null;
  let inbox = { captures: [], jobs: [] };
  let paperQueue = [];
  let paperRunning = false;
  let prDoc = 'email';

  // ---------------- persistence ----------------
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const ok = await store.save(state);
      syncReminders();
      const el = $('#save-status');
      if (el) { el.textContent = ok ? `Saved on this computer \u00b7 ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Could not save. Use Backup now.'; el.style.color = ok ? '' : 'var(--bad)'; }
      if (ok && state.settings.syncProfile && store.hasSync) { clearTimeout(saveSoon._s); saveSoon._s = setTimeout(() => store.saveProfileSync(state.profile).catch(() => {}), 5000); }
    }, 300);
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  async function copy(textToCopy) {
    try { await navigator.clipboard.writeText(textToCopy); toast('Copied to clipboard'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = textToCopy; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copied to clipboard'); } catch (e2) { toast('Select the text and copy it manually'); }
      ta.remove();
    }
  }

  // Inline confirmation (no browser dialogs)
  function confirmInline(message, onYes) {
    const slot = $('#confirm-slot');
    slot.innerHTML = `<div class="confirm-bar"><span>${esc(message)}</span><button class="btn sm danger" data-yes>Yes, continue</button><button class="btn sm ghost" data-no>Cancel</button></div>`;
    $('[data-yes]', slot).onclick = () => { slot.innerHTML = ''; onYes(); };
    $('[data-no]', slot).onclick = () => { slot.innerHTML = ''; };
  }

  // ---------------- navigation ----------------
  function show(view) {
    $$('.nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'));
    $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + view; });
    if (view === 'match') renderProfessors();
    if (view === 'tracker') renderTracker();
    if (view === 'writing') { fillProfSelect(); analyzeDoc(); }
    if (view === 'prompts') renderPrompts();
    if (view === 'universities') renderUniversities();
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignore */ }
    window.scrollTo(0, 0);
  }
  $$('.nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

  // ---------------- profile ----------------
  function bindProfile() {
    const p = state.profile;
    $$('[data-p]').forEach((el) => {
      el.value = p[el.dataset.p] || '';
      el.oninput = () => { p[el.dataset.p] = el.value; profileChanged(); };
    });
    $$('[data-l]').forEach((el) => {
      el.value = (p.links || {})[el.dataset.l] || '';
      el.oninput = () => { p.links = p.links || {}; p.links[el.dataset.l] = el.value.trim(); profileChanged(); };
    });
    $$('[data-t]').forEach((el) => {
      const [a, b] = el.dataset.t.split('.');
      el.value = b ? ((p.tests[a] || {})[b] || '') : (p.tests[a] || '');
      el.oninput = () => {
        if (b) { p.tests[a] = p.tests[a] || {}; p.tests[a][b] = el.value.trim(); } else p.tests[a] = el.value.trim();
        validateTests(); profileChanged();
      };
    });
    renderEducation();
    renderCourses();
    applyLock();
    renderExperience();
    validateTests();
    renderCvDetected();
    updateStrength();
  }

  function validateTests() {
    const t = state.profile.tests;
    const warn = [];
    const chk = (v, lo, hi, name) => { if (v !== '' && v != null && (isNaN(Number(v)) || Number(v) < lo || Number(v) > hi)) warn.push(`${name} should be between ${lo} and ${hi}`); };
    ['overall', 'l', 'r', 'w', 's'].forEach((k) => chk((t.ielts || {})[k], 0, 9, 'IELTS ' + k.toUpperCase()));
    chk((t.gre || {}).v, 130, 170, 'GRE Verbal'); chk((t.gre || {}).q, 130, 170, 'GRE Quant'); chk((t.gre || {}).aw, 0, 6, 'GRE AW');
    chk((t.toefl || {}).total, 0, 120, 'TOEFL'); ['r', 'l', 's', 'w'].forEach((k) => chk((t.toefl || {})[k], 0, 30, 'TOEFL ' + k.toUpperCase()));
    chk(t.duolingo, 10, 160, 'Duolingo'); chk((t.pte || {}).overall, 10, 90, 'PTE'); chk(t.gmat, 200, 805, 'GMAT');
    $('#test-warn').textContent = warn.join(' · ');
  }

  function renderEducation() {
    const list = $('#edu-list');
    const edu = state.profile.education;
    if (!edu.length) { list.innerHTML = '<p class="hint">No degrees yet. Add your most recent degree first.</p>'; return; }
    list.innerHTML = edu.map((e, i) => `
      <div class="edu-row" data-i="${i}">
        <label class="field">Degree<input data-e="degree" value="${esc(e.degree)}" placeholder="MS"></label>
        <label class="field">Field<input data-e="field" value="${esc(e.field)}"></label>
        <label class="field">Institution<input data-e="institution" value="${esc(e.institution)}"></label>
        <label class="field">GPA<input data-e="gpa" value="${esc(e.gpa)}" inputmode="decimal"></label>
        <label class="field">Scale<input data-e="scale" value="${esc(e.scale || '4.0')}" inputmode="decimal"></label>
        <label class="field">Year<input data-e="year" value="${esc(e.year)}" inputmode="numeric"></label>
        <button class="btn ghost sm danger" data-del="${i}" aria-label="Remove degree">Remove</button>
      </div>`).join('');
    $$('.edu-row', list).forEach((row) => {
      const i = Number(row.dataset.i);
      $$('[data-e]', row).forEach((inp) => { inp.oninput = () => { edu[i][inp.dataset.e] = inp.value; profileChanged(); }; });
    });
    $$('[data-del]', list).forEach((b) => { b.onclick = () => { edu.splice(Number(b.dataset.del), 1); renderEducation(); profileChanged(); }; });
  }
  $('#edu-add').onclick = () => { state.profile.education.push({ degree: '', field: '', institution: '', gpa: '', scale: '4.0', year: '' }); renderEducation(); profileChanged(); };

  // ---- Coursework & experience lists ----
  function listEditor(listSel, arr, fields, rowClass, emptyText, onChange) {
    const box = $(listSel);
    if (!arr.length) { box.innerHTML = `<p class="hint">${esc(emptyText)}</p>`; return; }
    box.innerHTML = arr.map((item, i) => `<div class="row-list-item ${rowClass}" data-i="${i}">${fields.map((f) => {
      const v = esc(item[f.k] || '');
      if (f.type === 'select') return `<label class="field">${esc(f.l)}<select data-f="${f.k}">${f.o.map((o) => `<option ${o === item[f.k] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
      if (f.type === 'textarea') return `<label class="field full">${esc(f.l)}<textarea data-f="${f.k}" rows="2">${v}</textarea></label>`;
      return `<label class="field">${esc(f.l)}<input data-f="${f.k}" value="${v}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}></label>`;
    }).join('')}<button class="btn ghost sm danger" data-del="${i}">Remove</button></div>`).join('');
    $$('[data-i]', box).forEach((row) => { const i = Number(row.dataset.i); $$('[data-f]', row).forEach((inp) => { inp.oninput = () => { arr[i][inp.dataset.f] = inp.value; profileChanged(); }; }); });
    $$('[data-del]', box).forEach((b) => { b.onclick = () => { arr.splice(Number(b.dataset.del), 1); onChange(); profileChanged(); }; });
  }
  const COURSE_F = [{ k: 'name', l: 'Course', ph: 'e.g. Nonlinear Programming' }, { k: 'grade', l: 'Grade', ph: 'A / 3.7 / 85%' }, { k: 'level', l: 'Level', type: 'select', o: ['Graduate', 'Undergraduate', 'Online / MOOC'] }];
  const EXP_F = [{ k: 'role', l: 'Role', ph: 'Research Assistant' }, { k: 'org', l: 'Organization', ph: 'Lab / company / university' }, { k: 'start', l: 'From', ph: '2024' }, { k: 'end', l: 'To', ph: 'Present' }, { k: 'desc', l: 'What you did and one result', type: 'textarea' }];
  function renderCourses() { state.profile.courses = state.profile.courses || []; listEditor('#course-list', state.profile.courses, COURSE_F, 'course-row', 'No courses yet. Add your strongest advanced courses.', renderCourses); }
  function renderExperience() { state.profile.experience = state.profile.experience || []; listEditor('#exp-list', state.profile.experience, EXP_F, 'exp-row', 'No experience yet.', renderExperience); }
  $('#course-add').onclick = () => { state.profile.courses.push({ name: '', grade: '', level: 'Graduate' }); renderCourses(); profileChanged(); };
  $('#exp-add').onclick = () => { state.profile.experience.push({ role: '', org: '', start: '', end: '', desc: '' }); renderExperience(); profileChanged(); };

  // ---- CV upload with reviewable suggestions ----
  $('#cv-file').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('#cv-status').textContent = `Reading ${f.name}\u2026`;
    try {
      const text = await CV.fileToText(f);
      if (!text || text.trim().length < 40) throw new Error('No readable text found. If it is a scanned PDF, export it as text or Word first.');
      state.profile.cvText = text.trim();
      $('#p-cv').value = state.profile.cvText;
      profileChanged();
      showCvSuggestions(CV.extract(text));
      $('#cv-status').textContent = `Read ${f.name} (${T.wordCount(text)} words). Tick what you want to use, then Apply.`;
    } catch (err) {
      $('#cv-status').textContent = err.message;
    }
  };

  function showCvSuggestions(sg) {
    const p = state.profile;
    const t = p.tests || {};
    const items = [];
    const push = (id, label, value, apply) => { if (value) items.push({ id, label, value, apply }); };
    push('name', 'Name', !p.name && sg.name, () => { p.name = sg.name; });
    push('email', 'Email', !p.email && sg.email, () => { p.email = sg.email; });
    push('linkedin', 'LinkedIn', !(p.links || {}).linkedin && sg.linkedin, () => { p.links.linkedin = sg.linkedin; });
    push('github', 'GitHub', !(p.links || {}).github && sg.github, () => { p.links.github = sg.github; });
    push('scholar', 'Google Scholar', !(p.links || {}).scholar && sg.scholar, () => { p.links.scholar = sg.scholar; });
    (sg.education || []).forEach((ed, i) => {
      const exists = (p.education || []).some((x) => x.institution && ed.institution && x.institution.toLowerCase() === ed.institution.toLowerCase() && x.degree === ed.degree);
      push('edu' + i, 'Degree', !exists && [ed.degree, ed.field, ed.institution, ed.year, ed.gpa ? `GPA ${ed.gpa}/${ed.scale}` : ''].filter(Boolean).join(' \u00b7 '), () => { p.education.push({ ...ed }); });
    });
    if (!(sg.education || []).some((x) => x.gpa) && sg.gpa) push('gpa', 'GPA', `${sg.gpa}/${sg.gpaScale} (added to your first degree)`, () => { if (!p.education.length) p.education.push({ degree: '', field: '', institution: '', gpa: '', scale: '4.0', year: '' }); p.education[0].gpa = sg.gpa; p.education[0].scale = sg.gpaScale; });
    push('ielts', 'IELTS', !(t.ielts || {}).overall && sg.ielts && `${sg.ielts}${sg.ieltsBands ? ` (L ${sg.ieltsBands.l || '-'}, R ${sg.ieltsBands.r || '-'}, W ${sg.ieltsBands.w || '-'}, S ${sg.ieltsBands.s || '-'})` : ''}`, () => { p.tests.ielts = { ...(p.tests.ielts || {}), overall: sg.ielts, ...(sg.ieltsBands || {}) }; });
    push('toefl', 'TOEFL', !(t.toefl || {}).total && sg.toefl, () => { p.tests.toefl = { ...(p.tests.toefl || {}), total: sg.toefl }; });
    push('duolingo', 'Duolingo', !t.duolingo && sg.duolingo, () => { p.tests.duolingo = sg.duolingo; });
    push('gre', 'GRE', !(t.gre || {}).q && sg.gre && `V ${sg.gre.v || '-'} Q ${sg.gre.q || '-'} AW ${sg.gre.aw || '-'}`, () => { p.tests.gre = { ...sg.gre }; });
    push('interests', 'Research interests', !p.interests && sg.interests, () => { p.interests = sg.interests; });
    push('skills', 'Skills', sg.skills && sg.skills !== p.skills && sg.skills, () => { p.skills = [p.skills, sg.skills].filter(Boolean).join(', '); });
    push('courses', 'Courses', !(p.courses || []).length && sg.coursework, () => { p.courses = T.splitList(sg.coursework).slice(0, 20).map((n) => ({ name: n, grade: '', level: 'Graduate' })); });
    push('pubs', 'Publications', !p.publications && sg.publications && sg.publications.slice(0, 160) + (sg.publications.length > 160 ? '\u2026' : ''), () => { p.publications = sg.publications; });
    push('awards', 'Awards', !p.awards && sg.awards && sg.awards.slice(0, 160), () => { p.awards = sg.awards; });
    const box = $('#cv-suggest');
    box.hidden = false;
    if (!items.length) { box.innerHTML = '<p class="hint">Nothing new to fill from this CV; your profile already has these fields. The full text is saved below for matching.</p>'; return; }
    box.innerHTML = `<div>${items.map((it) => `<label class="suggest"><input type="checkbox" data-sg="${it.id}" checked><b>${esc(it.label)}</b><span>${esc(it.value)}</span></label>`).join('')}</div>
      <div class="row-actions"><button class="btn primary" id="cv-apply">Apply selected</button><button class="btn ghost" id="cv-skip">Dismiss</button></div>`;
    $('#cv-apply').onclick = () => {
      const on = new Set($$('[data-sg]', box).filter((c) => c.checked).map((c) => c.dataset.sg));
      items.filter((it) => on.has(it.id)).forEach((it) => it.apply());
      box.hidden = true; bindProfile(); saveSoon(); toast(`${on.size} field${on.size === 1 ? '' : 's'} filled from your CV`);
    };
    $('#cv-skip').onclick = () => { box.hidden = true; };
  }

  function renderCvDetected() {
    const cv = state.profile.cvText || '';
    const box = $('#cv-detected');
    if (T.wordCount(cv) < 30) { box.hidden = true; return; }
    const methods = M.detectMethods(cv);
    const have = T.splitList(state.profile.skills).map((s) => s.toLowerCase());
    const newOnes = methods.filter((m) => !have.some((h) => h.includes(m.toLowerCase()) || m.toLowerCase().includes(h)));
    const kw = T.topTerms(T.tf(cv), 12).map((t) => t.term);
    box.hidden = false;
    box.innerHTML = `
      <div class="eyebrow">Found in your CV</div>
      <div class="chips">${methods.map((m) => `<span class="chip have">${esc(m)}</span>`).join('') || '<span class="hint">No known methods detected</span>'}</div>
      <div class="eyebrow">Frequent keywords</div>
      <div class="chips">${kw.map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div>
      ${newOnes.length ? `<div><button class="btn sm" id="cv-add-skills">Add ${newOnes.length} missing method${newOnes.length > 1 ? 's' : ''} to Skills</button></div>` : ''}`;
    const b = $('#cv-add-skills');
    if (b) b.onclick = () => {
      state.profile.skills = [state.profile.skills, newOnes.join(', ')].filter(Boolean).join(', ');
      $('#p-skills').value = state.profile.skills; profileChanged(); toast('Skills updated');
    };
  }

  // ---- Profile lock: once saved, the profile only changes when the student chooses to edit ----
  function applyLock() {
    const locked = !!state.settings.profileLocked;
    $('#view-profile').classList.toggle('locked', locked);
    $('#lockbar').classList.toggle('locked', locked);
    $('#lock-title').textContent = locked ? 'Your profile is saved' : 'Editing your profile';
    $('#lock-sub').textContent = locked ? 'It stays here for every future match and report. Click Edit to change anything.' : 'Changes save automatically as you type. Lock it when you are done.';
    $('#lock-btn').textContent = locked ? 'Edit profile' : 'Done, lock my profile';
    $$('#view-profile .split input, #view-profile .split textarea, #view-profile .split select').forEach((el) => { el.disabled = locked; });
    $('#sync-wrap').hidden = !store.hasSync;
    $('#set-sync').checked = !!state.settings.syncProfile;
  }
  $('#lock-btn').onclick = () => {
    state.settings.profileLocked = !state.settings.profileLocked;
    saveSoon(); applyLock();
    toast(state.settings.profileLocked ? 'Profile locked and saved' : 'You can edit your profile now');
  };
  $('#set-sync').onchange = async (e) => {
    state.settings.syncProfile = e.target.checked; saveSoon();
    if (e.target.checked) { const ok = await store.saveProfileSync(state.profile).catch(() => false); toast(ok ? 'Profile copied to your Chrome account' : 'Could not sync (turn on Chrome sync in Chrome settings)'); }
    else { await store.clearProfileSync().catch(() => {}); toast('Chrome account copy removed'); }
  };
  async function offerSyncRestore() {
    const box = $('#restore-offer');
    const p = state.profile;
    if (!store.hasSync || p.name || (p.education || []).length) return;
    const saved = await store.loadProfileSync().catch(() => null);
    if (!saved || !saved.profile) return;
    box.hidden = false;
    box.innerHTML = `<div class="alert info"><span>We found your saved profile${saved.profile.name ? ` (${esc(saved.profile.name)})` : ''} in your Chrome account, from ${esc(String(saved.savedAt || '').slice(0, 10))}.</span><button class="btn sm primary" id="sync-restore">Restore it</button><button class="btn sm ghost" id="sync-no">Not now</button></div>`;
    $('#sync-restore').onclick = () => { state.profile = store.merge(store.emptyState(), { profile: saved.profile }).profile; state.settings.syncProfile = true; state.settings.profileLocked = true; box.hidden = true; saveSoon(); bindProfile(); applyLock(); toast('Profile restored'); };
    $('#sync-no').onclick = () => { box.hidden = true; };
  }
  function backupReminder() {
    const hasData = state.profile.name || state.applications.length || state.faculty.length;
    if (!hasData) return null;
    const last = state.settings.lastBackup;
    const days = last ? -TR.daysLeft(last) : null;
    if (days != null && days < 14) return null;
    return { kind: 'info', text: last ? `Last backup ${days} days ago. Click Backup to save a copy of your data file.` : 'Tip: click Backup once in a while to save a copy of your data file (useful if you change computers or reinstall).' };
  }

  function updateStrength() {
    const ps = M.profileStrength(state.profile);
    $('#ps-num').textContent = ps.score;
    $('#strength-num').textContent = ps.score;
    $('#strength-bar').style.width = ps.score + '%';
    $('#nav-strength').textContent = ps.score + '%';
    $('#ps-tips').innerHTML = ps.tips.length ? ps.tips.map((t) => `<li>${esc(t)}</li>`).join('') : '<li>Your profile is complete. Keep interests and projects up to date.</li>';
  }

  let cvTimer = null;
  function profileChanged() {
    updateStrength();
    clearTimeout(cvTimer); cvTimer = setTimeout(renderCvDetected, 500);
    saveSoon();
  }

  // ---------------- professors ----------------
  const F_FIELDS = ['name', 'title', 'email', 'university', 'department', 'url', 'interests', 'papers'];
  function profForm(vals) {
    F_FIELDS.forEach((k) => { $('#f-' + k).value = (vals && vals[k]) || ''; });
  }
  function readProfForm() {
    const o = {};
    F_FIELDS.forEach((k) => { o[k] = $('#f-' + k).value.trim(); });
    return o;
  }
  $('#prof-reset').onclick = () => { editingProf = null; profForm({}); $('#f-paste').value = ''; $('#prof-form-title').textContent = 'Add a professor'; };
  $('#f-parse').onclick = () => {
    const raw = $('#f-paste').value;
    if (!raw.trim()) { toast('Paste some text first'); return; }
    fillFromParsed(M.parseFacultyText(raw, {}), raw);
  };
  function fillFromParsed(parsed, raw) {
    const cur = readProfForm();
    ['name', 'email', 'interests', 'papers', 'url'].forEach((k) => { if (!cur[k] && parsed[k]) $('#f-' + k).value = parsed[k]; });
    $('#f-paste').value = raw;
    const n = parsed.papers ? parsed.papers.split('\n').length : 0;
    toast(`Found ${n} paper title${n === 1 ? '' : 's'}${parsed.email ? ' and an email' : ''}. Check the fields.`);
  }
  $('#f-save').onclick = () => {
    const o = readProfForm();
    if (!o.name) { toast('Add the professor’s name'); $('#f-name').focus(); return; }
    if (!o.interests && !o.papers && !$('#f-paste').value.trim()) { toast('Add research interests or paper titles so there is something to match'); return; }
    o.bio = $('#f-paste').value.trim().slice(0, 6000);
    if (editingProf) {
      const f = state.faculty.find((x) => x.id === editingProf);
      Object.assign(f, o);
    } else {
      state.faculty.push({ id: store.uid(), ...o, notes: '' });
    }
    editingProf = null; profForm({}); $('#f-paste').value = ''; $('#prof-form-title').textContent = 'Add a professor';
    saveSoon(); renderProfessors(); toast('Saved and scored');
  };

  function renderCapture() {
    const cap = inbox.captures.find((c) => c.kind === 'page');
    const box = $('#capture-box');
    if (!cap) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<div><b>Captured from your browser</b><div class="small muted">${esc(cap.title || cap.url)}${cap.fromSelection ? ' (selected text)' : ''}</div></div>
      <div class="row-actions"><button class="btn sm primary" id="cap-use">Use this page</button><button class="btn sm ghost" id="cap-drop">Discard</button></div>`;
    $('#cap-use').onclick = () => {
      const parsed = M.parseFacultyText(cap.text, cap);
      editingProf = null; profForm({});
      fillFromParsed(parsed, cap.text);
      $('#f-url').value = cap.url || '';
      ackCaptures([cap.id]);
    };
    $('#cap-drop').onclick = () => ackCaptures([cap.id]);
  }

  function scoredFaculty() {
    return state.faculty.map((f) => ({ f, r: M.score(state.profile, f) })).sort((a, b) => b.r.overall - a.r.overall);
  }

  function renderProfessors() {
    renderCapture();
    const list = $('#prof-list');
    const items = scoredFaculty();
    $('#nav-prof').textContent = state.faculty.length || '';
    $('#prof-count').textContent = items.length ? `Ranked matches (${items.length})` : 'Ranked matches';
    if (!items.length) {
      list.innerHTML = `<div class="card"><p class="muted">No professors yet. Add one with the form, capture a faculty page with the extension button, or click <b>Load demo data</b> to see how matching works.</p></div>`;
      return;
    }
    const axisLabel = { topic: 'Topic fit', evidence: 'Evidence overlap', methods: 'Methods', style: 'Research style' };
    list.innerHTML = items.map(({ f, r }) => {
      const cls = r.verdict.toLowerCase();
      const inTracker = state.contacts.some((c) => c.facultyId === f.id);
      return `<article class="prof" data-id="${f.id}">
        <div class="score ${cls}"><span class="n">${r.overall}</span><span class="v">${r.verdict}</span></div>
        <div class="prof-body">
          <div class="prof-head">
            <div><h3>${esc(f.name)}</h3><div class="small muted">${esc([f.title, f.department, f.university].filter(Boolean).join(' · '))}</div></div>
            <div class="row-actions">
              <button class="btn sm" data-act="email">Draft email</button>
              <button class="btn sm" data-act="track" ${inTracker ? 'disabled' : ''}>${inTracker ? 'In tracker' : 'Add to outreach'}</button>
              <button class="btn sm ghost" data-act="edit">Edit</button>
              <button class="btn sm ghost danger" data-act="del">Remove</button>
            </div>
          </div>
          <div class="axes">${Object.entries(r.axes).map(([k, v]) => `<div class="axis"><span>${axisLabel[k]} <b>${v == null ? 'n/a' : v}</b></span><div class="track"><i style="width:${v || 0}%"></i></div></div>`).join('')}</div>
          <div class="links">${L.searches(f).map((l) => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}
            <a href="#" data-act="papers">${f.openalex ? 'Refresh papers' : 'Find papers'}</a></div>
          ${f.openalex ? `<div class="oa-line">${esc(f.openalex.works || 0)} works · ${esc(f.openalex.cited || 0)} citations${f.openalex.hIndex != null ? ` · h-index ${esc(f.openalex.hIndex)}` : ''}${f.openalex.institution ? ` · ${esc(f.openalex.institution)}` : ''}</div>` : (f.paperStatus ? `<div class="oa-line">${esc(f.paperStatus)}</div>` : '')}
          ${r.overlap.length ? `<div><div class="eyebrow">You already cover</div><div class="chips">${r.overlap.map((t) => `<span class="chip have">${esc(t)}</span>`).join('')}</div></div>` : ''}
          ${r.gaps.length ? `<div><div class="eyebrow">Gap keywords</div><div class="chips">${r.gaps.map((g) => `<span class="chip gap" title="${g.papers ? `In ${g.papers} of ${g.of} listed papers` : 'From their stated interests'}">${esc(g.term)}</span>`).join('')}</div></div>` : ''}
          <details><summary>Why this score</summary><ul>${r.rationale.map((x) => `<li>${esc(x)}</li>`).join('')}
            ${r.gaps.length ? `<li>If you have real experience with ${r.gaps.slice(0, 2).map((g) => `"${esc(g.term)}"`).join(' or ')}, add it to your CV and projects. If not, don't claim it; mention it as something you want to learn.</li>` : ''}
            ${r.missingMethods.length ? `<li>Methods in their work you don't list: ${esc(r.missingMethods.join(', '))}.</li>` : ''}</ul></details>
          ${f.paperLinks && f.paperLinks.length ? `<details><summary>Recent papers (${f.paperLinks.length})</summary><ul class="paper-list">${f.paperLinks.slice(0, 12).map((pl) => `<li><a href="${esc(safeUrl(pl.url))}" target="_blank" rel="noopener">${esc(pl.title)}</a> <span class="muted">(${esc(pl.year || 'n.d.')}${pl.venue ? ', ' + esc(pl.venue) : ''})</span>${pl.pdf ? ` · <a href="${esc(safeUrl(pl.pdf))}" target="_blank" rel="noopener">PDF</a>` : ''}</li>`).join('')}</ul></details>` : ''}
        </div>
      </article>`;
    }).join('');
    $$('.prof', list).forEach((el) => {
      const f = state.faculty.find((x) => x.id === el.dataset.id);
      const r = items.find((x) => x.f.id === f.id).r;
      $$('[data-act]', el).forEach((b) => {
        b.onclick = (ev) => {
          const act = b.dataset.act;
          if (act === 'papers') { ev.preventDefault(); queuePapers([f.id], true); return; }
          if (act === 'edit') { editingProf = f.id; profForm(f); $('#f-paste').value = f.bio || ''; $('#prof-form-title').textContent = 'Edit professor'; $('#prof-form-card').scrollIntoView({ behavior: 'smooth' }); }
          if (act === 'del') confirmInline(`Remove ${f.name}?`, () => { state.faculty = state.faculty.filter((x) => x.id !== f.id); saveSoon(); renderProfessors(); });
          if (act === 'track') {
            state.contacts.push({ id: store.uid(), facultyId: f.id, name: f.name, university: f.university, email: f.email, matchScore: String(r.overall), stage: 'Identified', sentDate: '', followUpDate: '', lastFollowUp: '', replyDate: '', replyType: '', interviewDate: '', notes: '' });
            saveSoon(); renderProfessors(); updateCounts(); toast('Added to professor outreach');
          }
          if (act === 'email') { setDocType('email'); show('writing'); $('#w-prof').value = f.id; if (f.university) $('#w-uni').value = f.university; showDrafts(); }
        };
      });
    });
  }

  // ---------------- writing coach ----------------
  function fillProfSelect() {
    const sel = $('#w-prof');
    const cur = sel.value;
    sel.innerHTML = '<option value="">None</option>' + state.faculty.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    sel.value = state.faculty.some((f) => f.id === cur) ? cur : '';
  }
  function setDocType(t, noSave) {
    if (!noSave) state.docs[docType] = $('#w-text').value;
    docType = t;
    $$('#doc-seg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.doc === t ? 'true' : 'false'));
    $('#w-text').value = state.docs[t] || '';
    $('#w-type-label').textContent = C.TYPES[t].label;
    $('#w-min').value = ''; $('#w-max').value = '';
    $('#w-min').placeholder = C.TYPES[t].min; $('#w-max').placeholder = C.TYPES[t].max;
    $('#w-limit-hint').textContent = `Default ${C.TYPES[t].min}-${C.TYPES[t].max} ${C.TYPES[t].unit}. Set the program's own limit if it has one.`;
    $('#w-drafts').hidden = t !== 'email';
    $('#w-gmail').hidden = t !== 'email';
    $('#w-outlook').hidden = t !== 'email';
    $('#w-outline').hidden = t === 'email';
    $('#w-draft-list').hidden = true;
    analyzeDoc();
  }
  $$('#doc-seg button').forEach((b) => b.addEventListener('click', () => setDocType(b.dataset.doc)));

  function ctx() {
    const fid = $('#w-prof').value;
    return {
      profile: state.profile,
      faculty: state.faculty.find((f) => f.id === fid) || null,
      facultyList: state.faculty,
      targetUniversity: $('#w-uni').value,
      minWords: $('#w-min').value, maxWords: $('#w-max').value
    };
  }

  function analyzeDoc() {
    const r = C.analyze(docType, $('#w-text').value, ctx());
    $('#w-score').textContent = r.stats.words ? r.score : '–';
    $('#w-words').textContent = r.stats.words;
    $('#w-sents').textContent = r.stats.sentences;
    $('#w-avg').textContent = r.stats.avgSentence;
    $('#w-paras').textContent = r.stats.paragraphs;
    $('#w-checks').innerHTML = r.checks.map((c) => `<li class="${c.level}">${esc(c.text)}</li>`).join('');
  }
  let wTimer = null;
  $('#w-text').addEventListener('input', () => {
    state.docs[docType] = $('#w-text').value; saveSoon();
    clearTimeout(wTimer); wTimer = setTimeout(analyzeDoc, 350);
  });
  ['#w-uni', '#w-prof', '#w-min', '#w-max'].forEach((s) => $(s).addEventListener('input', analyzeDoc));

  $('#w-outline').onclick = () => {
    const o = C.outline(docType, state.profile, ctx().faculty, ctx());
    const ta = $('#w-text');
    ta.value = ta.value.trim() ? ta.value + '\n\n' + o : o;
    state.docs[docType] = ta.value; saveSoon(); analyzeDoc();
  };
  $('#w-clear').onclick = () => confirmInline('Clear this draft?', () => { $('#w-text').value = ''; state.docs[docType] = ''; saveSoon(); analyzeDoc(); });
  $('#w-prompt').onclick = () => copy(C.aiPrompt(docType, $('#w-text').value, state.profile, ctx().faculty, ctx()));
  $('#w-drafts').onclick = showDrafts;
  function composeEmail(provider) {
    const f = ctx().faculty;
    const text = $('#w-text').value;
    if (!text.trim()) { toast('Write or pick a draft first'); return; }
    if (/\[[^\]]{2,240}\]/.test(text)) { toast('Replace the [bracketed] text with your own words first'); return; }
    window.open(L.compose(provider, f ? f.email : '', text), '_blank', 'noopener');
    if (f) {
      const c = state.contacts.find((x) => x.facultyId === f.id);
      if (c && c.stage === 'Identified') { c.stage = 'Email drafted'; saveSoon(); }
      if (!c) { state.contacts.push({ id: store.uid(), facultyId: f.id, name: f.name, university: f.university, email: f.email, matchScore: String(M.score(state.profile, f).overall), stage: 'Email drafted', sentDate: '', followUpDate: '', lastFollowUp: '', replyDate: '', replyType: '', interviewDate: '', notes: '' }); saveSoon(); }
    }
    toast('After you press Send, mark it "Sent today" in the Tracker');
  }
  $('#w-gmail').onclick = () => composeEmail('gmail');
  $('#w-outlook').onclick = () => composeEmail('outlook');

  function showDrafts() {
    const f = ctx().faculty;
    const box = $('#w-draft-list');
    if (!f) { box.hidden = false; box.innerHTML = '<p class="hint">Pick a professor above so the draft can reference their work.</p>'; return; }
    const match = M.score(state.profile, f);
    const drafts = C.emailDrafts(state.profile, f, match);
    box.hidden = false;
    box.innerHTML = `<p class="hint">Starting points only. Replace the [bracketed] line with your own observation; professors can tell when an email is generic.</p>` +
      drafts.map((d, i) => `<div class="draft"><div class="card-head"><b>${esc(d.tone)}</b><div class="row-actions"><button class="btn sm primary" data-use="${i}">Edit this one</button><button class="btn sm" data-copy="${i}">Copy</button></div></div><pre>${esc(d.text)}</pre></div>`).join('');
    $$('[data-use]', box).forEach((b) => { b.onclick = () => { $('#w-text').value = drafts[b.dataset.use].text; state.docs.email = $('#w-text').value; saveSoon(); analyzeDoc(); box.hidden = true; $('#w-text').focus(); }; });
    $$('[data-copy]', box).forEach((b) => { b.onclick = () => copy(drafts[b.dataset.copy].text); });
  }

  // ---------------- tracker ----------------
  const APP_FORM = [
    { k: 'university', l: 'University', span: 2 }, { k: 'program', l: 'Program', span: 2 },
    { k: 'degree', l: 'Degree', type: 'select', o: ['PhD', 'MS', 'MS/PhD', 'MEng', 'Other'] }, { k: 'term', l: 'Term', ph: 'Fall 2027' },
    { k: 'deadline', l: 'Application deadline', type: 'date' }, { k: 'fundingDeadline', l: 'Funding / priority deadline', type: 'date' },
    { k: 'fee', l: 'Application fee (USD)', type: 'number' }, { k: 'feeWaiver', l: 'Fee waiver', type: 'select', o: TR.FEE_WAIVER },
    { k: 'greReq', l: 'GRE', type: 'select', o: TR.GRE }, { k: 'minGpa', l: 'Minimum GPA (4.0 scale)', type: 'number' },
    { k: 'ieltsMin', l: 'IELTS minimum', type: 'number' }, { k: 'toeflMin', l: 'TOEFL minimum', type: 'number' },
    { k: 'duolingoMin', l: 'Duolingo minimum', type: 'number' }, { k: 'englishMin', l: 'English notes', ph: 'e.g. no band below 6.0' },
    { k: 'docsRequired', l: 'Documents required', ph: 'SOP, CV, transcripts, writing sample', span: 4 },
    { k: 'sopStatus', l: 'SOP', type: 'select', o: TR.DOC_STATUS }, { k: 'rsStatus', l: 'Research statement', type: 'select', o: TR.DOC_STATUS },
    { k: 'lorsRequired', l: 'LORs required', type: 'number' }, { k: 'lorsSubmitted', l: 'LORs submitted', type: 'number' },
    { k: 'transcripts', l: 'Transcripts sent', type: 'select', o: TR.YES_NO }, { k: 'scoresSent', l: 'Test scores sent', type: 'select', o: TR.YES_NO },
    { k: 'status', l: 'Status', type: 'select', o: TR.APP_STATUS }, { k: 'portal', l: 'Portal link', type: 'url', span: 3 },
    { k: 'notes', l: 'Notes', type: 'textarea', span: 4 }
  ];
  const CON_FORM = [
    { k: 'name', l: 'Professor', span: 2 }, { k: 'university', l: 'University' }, { k: 'email', l: 'Email', type: 'email' },
    { k: 'stage', l: 'Stage', type: 'select', o: TR.STAGES }, { k: 'matchScore', l: 'Match score', type: 'number' },
    { k: 'sentDate', l: 'Email sent on', type: 'date' }, { k: 'lastFollowUp', l: 'Follow-up sent on', type: 'date' },
    { k: 'replyDate', l: 'Reply received on', type: 'date' }, { k: 'replyType', l: 'Reply type', type: 'select', o: [''].concat(TR.REPLY_TYPES) },
    { k: 'interviewDate', l: 'Interview / call date', type: 'date' }, { k: 'followUpDate', l: 'Custom follow-up date', type: 'date' },
    { k: 'notes', l: 'Notes (what they said, next step)', type: 'textarea', span: 4 }
  ];

  function renderForm(el, spec, prefix) {
    el.innerHTML = spec.map((f) => {
      const id = `${prefix}-${f.k}`;
      const span = f.span ? ` span${Math.min(f.span, 3)}${f.span >= 4 ? ' full' : ''}` : '';
      let ctl;
      if (f.type === 'select') ctl = `<select id="${id}">${f.o.map((o) => `<option value="${esc(o)}">${esc(o || '—')}</option>`).join('')}</select>`;
      else if (f.type === 'textarea') ctl = `<textarea id="${id}" rows="2"></textarea>`;
      else ctl = `<input id="${id}" type="${f.type || 'text'}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>`;
      return `<label class="field${span}">${esc(f.l)}${ctl}</label>`;
    }).join('');
  }
  function setForm(spec, prefix, vals) { spec.forEach((f) => { const el = $(`#${prefix}-${f.k}`); el.value = (vals && vals[f.k] != null) ? vals[f.k] : (f.type === 'select' ? f.o[0] : ''); }); }
  function getForm(spec, prefix) { const o = {}; spec.forEach((f) => { o[f.k] = $(`#${prefix}-${f.k}`).value.trim(); }); return o; }

  renderForm($('#app-form'), APP_FORM, 'a');
  renderForm($('#con-form'), CON_FORM, 'c');
  setForm(APP_FORM, 'a', { status: 'Not started', feeWaiver: 'Not available', greReq: 'Optional', transcripts: 'No', scoresSent: 'No' });
  setForm(CON_FORM, 'c', {});

  $('#app-save').onclick = () => {
    const o = getForm(APP_FORM, 'a');
    if (!o.university) { toast('Add the university name'); return; }
    if (editingApp) Object.assign(state.applications.find((a) => a.id === editingApp), o);
    else state.applications.push({ id: store.uid(), ...o });
    editingApp = null; setForm(APP_FORM, 'a', { status: 'Not started', feeWaiver: 'Not available', greReq: 'Optional', transcripts: 'No', scoresSent: 'No' });
    $('#app-form-title').textContent = 'Add a program'; $('#app-form-box').open = false;
    saveSoon(); renderTracker(); toast('Program saved');
  };
  $('#app-cancel').onclick = () => { editingApp = null; setForm(APP_FORM, 'a', { status: 'Not started' }); $('#app-form-title').textContent = 'Add a program'; $('#app-form-box').open = false; };
  $('#con-save').onclick = () => {
    const o = getForm(CON_FORM, 'c');
    if (!o.name) { toast('Add the professor’s name'); return; }
    if (o.replyDate && ['Identified', 'Email drafted', 'Email sent', 'Follow-up sent'].includes(o.stage)) o.stage = 'Replied';
    if (editingCon) Object.assign(state.contacts.find((c) => c.id === editingCon), o);
    else state.contacts.push({ id: store.uid(), facultyId: '', ...o });
    editingCon = null; setForm(CON_FORM, 'c', {}); $('#con-form-title').textContent = 'Add a professor contact'; $('#con-form-box').open = false;
    saveSoon(); renderTracker(); toast('Contact saved');
  };
  $('#con-cancel').onclick = () => { editingCon = null; setForm(CON_FORM, 'c', {}); $('#con-form-title').textContent = 'Add a professor contact'; $('#con-form-box').open = false; };
  $('#set-follow').addEventListener('input', (e) => { const n = parseInt(e.target.value, 10); if (n > 0 && n < 60) { state.settings.followUpDays = n; saveSoon(); renderTracker(true); } });

  function dayPill(d) {
    if (d == null) return '';
    if (d < 0) return `<span class="pill neutral">${-d}d ago</span>`;
    if (d <= 7) return `<span class="pill bad">${d === 0 ? 'today' : d + 'd left'}</span>`;
    if (d <= 21) return `<span class="pill warn">${d}d left</span>`;
    return `<span class="pill good">${d}d left</span>`;
  }
  const sel = (opts, val, attr) => `<select ${attr}>${opts.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;

  function eligSummary(a) {
    const el = RQ.eligibility(a, state.profile).filter((c) => !/letters|fee/i.test(c.text));
    if (!el.length) return '<span class="sub">Add requirements to compare</span>';
    const bad = el.filter((c) => c.level === 'bad').length, warn = el.filter((c) => c.level === 'warn').length;
    const pill = bad ? `<span class="pill bad">${bad} not met</span>` : warn ? `<span class="pill warn">check ${warn}</span>` : '<span class="pill good">meets all</span>';
    return `${pill}<ul class="elig">${el.map((c) => `<li class="${c.level}">${esc(c.text.replace(/^[^:]+:\s*/, ''))}</li>`).join('')}</ul>`;
  }

  function renderTracker(skipInputs) {
    const d = TR.dashboard(state);
    const fd = Number(state.settings.followUpDays) || 10;
    if (!skipInputs) $('#set-follow').value = fd;
    const tiles = [
      [d.apps, 'programs tracked'], [d.nextDeadline ? `${d.nextDeadline.days}d` : '–', d.nextDeadline ? `next deadline: ${d.nextDeadline.name}` : 'no upcoming deadline'],
      [d.dueSoon, 'deadlines in 14 days', d.dueSoon > 0], [`$${d.fees}`, `in fees${d.waived ? `, $${d.waived} waived` : ''}`],
      [d.sent, 'professor emails sent'], [`${d.replyRate}%`, `reply rate (${d.replied} replies)`],
      [d.followUps, 'follow-ups due', d.followUps > 0], [d.interviews, 'interviews / calls']
    ];
    $('#tiles').innerHTML = tiles.map(([n, l, hot]) => `<div class="tile ${hot ? 'alert-tile' : ''}"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('');

    // Applications table
    const apps = [...state.applications].sort((a, b) => (TR.daysLeft(a.deadline) ?? 9999) - (TR.daysLeft(b.deadline) ?? 9999));
    $('#app-table').innerHTML = apps.length ? `<thead><tr><th>Program</th><th>Deadline</th><th>Fee / waiver</th><th>Requirements</th><th>You vs. requirements</th><th>Documents</th><th>Status</th><th></th></tr></thead><tbody>` +
      apps.map((a) => `<tr data-id="${a.id}">
        <td><b>${esc(a.university)}</b><span class="sub">${esc([a.degree, a.program, a.term].filter(Boolean).join(' · '))}</span>${a.portal ? `<a class="small" href="${esc(safeUrl(a.portal))}" target="_blank" rel="noopener">Portal</a>` : ''}</td>
        <td class="num">${esc(a.deadline || '–')} ${dayPill(TR.daysLeft(a.deadline))}${a.fundingDeadline ? `<span class="sub">Funding: ${esc(a.fundingDeadline)}</span>` : ''}</td>
        <td class="num">${a.fee ? '$' + esc(a.fee) : '–'}<span class="sub">${esc(a.feeWaiver || '')}</span></td>
        <td><span class="sub">GRE: ${esc(a.greReq || '–')}</span><span class="sub">${esc([a.ieltsMin && 'IELTS ' + a.ieltsMin, a.toeflMin && 'TOEFL ' + a.toeflMin, a.duolingoMin && 'DET ' + a.duolingoMin].filter(Boolean).join(' / ') || a.englishMin || '')}</span>${a.minGpa ? `<span class="sub">Min GPA ${esc(a.minGpa)}</span>` : ''}</td>
        <td>${eligSummary(a)}</td>
        <td><span class="sub">SOP: ${esc(a.sopStatus || '–')}</span><span class="sub">RS: ${esc(a.rsStatus || '–')}</span><span class="sub">LORs: ${esc(a.lorsSubmitted || 0)}/${esc(a.lorsRequired || '?')}</span><span class="sub">Transcripts: ${esc(a.transcripts || 'No')} · Scores: ${esc(a.scoresSent || 'No')}</span></td>
        <td>${sel(TR.APP_STATUS, a.status, 'data-status aria-label="Status"')}</td>
        <td><div class="row-actions"><button class="btn sm ghost" data-edit>Edit</button><button class="btn sm ghost danger" data-del>Delete</button></div></td></tr>`).join('') + '</tbody>'
      : '<tbody><tr><td class="empty">No programs yet. Open "Add a program" above.</td></tr></tbody>';
    $$('#app-table tr[data-id]').forEach((tr) => {
      const a = state.applications.find((x) => x.id === tr.dataset.id);
      $('[data-status]', tr).onchange = (e) => { a.status = e.target.value; saveSoon(); renderTracker(true); };
      $('[data-edit]', tr).onclick = () => { editingApp = a.id; setForm(APP_FORM, 'a', a); $('#app-form-title').textContent = `Edit ${a.university}`; $('#app-form-box').open = true; $('#app-form-box').scrollIntoView({ behavior: 'smooth' }); };
      $('[data-del]', tr).onclick = () => confirmInline(`Delete ${a.university}?`, () => { state.applications = state.applications.filter((x) => x.id !== a.id); saveSoon(); renderTracker(true); });
    });

    // Contacts table
    const cons = state.contacts;
    $('#con-table').innerHTML = cons.length ? `<thead><tr><th>Professor</th><th>Stage</th><th>Emailed</th><th>Follow-up</th><th>Reply</th><th>Interview</th><th></th></tr></thead><tbody>` +
      cons.map((c) => {
        const due = TR.followUpDue(c, fd);
        const isDue = TR.isFollowUpDue(c, fd);
        return `<tr data-id="${c.id}">
        <td><b>${esc(c.name)}</b><span class="sub">${esc(c.university || '')}${c.matchScore ? ` · match ${esc(c.matchScore)}` : ''}</span><span class="sub">${esc(c.email || '')}</span></td>
        <td>${sel(TR.STAGES, c.stage || 'Identified', 'data-stage aria-label="Stage"')}</td>
        <td class="num">${esc(c.sentDate || '–')}${!c.sentDate ? `<button class="btn sm" data-sent>Sent today</button>` : ''}</td>
        <td class="num">${due ? esc(due) : '–'} ${isDue ? '<span class="pill bad">due</span>' : ''}${isDue ? `<button class="btn sm" data-fu>Followed up today</button>` : ''}</td>
        <td>${c.replyDate ? `<span class="num">${esc(c.replyDate)}</span><span class="sub">${esc(c.replyType || '')}</span>` : `<button class="btn sm" data-reply ${c.sentDate ? '' : 'disabled'}>Log reply</button>`}</td>
        <td class="num">${esc(c.interviewDate || '–')} ${c.interviewDate ? dayPill(TR.daysLeft(c.interviewDate)) + '<button class="btn sm" data-ics>Add to calendar</button>' : ''}</td>
        <td><div class="row-actions"><button class="btn sm ghost" data-edit>Edit</button><button class="btn sm ghost danger" data-del>Delete</button></div></td></tr>`;
      }).join('') + '</tbody>'
      : '<tbody><tr><td class="empty">No contacts yet. Add one here, or use "Add to outreach" on the Professors page.</td></tr></tbody>';
    $$('#con-table tr[data-id]').forEach((tr) => {
      const c = state.contacts.find((x) => x.id === tr.dataset.id);
      const todayIso = TR.iso(TR.today());
      $('[data-stage]', tr).onchange = (e) => { c.stage = e.target.value; saveSoon(); renderTracker(true); };
      const s = $('[data-sent]', tr); if (s) s.onclick = () => { c.sentDate = todayIso; if (['Identified', 'Email drafted'].includes(c.stage)) c.stage = 'Email sent'; saveSoon(); renderTracker(true); };
      const fu = $('[data-fu]', tr); if (fu) fu.onclick = () => { c.lastFollowUp = todayIso; c.followUpDate = ''; c.stage = 'Follow-up sent'; saveSoon(); renderTracker(true); };
      const rp = $('[data-reply]', tr); if (rp) rp.onclick = () => { editingCon = c.id; setForm(CON_FORM, 'c', { ...c, replyDate: todayIso, stage: 'Replied' }); $('#con-form-title').textContent = `Log reply from ${c.name}`; $('#con-form-box').open = true; $('#c-replyType').focus(); };
      const ic = $('[data-ics]', tr); if (ic) ic.onclick = () => X.triggerDownload(new Blob([L.ics({ title: `Interview: ${c.name}`, date: c.interviewDate, description: `${c.university || ''}\n${c.notes || ''}`, uid: c.id })], { type: 'text/calendar' }), `interview_${(c.name || 'professor').replace(/[^A-Za-z0-9]+/g, '_')}.ics`);
      $('[data-edit]', tr).onclick = () => { editingCon = c.id; setForm(CON_FORM, 'c', c); $('#con-form-title').textContent = `Edit ${c.name}`; $('#con-form-box').open = true; $('#con-form-box').scrollIntoView({ behavior: 'smooth' }); };
      $('[data-del]', tr).onclick = () => confirmInline(`Delete ${c.name} from outreach?`, () => { state.contacts = state.contacts.filter((x) => x.id !== c.id); saveSoon(); renderTracker(true); });
    });
    updateCounts();
    renderAlerts();
    renderMailInbox();
    renderReqInbox();
  }

  function updateCounts() {
    $('#nav-track').textContent = (state.applications.length + state.contacts.length) || '';
    $('#nav-prof').textContent = state.faculty.length || '';
  }

  function renderAlerts() {
    const al = TR.alerts(state).slice(0, 4);
    const br = backupReminder(); if (br) al.push(br);
    $('#alerts').innerHTML = al.map((a) => `<div class="alert ${a.kind === 'deadline' ? 'deadline' : a.kind === 'fee' || a.kind === 'info' ? 'info' : ''}">${esc(a.text)}</div>`).join('');
  }

  // ---------------- export / backup ----------------
  function matchRows() {
    return scoredFaculty().map(({ f, r }) => ({
      name: f.name, university: f.university, department: f.department, overall: r.overall, verdict: r.verdict,
      topic: r.axes.topic, evidence: r.axes.evidence, methods: r.axes.methods, style: r.axes.style,
      overlap: r.overlap.join(', '), gaps: r.gaps.map((g) => g.term).join(', '), missing: r.missingMethods.join(', '), url: f.url
    }));
  }
  $('#btn-export').onclick = async () => {
    try { await X.downloadXlsx(state, matchRows()); toast('Excel tracker downloaded'); }
    catch (e) { console.error(e); toast('Export failed: ' + e.message); }
  };
  $('#csv-apps').onclick = () => X.triggerDownload(new Blob([X.toCsv(state.applications, X.APP_COLS.filter((c) => c.k !== 'daysLeft'))], { type: 'text/csv' }), 'gradfessor_programs.csv');
  $('#csv-cons').onclick = () => X.triggerDownload(new Blob([X.toCsv(state.contacts, X.OUT_COLS.filter((c) => !['followUpDue', 'followStatus'].includes(c.k)))], { type: 'text/csv' }), 'gradfessor_outreach.csv');
  $('#btn-backup').onclick = () => {
    state.settings.lastBackup = TR.iso(TR.today()); saveSoon();
    const copyState = { ...state, settings: { ...state.settings, openalexKey: '' } };
    X.triggerDownload(new Blob([JSON.stringify(copyState, null, 2)], { type: 'application/json' }), `gradfessor_backup_${TR.iso(TR.today())}.json`);
  };
  $('#btn-restore').onclick = () => $('#restore-file').click();
  $('#restore-file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { state = store.merge(store.emptyState(), JSON.parse(r.result)); store.save(state); refreshAll(); toast('Backup restored'); }
      catch (err) { toast('That file is not a Gradfessor backup'); }
    };
    r.readAsText(f); e.target.value = '';
  };
  $('#btn-wipe').onclick = () => confirmInline('Delete all Gradfessor data from this browser? Export a backup first if you want to keep it.', async () => {
    await store.clearAll(); await store.clearProfileSync().catch(() => {}); state = store.emptyState(); refreshAll(); toast('All data deleted (including the Chrome account copy)');
  });
  $('#btn-sample').onclick = () => {
    const hasData = state.faculty.length || state.applications.length || state.profile.name;
    const load = () => {
      const s = JSON.parse(JSON.stringify(S));
      const t = TR.today();
      s.contacts[0].sentDate = TR.iso(new Date(t.getTime() - 16 * 86400000)); // shows a due follow-up
      state = { ...store.emptyState(), profile: s.profile, faculty: s.faculty, applications: s.applications, contacts: s.contacts, settings: state.settings };
      store.save(state); refreshAll(); show('match'); toast('Demo data loaded (all fictional)');
    };
    if (hasData) confirmInline('Replace your current data with the demo data?', load); else load();
  };

  function refreshAll() {
    bindSettings();
    bindProfile();
    fillProfSelect();
    setDocType(docType, true);
    renderProfessors();
    renderTracker();
    $('#nav-uni').textContent = REP.group(state).length || '';
  }

  // ================= v0.2: extension connection, department scans, papers, email inbox, prompts =================
  function syncReminders() {
    if (!booted || !B.connected) return;
    const slim = {
      followUpDays: state.settings.followUpDays,
      contacts: state.contacts.map((c) => ({ name: c.name, stage: c.stage, sentDate: c.sentDate, lastFollowUp: c.lastFollowUp, followUpDate: c.followUpDate, replyDate: c.replyDate })),
      applications: state.applications.map((a) => ({ university: a.university, program: a.program, deadline: a.deadline, status: a.status }))
    };
    B.call('syncReminders', slim).catch(() => {});
  }

  function ackCaptures(ids) {
    inbox.captures = inbox.captures.filter((c) => !ids.includes(c.id));
    renderCapture(); renderMailInbox(); renderReqInbox();
    if (B.connected) B.call('ackCaptures', { ids }).catch(() => {});
  }

  function renderExtStatus() {
    const el = $('#ext-status');
    const hint = $('#scan-hint');
    if (B.connected) {
      el.textContent = `Extension connected (v${B.version || '?'})`; el.className = 'ext-status on';
      hint.textContent = 'Extension connected';
    } else {
      el.textContent = 'Extension not connected: scans and captures are off'; el.className = 'ext-status off';
      hint.textContent = 'Needs the Gradfessor extension';
    }
  }

  let polling = false;
  let booted = false;
  async function pollInbox() {
    renderExtStatus();
    if (!booted || !B.connected || polling) return;
    polling = true;
    try {
      const res = await B.call('getInbox', {});
      if (res && res.ok) {
        const hadPage = inbox.captures.some((c) => c.kind === 'page');
        const hadReq = inbox.captures.some((c) => c.kind === 'requirements');
        inbox = { captures: res.captures || [], jobs: res.jobs || [] };
        renderCapture();
        renderMailInbox();
        renderReqInbox();
        importJobs();
        renderScanJobs();
        if (!hadPage && inbox.captures.some((c) => c.kind === 'page')) show('match');
        if (!hadReq && inbox.captures.some((c) => c.kind === 'requirements')) show('tracker');
      }
    } catch (e) { /* extension busy or gone */ }
    polling = false;
  }

  function importJobs() {
    let added = 0;
    const newIds = [];
    inbox.jobs.forEach((job) => {
      const rec = state.scans[job.id] || (state.scans[job.id] = { id: job.id, title: job.meta.heading || job.meta.title || job.meta.hostname, university: universityFromMeta(job.meta), imported: [], createdAt: job.createdAt });
      rec.total = job.links.length; rec.done = job.done; rec.status = job.status;
      (job.results || []).forEach((r) => {
        if (!r || r.status !== 'ok' || rec.imported.includes(r.url)) return;
        rec.imported.push(r.url);
        if (state.faculty.some((f) => f.url && f.url === r.url)) return;
        const f = { id: store.uid(), name: r.name, title: r.title || '', email: r.email || '', university: rec.university, department: job.meta.heading || '', url: r.url, interests: r.interests || '', papers: r.papers || '', bio: r.bio || '', notes: '', source: 'scan' };
        state.faculty.push(f); newIds.push(f.id); added++;
      });
      rec.skipped = (job.results || []).filter((r) => r && r.status !== 'ok').length;
      if (['done', 'cancelled'].includes(job.status)) {
        B.call('ackJob', { id: job.id }).catch(() => {});
      }
    });
    if (added) {
      saveSoon();
      if (!$('#view-match').hidden) renderProfessors();
      updateCounts();
      if (state.settings.autoPapers !== false) queuePapers(newIds, false);
    }
  }

  function universityFromMeta(meta) {
    if (meta.site) return meta.site;
    const parts = String(meta.title || '').split(/\s[|\-–—]\s/).map((x) => x.trim()).filter(Boolean);
    const u = parts.find((x) => /universit|college|institute|school of/i.test(x));
    return u || parts[parts.length - 1] || meta.hostname || '';
  }

  function renderScanJobs() {
    const box = $('#scan-jobs');
    const active = inbox.jobs.filter((j) => !['done', 'cancelled'].includes(j.status));
    const recent = Object.values(state.scans).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 3);
    const rows = [];
    active.forEach((j) => {
      const pct = j.links.length ? Math.round((j.done / j.links.length) * 100) : 0;
      rows.push(`<div class="job"><div class="card-head"><b>${esc(j.meta.heading || j.meta.hostname)}</b><span class="small muted num">${j.done}/${j.links.length} profiles</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="row-actions"><span class="hint">Reading one page every few seconds so the university site is not overloaded.</span><button class="btn sm ghost danger" data-cancel="${j.id}">Stop</button></div></div>`);
    });
    recent.filter((r) => !active.some((j) => j.id === r.id)).forEach((r) => {
      rows.push(`<div class="job"><div class="card-head"><b>${esc(r.title)}</b><span class="small muted">${r.imported.length} professors added${r.skipped ? `, ${r.skipped} skipped` : ''}</span></div></div>`);
    });
    box.innerHTML = rows.join('');
    $$('[data-cancel]', box).forEach((b) => { b.onclick = () => B.call('cancelJob', { id: b.dataset.cancel }).then(pollInbox); });
  }

  // ---- Paper lookup queue (OpenAlex) ----
  function queuePapers(ids, force) {
    ids.forEach((id) => { if (!paperQueue.some((q) => q.id === id)) paperQueue.push({ id, force }); });
    const f0 = state.faculty.find((f) => f.id === ids[0]);
    if (f0 && ids.length === 1) { f0.paperStatus = 'Looking up papers…'; renderProfessors(); }
    runPaperQueue();
  }
  $('#btn-papers-all').onclick = () => {
    const ids = state.faculty.filter((f) => !f.openalex && !/^demo-/.test(f.id)).map((f) => f.id);
    if (!ids.length) { toast('Everyone already has papers (demo professors are fictional and cannot be looked up)'); return; }
    toast(`Looking up papers for ${ids.length} professor${ids.length > 1 ? 's' : ''}`);
    queuePapers(ids, false);
  };

  async function runPaperQueue() {
    if (paperRunning) return;
    paperRunning = true;
    while (paperQueue.length) {
      const { id, force } = paperQueue.shift();
      const f = state.faculty.find((x) => x.id === id);
      if (!f) continue;
      if (/^demo-/.test(f.id)) { f.paperStatus = 'Demo professor (fictional), no real papers to find.'; continue; }
      f.paperStatus = 'Looking up papers…';
      try {
        const r = await OA.enrich(f, { key: state.settings.openalexKey });
        if (r.found) {
          f.openalex = r.openalex; f.paperLinks = r.paperLinks; f.abstracts = r.abstracts; f.topics = r.topics;
          if (force || !f.papers || f.source === 'scan') f.papers = r.papers;
          f.paperStatus = '';
        } else {
          f.paperStatus = 'Not found on OpenAlex. Use the Scholar link, then "Capture this page" to add papers.';
        }
      } catch (e) {
        f.paperStatus = /failed to fetch|networkerror|load failed/i.test(e.message) ? 'Could not reach OpenAlex. Check your internet connection and try "Find papers" again.' : e.message;
        if (/limit/i.test(e.message)) { paperQueue = []; toast(e.message); }
      }
      saveSoon();
      if (!$('#view-match').hidden) renderProfessors();
      await new Promise((r) => setTimeout(r, 1100));
    }
    paperRunning = false;
  }

  // ---- Captured emails (replies) ----
  function renderMailInbox() {
    const box = $('#mail-inbox');
    const mails = inbox.captures.filter((c) => c.kind === 'email');
    if (!mails.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<div class="card-head"><h3>Captured emails (${mails.length})</h3><span class="hint">Check the suggested reply type, pick the professor, then log it</span></div>` +
      mails.map((m) => {
        const guess = TR.classifyReply(m.text);
        const match = matchContact(m);
        return `<div class="card mail-card" data-mail="${m.id}">
          <div class="card-head"><div><b>${esc(m.subject || '(no subject)')}</b><div class="small muted">${esc(m.from || '')} ${m.fromEmail ? '&lt;' + esc(m.fromEmail) + '&gt;' : ''}</div></div></div>
          <pre>${esc(String(m.text).slice(0, 900))}</pre>
          <div class="grid g3">
            <label class="field">Professor<select data-who>${'<option value="__new">Add as new contact</option>' + state.contacts.map((c) => `<option value="${c.id}" ${match && match.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <label class="field">Reply type${sel(TR.REPLY_TYPES, guess.type, 'data-type')}</label>
            <div class="row-actions" style="align-self:end"><button class="btn sm primary" data-log>Log reply</button><button class="btn sm ghost" data-drop>Discard</button></div>
          </div>
          <p class="hint" data-next>Next step: ${esc(guess.next)}${guess.unsure ? ' (not sure about the type, please check)' : ''}</p>
        </div>`;
      }).join('');
    $$('[data-mail]', box).forEach((card) => {
      const m = mails.find((x) => x.id === card.dataset.mail);
      $('[data-type]', card).onchange = (e) => { $('[data-next]', card).textContent = 'Next step: ' + TR.NEXT_STEP[e.target.value]; };
      $('[data-drop]', card).onclick = () => ackCaptures([m.id]);
      $('[data-log]', card).onclick = () => {
        const who = $('[data-who]', card).value;
        const type = $('[data-type]', card).value;
        let c = state.contacts.find((x) => x.id === who);
        if (!c) {
          c = { id: store.uid(), facultyId: '', name: m.from || m.fromEmail || 'Professor', university: '', email: m.fromEmail || '', matchScore: '', stage: 'Email sent', sentDate: '', followUpDate: '', lastFollowUp: '', replyDate: '', replyType: '', interviewDate: '', notes: '' };
          state.contacts.push(c);
        }
        const today = TR.iso(TR.today());
        c.replyDate = today; c.replyType = type;
        c.stage = type === 'Negative' ? 'Declined' : type === 'Generic / auto-reply' ? c.stage : 'Replied';
        if (type === 'Generic / auto-reply') c.replyDate = '';
        c.notes = [c.notes, `${today} reply (${type}): "${String(m.text).replace(/\s+/g, ' ').slice(0, 160)}..." Next: ${TR.NEXT_STEP[type]}`].filter(Boolean).join('\n');
        saveSoon(); ackCaptures([m.id]); renderTracker(true); toast('Reply logged');
      };
    });
  }

  function matchContact(m) {
    const fe = String(m.fromEmail || '').toLowerCase();
    if (fe) { const c = state.contacts.find((x) => String(x.email || '').toLowerCase() === fe); if (c) return c; }
    const hay = `${m.from} ${m.text}`.toLowerCase();
    return state.contacts.find((c) => { const ln = C.lastName(c.name).toLowerCase(); return ln.length > 2 && hay.includes(ln); }) || null;
  }

  // ---- Settings ----
  let settingsBound = false;
  function bindSettings() {
    const key = $('#set-oa-key');
    const auto = $('#set-auto-papers');
    key.value = state.settings.openalexKey || '';
    auto.checked = state.settings.autoPapers !== false;
    if (settingsBound) return;
    settingsBound = true;
    key.addEventListener('input', () => { state.settings.openalexKey = key.value.trim(); saveSoon(); });
    auto.addEventListener('change', () => { state.settings.autoPapers = auto.checked; saveSoon(); });
  }

  // ---- AI prompt pack ----
  $('#pr-seg').innerHTML = Object.entries(P.DOCS).map(([k, d]) => `<button data-doc="${k}" aria-pressed="${k === prDoc}">${esc(d.label.replace(/ \(.*\)$/, ''))}</button>`).join('');
  $$('#pr-seg button').forEach((b) => b.addEventListener('click', () => {
    prDoc = b.dataset.doc;
    $$('#pr-seg button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.doc === prDoc ? 'true' : 'false'));
    $('#pr-contact').checked = ['cv', 'cover', 'email', 'followup', 'thanks', 'slides'].includes(prDoc);
    buildPrompt();
  }));
  ['#pr-prof', '#pr-app', '#pr-limit', '#pr-output', '#pr-contact', '#pr-ask', '#pr-extra'].forEach((id) => $(id).addEventListener('input', buildPrompt));
  $('#pr-copy').onclick = () => copy($('#pr-text').value);

  function renderPrompts() {
    const ps = $('#pr-prof'), pa = $('#pr-app');
    const curP = ps.value, curA = pa.value;
    ps.innerHTML = '<option value="">None</option>' + scoredFaculty().map(({ f, r }) => `<option value="${f.id}">${esc(f.name)} (${r.overall})</option>`).join('');
    pa.innerHTML = '<option value="">None</option>' + state.applications.map((a) => `<option value="${a.id}">${esc(a.university)}${a.program ? ' · ' + esc(a.program) : ''}</option>`).join('');
    ps.value = state.faculty.some((f) => f.id === curP) ? curP : ($('#w-prof').value || '');
    pa.value = state.applications.some((a) => a.id === curA) ? curA : '';
    if (!$('#pr-contact').dataset.init) { $('#pr-contact').checked = true; $('#pr-contact').dataset.init = '1'; }
    buildPrompt();
  }

  function buildPrompt() {
    const f = state.faculty.find((x) => x.id === $('#pr-prof').value) || null;
    const app = state.applications.find((x) => x.id === $('#pr-app').value) || null;
    const text = P.build(prDoc, {
      profile: state.profile, faculty: f, match: f ? M.score(state.profile, f) : null, application: app,
      wordLimit: $('#pr-limit').value.trim(), output: $('#pr-output').value, includeContact: $('#pr-contact').checked,
      askFirst: $('#pr-ask').checked, extra: $('#pr-extra').value.trim()
    });
    $('#pr-text').value = text;
    $('#pr-stats').textContent = `${T.wordCount(text)} words. Free AI chats accept this size.${!state.profile.interests ? ' Tip: fill your profile first; the prompt uses it.' : ''}`;
  }

  // ================= v0.4: program requirements capture, university reports, guide =================
  function renderReqInbox() {
    const box = $('#req-inbox');
    if (!box) return;
    const caps = inbox.captures.filter((c) => c.kind === 'requirements');
    if (!caps.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<div class="card-head"><h3>Captured program pages (${caps.length})</h3><span class="hint">Check each value against the page, then save</span></div>` + caps.map((c) => {
      const r = RQ.parse(c.text, c);
      const rows = [
        ['Deadline', r.deadline, 'deadline'], ['Funding / priority deadline', r.fundingDeadline, 'fundingDeadline'], ['Application fee', r.fee != null ? '$' + r.fee : '', 'fee'],
        ['Fee waiver', r.feeWaiver, 'feeWaiver'], ['IELTS', r.ieltsMin ? `${r.ieltsMin}${r.ieltsBand ? ` (no band below ${r.ieltsBand})` : ''}` : '', 'ieltsMin'],
        ['TOEFL iBT', r.toeflMin, 'toeflMin'], ['Duolingo', r.duolingoMin, 'duolingoMin'], ['PTE', r.pteMin, 'pteMin'], ['GRE', r.greReq, 'greReq'],
        ['Minimum GPA', r.minGpa, 'minGpa'], ['Letters of recommendation', r.lorsRequired, 'lorsRequired'], ['Documents', r.docs.join(', '), null]
      ];
      return `<div class="card req-card" data-req="${c.id}">
        <div class="card-head"><div><b>${esc(r.program || c.title)}</b><div class="small muted">${esc(r.university)} · <a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener">open page</a></div></div><span class="pill ${r.found >= 4 ? 'good' : r.found ? 'warn' : 'bad'}">${r.found} item${r.found === 1 ? '' : 's'} found</span></div>
        <table><tbody>${rows.map(([k, v, ek]) => `<tr><th style="width:34%">${esc(k)}</th><td>${v != null && v !== '' ? esc(v) : '<span class="muted">not found on this page</span>'}${ek && r.evidence[ek] ? `<div class="evidence">"${esc(r.evidence[ek])}"</div>` : ''}</td></tr>`).join('')}</tbody></table>
        ${r.deadlines.length > 1 ? `<p class="hint">Other dates on the page: ${esc(r.deadlines.map((d) => `${d.date} (${d.label}${d.tags.length ? ', ' + d.tags.join('/') : ''})`).join('; '))}</p>` : ''}
        ${r.feeWaiverNote ? `<p class="hint">${esc(r.feeWaiverNote)}</p>` : ''}
        <div class="row-actions"><button class="btn sm primary" data-save>Review and save as program</button><button class="btn sm ghost" data-drop>Discard</button></div>
      </div>`;
    }).join('');
    $$('[data-req]', box).forEach((card) => {
      const c = caps.find((x) => x.id === card.dataset.req);
      $('[data-drop]', card).onclick = () => ackCaptures([c.id]);
      $('[data-save]', card).onclick = () => {
        const r = RQ.parse(c.text, c);
        const existing = state.applications.find((a) => a.portal && a.portal === c.url);
        editingApp = existing ? existing.id : null;
        setForm(APP_FORM, 'a', {
          ...(existing || { status: 'Not started', sopStatus: 'Not started', rsStatus: 'Not started', transcripts: 'No', scoresSent: 'No', term: state.profile.targetTerm }),
          university: r.university || (existing && existing.university) || '', program: r.program, degree: r.degree || (existing && existing.degree) || 'PhD',
          deadline: r.deadline || '', fundingDeadline: r.fundingDeadline || '', fee: r.fee != null ? r.fee : '', feeWaiver: r.feeWaiver || 'Not available',
          greReq: r.greReq || 'Optional', ieltsMin: r.ieltsMin || '', toeflMin: r.toeflMin || '', duolingoMin: r.duolingoMin || '', minGpa: r.minGpa || '',
          englishMin: [r.ieltsBand ? `IELTS: no band below ${r.ieltsBand}` : '', r.pteMin ? `PTE ${r.pteMin}` : ''].filter(Boolean).join('; '),
          lorsRequired: r.lorsRequired || '', docsRequired: r.docs.join(', '), portal: c.url
        });
        $('#app-form-title').textContent = existing ? `Update ${existing.university}` : 'Save captured program';
        $('#app-form-box').open = true;
        $('#app-form-box').scrollIntoView({ behavior: 'smooth' });
        pendingReqAck = c.id;
      };
    });
  }
  let pendingReqAck = null;
  $('#app-save').addEventListener('click', () => { if (pendingReqAck && !$('#app-form-box').open) { ackCaptures([pendingReqAck]); pendingReqAck = null; } });

  // ---- University reports ----
  function renderUniversities() {
    const unis = REP.group(state);
    $('#nav-uni').textContent = unis.length || '';
    const box = $('#uni-list');
    if (!unis.length) { box.innerHTML = '<div class="card"><p class="muted">No universities yet. Scan a department or capture a program page, and each university gets its own report here.</p></div>'; return; }
    box.innerHTML = unis.map((u, i) => {
      const el = u.programs.flatMap((p) => RQ.eligibility(p, state.profile).map((c) => ({ ...c, program: p.program })));
      const show = el.filter((c) => c.level !== 'good' || el.length < 6).slice(0, 6);
      return `<article class="card uni" data-uni="${i}">
        <div class="card-head"><h3>${esc(u.name)}</h3><div class="row-actions"><button class="btn sm primary" data-x>Excel report</button><button class="btn sm" data-w>Word report</button></div></div>
        <div class="uni-stats">
          <div><b>${u.programs.length}</b><span>programs</span></div>
          <div><b>${u.nextDays != null ? u.nextDays + 'd' : '–'}</b><span>to next deadline</span></div>
          <div><b>${u.professors.length}</b><span>professors ranked</span></div>
          <div><b>${u.best ? u.best.r.overall : '–'}</b><span>${u.best ? 'best match: ' + esc(u.best.f.name) : 'no professors yet'}</span></div>
        </div>
        ${show.length ? `<ul class="elig">${show.map((c) => `<li class="${c.level}">${esc(c.program ? c.program + ': ' : '')}${esc(c.text)}</li>`).join('')}</ul>` : '<p class="hint">Capture a program page to see requirements and your eligibility.</p>'}
        ${u.professors.length ? `<div class="chips">${u.professors.slice(0, 5).map(({ f, r }) => `<span class="chip ${r.verdict === 'Strong' ? 'have' : ''}">${esc(f.name)} · ${r.overall}</span>`).join('')}</div>` : ''}
      </article>`;
    }).join('');
    $$('[data-uni]', box).forEach((el) => {
      const u = unis[Number(el.dataset.uni)];
      $('[data-x]', el).onclick = () => downloadUniXlsx(u);
      $('[data-w]', el).onclick = () => downloadUniDocx(u);
    });
  }
  const stamp = () => TR.iso(TR.today());
  async function downloadUniXlsx(u) {
    try { const buf = await REP.universityWorkbook(window.ExcelJS, u, state).xlsx.writeBuffer(); X.triggerDownload(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Gradfessor_${REP.fileSafe(u.name)}_${stamp()}.xlsx`); toast('Excel report downloaded'); }
    catch (e) { console.error(e); toast('Could not build the Excel report: ' + e.message); }
  }
  async function downloadUniDocx(u) {
    try { const blob = await window.docx.Packer.toBlob(REP.universityDoc(window.docx, u, state)); X.triggerDownload(blob, `Gradfessor_${REP.fileSafe(u.name)}_${stamp()}.docx`); toast('Word report downloaded'); }
    catch (e) { console.error(e); toast('Could not build the Word report: ' + e.message); }
  }
  $('#uni-all-xlsx').onclick = async () => {
    const unis = REP.group(state);
    if (!unis.length) { toast('Nothing to export yet'); return; }
    try { const buf = await REP.allWorkbook(window.ExcelJS, unis, state).xlsx.writeBuffer(); X.triggerDownload(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Gradfessor_All_Universities_${stamp()}.xlsx`); toast('Excel file downloaded'); }
    catch (e) { console.error(e); toast('Export failed: ' + e.message); }
  };
  $('#uni-all-docx').onclick = async () => {
    const unis = REP.group(state);
    if (!unis.length) { toast('Nothing to export yet'); return; }
    for (const u of unis) { await downloadUniDocx(u); await new Promise((r) => setTimeout(r, 600)); }
  };

  // ---- Guide ----
  $$('[data-go]').forEach((b) => { b.onclick = () => show(b.dataset.go); });
  $('#guide-demo').onclick = () => $('#btn-sample').click();

  // ---- Desktop app (installable web app) ----
  let installEvt = null;
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#btn-install').hidden = false; });
    $('#btn-install').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#btn-install').hidden = true; };
  }
  B.onConnect(() => { renderExtStatus(); pollInbox(); syncReminders(); });


  // ---------------- boot ----------------
  store.load().then((s) => {
    state = s;
    booted = true;
    store.persist();
    refreshAll();
    offerSyncRestore();
    if (!state.settings.introSeen) {
      $('#confirm-slot').innerHTML = `<div class="alert info intro"><span>Your data stays on this computer: there is no Gradfessor account or server. Match scores are text-overlap guides, not admission predictions. You are responsible for what you send to professors. <a href="https://github.com/" id="intro-docs" target="_blank" rel="noopener">Privacy &amp; terms</a></span><button class="btn sm" id="intro-ok">Got it</button></div>`;
      const docs = $('#intro-docs'); if (docs) docs.href = (window.SM_CONFIG && window.SM_CONFIG.docsUrl) || 'https://github.com/';
      $('#intro-ok').onclick = () => { state.settings.introSeen = true; saveSoon(); $('#confirm-slot').innerHTML = ''; };
    }
    const h = (location.hash || '').replace('#', '');
    show(['guide', 'profile', 'match', 'writing', 'prompts', 'tracker', 'universities'].includes(h) ? h : (state.profile.name || state.faculty.length ? 'profile' : 'guide'));
    pollInbox();
    setInterval(() => { if (!document.hidden) pollInbox(); }, 4000);
    window.addEventListener('focus', pollInbox);
  });
})();
