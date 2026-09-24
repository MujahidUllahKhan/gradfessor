// AI prompt pack (free mode). Builds one complete prompt the student pastes into
// ChatGPT, Claude or Gemini (free tiers work). It carries their facts, the professor's
// papers and keywords, the document rules, the plain-writing ("humanizer") rules,
// and asks for a downloadable PDF + Word file.
(function (root) {
  const T = root.SM.text;

  const DOCS = {
    cv: {
      label: 'Academic CV', file: 'CV',
      rules: [
        'Length: 2 pages for MS/PhD applicants (3 only if I have several publications).',
        'Order: contact line; research interests (one line); education (degree, institution, dates, GPA/scale, thesis title and advisor); publications; research experience; projects; teaching; skills; awards; test scores if strong; service.',
        'Every bullet starts with an action verb and shows method + result, with a number where I gave one.',
        'Use the professor/program keywords below only where they are true for me.',
        'No photo, date of birth, marital status, religion, CNIC/passport number or father’s name (US/UK/Canada norms).',
        'Clean one-column layout, readable by applicant tracking systems: no tables for text, no icons, no text boxes.'
      ]
    },
    sop: {
      label: 'Statement of Purpose', file: 'SOP',
      rules: [
        'Open with the research problem I care about, stated concretely. No childhood stories, no quotes, no "passion".',
        'Then my research experience: for each project, the question, what I did, the method, the result (numbers I gave).',
        'Then the gap or question I want to work on next and why this program is the place for it.',
        'Name the faculty below and connect my work to one specific paper of theirs.',
        'End with my goals after the degree in 2-3 sentences. No "In conclusion".',
        '4-6 paragraphs. Respect the word limit exactly.'
      ]
    },
    research: {
      label: 'Research Statement', file: 'Research_Statement',
      rules: [
        'Sections with short headings: research vision; past work; current work; future directions (2-3 aims with approach and expected contribution); fit with the program/faculty; broader impact.',
        'Name methods precisely. Mention my papers, preprints or code where I listed them.',
        'Future aims must build on my real projects and connect to the professor’s recent papers.'
      ]
    },
    cover: {
      label: 'Cover Letter (assistantship / RA / TA / job)', file: 'Cover_Letter',
      rules: [
        '250-450 words, 3-5 paragraphs: which position; strongest evidence (method + number); fit with this lab/office; availability and close.',
        'Address a named person if known, otherwise "Dear Hiring Committee".',
        'Sincerely, + my name.'
      ]
    },
    email: {
      label: 'First email to a professor', file: 'Email',
      rules: [
        '120-200 words, 3-4 short paragraphs, plus a subject line under 80 characters.',
        'Subject: Prospective <degree> student, <term>: <specific topic>.',
        'Greeting: "Dear Dr. <Last name>," (never "Dear Sir/Madam" or "Respected Sir").',
        'Paragraph 1: who I am in one sentence and why I am writing.',
        'Paragraph 2: name ONE of their recent papers below by title and say what connects it to my work. Leave [MY OWN SENTENCE: ...] where I must add a personal observation.',
        'Paragraph 3: my closest project, method and one result.',
        'Close with one clear question (are they taking students for <term>?) and "My CV is attached."'
      ]
    },
    followup: {
      label: 'Follow-up email (no reply yet)', file: 'Follow_up',
      rules: ['50-90 words. Polite, no guilt. Restate the one-line reason I wrote and the question. Keep the same subject line with "Re:".']
    },
    thanks: {
      label: 'Thank-you email after an interview / call', file: 'Thank_you',
      rules: ['80-130 words, sent within 24 hours. Thank them, mention one specific thing we discussed, restate my interest, and answer anything I promised to send.']
    },
    proposal: {
      label: 'Short research proposal (1-2 pages)', file: 'Research_Proposal',
      rules: [
        'Headings: Title; Background and gap (with the professor’s papers as starting points); Research questions (2-3); Methods and data; Expected contributions; Timeline (table in months); References (only the papers listed below plus any I provide).',
        'Do not invent citations. If a reference is needed that I did not give, write [CITATION NEEDED].'
      ]
    },
    slides: {
      label: 'Interview slides (5-7 slides)', file: 'Interview_Slides',
      rules: [
        'Slides: 1) title with my name and target lab; 2) about me in 3 lines; 3-4) my two strongest projects (problem, method, result with one figure idea each); 5) how my work connects to the professor’s recent papers; 6) what I would like to work on in their group; 7) questions for them.',
        'Max 30 words per slide. Put what I should SAY in speaker notes.',
        'Output a .pptx file if you can; otherwise a PDF with one slide per page.'
      ]
    }
  };

  const HUMANIZER = [
    'Write like a real graduate applicant on a clear day: plain, specific, short. Use my facts and my voice; keep my English simple.',
    'Do not use: delve, underscore, showcase, tapestry, landscape, realm, pivotal, crucial, vital, testament, boasts, bolster, garner, foster, intricate, interplay, robust, meticulous, seamless, vibrant, myriad, leverage, harness, navigate (figurative), embark, journey, resonate, "align with", "valuable insights", "deep dive", "cutting-edge", "state-of-the-art", "groundbreaking", "passionate".',
    'Do not start sentences with Additionally, Moreover, Furthermore or Notably. No "In conclusion" or "In summary".',
    'No "not only... but also", "not just X but Y", "it’s not X, it’s Y". No lists of three just for rhythm.',
    'Use is/are/has instead of "serves as", "stands as", "represents", "features".',
    'No clichés: "since my childhood", "from a young age", "burning desire", "thirst for knowledge", "dream come true", "hard-working", "team player", "prestigious university", "I am writing to express", "kindly find attached".',
    'Few em dashes; use commas and periods. No bold inside paragraphs, no emoji.',
    'Prefer specific over smooth: exact project names, methods, numbers, paper titles. If a sentence could appear in anyone’s application, rewrite it with my details or cut it.',
    'Vary sentence length. Short sentences are fine. Shorter is better than padded.'
  ];

  function lines(v) { return String(v || '').split(/\n+/).map((s) => s.trim()).filter(Boolean); }

  function profileBlock(p, includeContact) {
    const t = p.tests || {};
    const out = [];
    if (includeContact) out.push(`Name: ${p.name || '[NAME]'} | Email: ${p.email || '[EMAIL]'}`);
    out.push(`Target: ${p.targetDegree || ''} in ${p.field || '[FIELD]'}, ${p.targetTerm || '[TERM]'}`);
    (p.education || []).forEach((e) => out.push(`Education: ${[e.degree, e.field, e.institution, e.year].filter(Boolean).join(', ')}${e.gpa ? `, GPA ${e.gpa}/${e.scale || '4.0'}` : ''}`));
    const tests = [];
    if (t.ielts && t.ielts.overall) tests.push(`IELTS ${t.ielts.overall} (L ${t.ielts.l || '-'}, R ${t.ielts.r || '-'}, W ${t.ielts.w || '-'}, S ${t.ielts.s || '-'})`);
    if (t.toefl && t.toefl.total) tests.push(`TOEFL ${t.toefl.total}`);
    if (t.duolingo) tests.push(`Duolingo ${t.duolingo}`);
    if (t.gre && (t.gre.q || t.gre.v)) tests.push(`GRE V${t.gre.v || '-'} Q${t.gre.q || '-'} AW${t.gre.aw || '-'}`);
    if (tests.length) out.push('Tests: ' + tests.join('; '));
    if (p.interests) out.push('Research interests: ' + p.interests);
    if (p.skills) out.push('Skills/tools: ' + p.skills);
    if (p.coursework) out.push('Coursework: ' + p.coursework);
    lines(p.projects).forEach((x, i) => out.push(`Project ${i + 1}: ${x}`));
    lines(p.publications).forEach((x, i) => out.push(`Publication ${i + 1}: ${x}`));
    if (p.cvText && T.wordCount(p.cvText) > 40) out.push('Full CV text:\n"""\n' + p.cvText.slice(0, 6000) + '\n"""');
    return out.join('\n');
  }

  function facultyBlock(f, match) {
    if (!f) return '';
    const out = [`Professor: ${f.name}${f.title ? ', ' + f.title : ''}, ${[f.department, f.university].filter(Boolean).join(', ')}`];
    if (f.interests) out.push('Stated interests: ' + f.interests);
    if (f.topics) out.push('Topics from their papers: ' + f.topics);
    const papers = (f.paperLinks && f.paperLinks.length ? f.paperLinks.map((l) => `${l.title} (${l.year || 'n.d.'})${l.venue ? ', ' + l.venue : ''}`) : lines(f.papers)).slice(0, 10);
    if (papers.length) out.push('Recent papers (use these exact titles, do not invent others):\n' + papers.map((x) => '- ' + x).join('\n'));
    if (match) {
      if (match.overlap.length) out.push('Keywords we share (use naturally): ' + match.overlap.join(', '));
      if (match.gaps.length) out.push('Their keywords missing from my profile (use ONLY if I confirm they are true for me; otherwise mention as something I want to learn, or leave out): ' + match.gaps.map((g) => g.term).join(', '));
      if (match.missingMethods.length) out.push('Methods in their work I do not list: ' + match.missingMethods.join(', '));
    }
    return out.join('\n');
  }

  function build(docKey, ctx) {
    const d = DOCS[docKey] || DOCS.sop;
    const p = ctx.profile || {};
    const f = ctx.faculty || null;
    const app = ctx.application || null;
    const includeContact = ctx.includeContact != null ? ctx.includeContact : ['cv', 'cover', 'email', 'followup', 'thanks', 'slides'].includes(docKey);
    const lastName = (p.name || 'Name').replace(/\(.*?\)/g, '').trim().split(/\s+/).pop();
    const fileBase = `${lastName}_${d.file}${app && app.university ? '_' + app.university.replace(/[^A-Za-z0-9]+/g, '') : ''}`;
    const target = app ? `${app.degree || ''} ${app.program || ''} at ${app.university}${app.term ? ' (' + app.term + ')' : ''}`.trim() : (f && f.university) || ctx.targetUniversity || '';

    const parts = [];
    const lab = /^[A-Z][A-Z]/.test(d.label) ? d.label : d.label.charAt(0).toLowerCase() + d.label.slice(1);
    parts.push(`You are an experienced graduate admissions editor. Write my ${lab}${target ? ' for ' + target : ''}.`);
    parts.push('');
    parts.push('## Ground rules');
    parts.push('- Use ONLY the facts below. Never invent projects, results, numbers, papers, awards or experience.');
    if (ctx.askFirst !== false) parts.push('- Before writing, ask me up to 5 short questions about anything important that is missing. Then wait for my answers.');
    parts.push('- Mark anything you are unsure about as [CHECK: ...] so I can fix it.');
    if (ctx.wordLimit) parts.push(`- Word limit: ${ctx.wordLimit} words maximum.`);
    parts.push('');
    parts.push('## Document rules');
    d.rules.forEach((r) => parts.push('- ' + r));
    parts.push('');
    parts.push('## Writing style (humanizer rules)');
    HUMANIZER.forEach((r) => parts.push('- ' + r));
    parts.push('');
    parts.push('## About me');
    parts.push(profileBlock(p, includeContact));
    if (f) { parts.push(''); parts.push('## Target professor'); parts.push(facultyBlock(f, ctx.match)); }
    if (app) {
      parts.push('');
      parts.push('## Target program');
      parts.push([`${app.university}: ${[app.degree, app.program, app.term].filter(Boolean).join(', ')}`, app.deadline ? `Deadline ${app.deadline}` : '', app.englishMin ? `English minimum ${app.englishMin}` : '', app.greReq ? `GRE ${app.greReq}` : '', app.notes ? `Notes: ${app.notes}` : ''].filter(Boolean).join('\n'));
    }
    if (ctx.extra) { parts.push(''); parts.push('## Extra instructions from me'); parts.push(ctx.extra); }
    parts.push('');
    parts.push('## Output');
    if (ctx.output === 'text') {
      parts.push('- Give me the final text only, ready to paste into Word or Google Docs.');
    } else {
      parts.push('- First show the full text in the chat so I can read it.');
      parts.push(`- Then create downloadable files: "${fileBase}.pdf" and "${fileBase}.docx"${docKey === 'slides' ? ` (and "${fileBase}.pptx")` : ''}. Layout: one column, Calibri or Arial 11 pt, 1-inch (2.5 cm) margins, clear headings, no decorative graphics.`);
      parts.push('- If you cannot create files, say so and give me clean text I can paste into Word/Google Docs and export as PDF.');
    }
    parts.push('- After the document, list in 3 bullets what I should personally check or rewrite in my own words.');
    return parts.join('\n');
  }

  root.SM = root.SM || {};
  root.SM.prompts = { DOCS, HUMANIZER, build };
})(typeof self !== 'undefined' ? self : globalThis);
