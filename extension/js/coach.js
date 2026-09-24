// Writing coach: rule-based feedback for CV, SOP, cover letter, research statement and cold emails.
// Free version runs fully local. It gives suggestions; it never rewrites a whole document.
(function (root) {
  const T = root.SM.text;
  const M = root.SM.matcher;

  const TYPES = {
    cv: { label: 'CV', min: 350, max: 1300, unit: 'words (about 1-3 pages)' },
    sop: { label: 'Statement of Purpose', min: 800, max: 1200, unit: 'words (check each program’s limit)' },
    research: { label: 'Research Statement', min: 700, max: 1500, unit: 'words' },
    cover: { label: 'Cover Letter', min: 250, max: 500, unit: 'words' },
    email: { label: 'Email to Professor', min: 120, max: 220, unit: 'words' }
  };

  const CLICHES = [
    'since my childhood', 'since childhood', 'ever since i was', 'from a young age', 'since a young age', 'i have always been passionate',
    'i have always been fascinated', 'dream come true', 'burning desire', 'thirst for knowledge', "in today's world", 'fast-paced world',
    'hard-working', 'hardworking', 'team player', 'quick learner', 'it goes without saying', 'last but not least', 'prestigious university',
    'esteemed university', 'world-renowned', 'i am writing to express', 'to whom it may concern', 'dear sir/madam', 'dear sir or madam',
    'dear sir', 'respected sir', 'kindly find attached', 'do the needful'
  ];
  const AI_TELLS = [
    'delve', 'tapestry', 'testament to', 'plays a crucial role', 'pivotal', 'embark', 'my journey', 'leverage', 'foster', 'seamless',
    'myriad', 'realm', 'ever-evolving', 'landscape of', 'cutting-edge', 'state-of-the-art', 'furthermore', 'moreover', 'in conclusion',
    'underscore', 'intricate', 'meticulous', 'robust understanding', 'deep passion', 'profound', 'unwavering'
  ];
  const ACTION_VERBS = new Set((
    'built developed designed implemented analyzed analysed led managed created optimized optimised reduced increased improved modeled modelled ' +
    'simulated formulated published presented wrote authored trained evaluated deployed automated coordinated supervised taught mentored ' +
    'investigated proposed derived proved collected conducted established launched organized organised programmed tested validated ' +
    'benchmarked integrated engineered estimated forecasted forecast scaled secured won awarded achieved delivered streamlined'
  ).split(/\s+/));
  const WEAK_OPENERS = ['responsible for', 'worked on', 'helped', 'assisted', 'duties included', 'involved in', 'participated in'];
  const PERSONAL_INFO = ['date of birth', 'marital status', 'religion', "father's name", 'father name', 'cnic', 'passport no', 'passport number', 'nationality:', 'gender:', 'age:'];

  function findAll(low, list) { return list.filter((p) => low.includes(p)); }

  function stats(text) {
    const sents = T.sentences(text);
    const words = T.wordCount(text);
    const paragraphs = String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length;
    const avg = sents.length ? Math.round(words / sents.length) : 0;
    const iStarts = sents.filter((s) => /^I\b/.test(s)).length;
    const numbers = (String(text).match(/\b\d+(\.\d+)?%?/g) || []).length;
    return { words, sentences: sents.length, avgSentence: avg, paragraphs, iStartRatio: sents.length ? iStarts / sents.length : 0, numbers };
  }

  function lastName(full) {
    const clean = String(full || '').replace(/\(.*?\)/g, '').replace(/\b(dr|prof|professor)\.?\s+/i, '').trim();
    const parts = clean.split(/\s+/);
    return parts.length ? parts[parts.length - 1] : '';
  }

  function mentionsPaper(text, faculty) {
    if (!faculty) return null;
    const docSet = T.termSet(text);
    const papers = M.facultyPapers(faculty);
    for (const p of papers) {
      const pt = [...new Set(T.terms(p.text.replace(/\(\d{4}\)/, '')).filter((t) => !t.includes(' ')))];
      const hit = pt.filter((t) => docSet.has(t)).length;
      if (pt.length && hit >= Math.min(4, Math.ceil(pt.length * 0.6))) return p.text;
    }
    return null;
  }

  function tailoring(text, faculty) {
    const fVec = T.tf([faculty.interests, faculty.papers].join('\n'));
    const top = T.topTerms(fVec, 12);
    const docSet = T.termSet(text);
    const hits = top.filter((t) => docSet.has(t.term)).map((t) => t.term);
    const miss = top.filter((t) => !docSet.has(t.term)).map((t) => t.term);
    return { ratio: top.length ? hits.length / top.length : 0, hits, miss };
  }

  function analyze(type, text, ctx) {
    ctx = ctx || {};
    const cfg = TYPES[type] || TYPES.sop;
    const checks = [];
    const good = (t) => checks.push({ level: 'good', text: t });
    const warn = (t) => checks.push({ level: 'warn', text: t });
    const fix = (t) => checks.push({ level: 'fix', text: t });
    const raw = String(text || '');
    const low = raw.toLowerCase();
    const st = stats(raw);
    const min = Number(ctx.minWords) || cfg.min;
    const max = Number(ctx.maxWords) || cfg.max;

    if (!st.words) return { score: 0, stats: st, target: [min, max], checks: [{ level: 'warn', text: `Paste your ${cfg.label} to get feedback.` }] };

    // Length
    if (st.words < min) fix(`Length: ${st.words} words. Aim for ${min}-${max} ${cfg.unit}.`);
    else if (st.words > max) warn(`Length: ${st.words} words, above the usual ${min}-${max}. Cut repetition first.`);
    else good(`Length: ${st.words} words, inside ${min}-${max}.`);

    // Placeholders left from a template
    const ph = raw.match(/\[[^\]]{2,240}\]/g);
    if (ph) fix(`Replace ${ph.length} [bracketed] placeholder${ph.length > 1 ? 's' : ''}, e.g. ${ph[0]}.`);

    // Cliches and AI-sounding words (all types)
    const cl = findAll(low, CLICHES);
    if (cl.length) fix(`Replace clichés with specifics: ${cl.slice(0, 5).map((c) => `"${c}"`).join(', ')}.`);
    const ai = findAll(low, AI_TELLS);
    if (ai.length) warn(`These words read as generic or AI-written: ${ai.slice(0, 6).map((c) => `"${c}"`).join(', ')}. Use plain words.`);
    if (!cl.length && !ai.length) good('No common clichés or AI-sounding filler found.');

    if (type !== 'cv') {
      if (st.avgSentence > 28) warn(`Average sentence is ${st.avgSentence} words. Split long sentences; aim for 15-22.`);
      else if (st.sentences > 3) good(`Average sentence length ${st.avgSentence} words reads well.`);
    }

    // ----- Type-specific rules -----
    if (type === 'cv') cvChecks(raw, low, st, { good, warn, fix });
    if (type === 'sop') sopChecks(raw, low, st, ctx, { good, warn, fix });
    if (type === 'research') researchChecks(raw, low, st, { good, warn, fix });
    if (type === 'cover') coverChecks(raw, low, st, ctx, { good, warn, fix });
    if (type === 'email') emailChecks(raw, low, st, ctx, { good, warn, fix });

    // Tailoring to a selected professor
    if (ctx.faculty && type !== 'cv') {
      const tl = tailoring(raw, ctx.faculty);
      const nm = ctx.faculty.name || 'the professor';
      if (tl.ratio >= 0.3) good(`Tailored to ${nm}: uses ${tl.hits.slice(0, 4).map((t) => `"${t}"`).join(', ')}.`);
      else warn(`Weak link to ${nm}'s work. Consider (only if true for you): ${tl.miss.slice(0, 4).map((t) => `"${t}"`).join(', ')}.`);
    }

    // Profile evidence: does the document use the student's own skills?
    if (ctx.profile) {
      const skills = T.splitList(ctx.profile.skills).slice(0, 15);
      const used = skills.filter((s) => low.includes(s.toLowerCase()));
      if (skills.length && type !== 'email') {
        if (used.length >= 2) good(`Shows your own tools: ${used.slice(0, 4).join(', ')}.`);
        else warn(`Name the tools you used (from your profile: ${skills.slice(0, 4).join(', ')}).`);
      }
    }

    let score = 100;
    checks.forEach((c) => { if (c.level === 'fix') score -= 14; if (c.level === 'warn') score -= 6; });
    score = Math.max(0, Math.min(100, score));
    const order = { fix: 0, warn: 1, good: 2 };
    checks.sort((a, b) => order[a.level] - order[b.level]);
    return { score, stats: st, target: [min, max], checks };
  }

  function cvChecks(raw, low, st, c) {
    const sections = [
      ['Education', /\beducation\b/], ['Research / experience', /\b(research experience|experience|employment)\b/],
      ['Publications', /\b(publications?|papers|preprints?)\b/], ['Skills', /\b(skills|technical skills|tools)\b/],
      ['Projects', /\bprojects?\b/], ['Awards / honors', /\b(awards?|honou?rs|scholarships?|fellowships?)\b/]
    ];
    const missing = sections.filter(([, re]) => !re.test(low)).map(([n]) => n);
    if (missing.length) c.warn(`Sections not found: ${missing.join(', ')}. Add them if you have content for them.`);
    else c.good('All main sections found (education, experience, publications, skills, projects, awards).');

    if (!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(low)) c.fix('Add a professional email address at the top.');
    const bullets = raw.split(/\n/).map((l) => l.trim()).filter((l) => /^[-•*▪●–]\s*/.test(l)).map((l) => l.replace(/^[-•*▪●–]\s*/, ''));
    if (bullets.length >= 3) {
      const action = bullets.filter((b) => ACTION_VERBS.has(b.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, ''))).length;
      const quant = bullets.filter((b) => /\d/.test(b)).length;
      const ra = action / bullets.length, rq = quant / bullets.length;
      if (ra < 0.6) c.warn(`${Math.round(ra * 100)}% of bullets start with an action verb. Start each with one (built, derived, reduced, published).`);
      else c.good(`${Math.round(ra * 100)}% of bullets start with an action verb.`);
      if (rq < 0.3) c.warn(`Only ${Math.round(rq * 100)}% of bullets have a number. Add results: sizes, % change, accuracy, time saved.`);
      else c.good(`${Math.round(rq * 100)}% of bullets are quantified.`);
    } else {
      c.warn('Few bullet points detected. Use short bullets (start with "-" or "•") under each role or project.');
    }
    const weak = findAll(low, WEAK_OPENERS);
    if (weak.length) c.warn(`Weak phrasing: ${weak.map((w) => `"${w}"`).join(', ')}. Say what you did and what changed.`);
    const pi = findAll(low, PERSONAL_INFO);
    if (pi.length) c.fix(`For US/Canada/UK applications, remove personal details: ${pi.join(', ')}.`);
    if (/\bobjective\b/.test(low)) c.warn('A generic "Objective" section adds little. Replace it with research interests or remove it.');
    if (/\breferences available upon request\b/.test(low)) c.warn('Remove "References available upon request".');
    if (!/\bgpa\b|cgpa/.test(low)) c.warn('GPA not found. Include it if it helps you (e.g. "GPA 3.8/4.0").');
  }

  function sopChecks(raw, low, st, ctx, c) {
    const uni = (ctx.targetUniversity || '').trim();
    if (uni) {
      if (low.includes(uni.toLowerCase())) c.good(`Mentions ${uni}.`);
      else c.fix(`Name the program you are applying to (${uni}) and say why it fits.`);
    } else c.warn('Add the target university in the box above so the coach can check program fit.');
    const faculty = ctx.facultyList || [];
    const named = faculty.filter((f) => { const ln = lastName(f.name); return ln && new RegExp('\\b' + ln + '\\b', 'i').test(raw); });
    if (named.length) c.good(`Names faculty: ${named.map((f) => f.name).slice(0, 3).join(', ')}.`);
    else if (!/\b(dr\.|professor|prof\.)\s+[A-Z]/.test(raw)) c.warn('Name 1-3 faculty whose work fits yours, and say which paper or project connects.');
    if (!/\b(goal|career|long[- ]term|after (graduat|completing)|future)\b/.test(low)) c.warn('Add your goals: what you want to do after this degree.');
    if (!/\b(question|problem|challenge|gap|limitation)\b/.test(low)) c.warn('State the research problem or question that drives you, in one clear sentence.');
    if (st.numbers < 2) c.warn('Add concrete results (numbers, dataset sizes, % improvements, publications).');
    else c.good(`Includes ${st.numbers} concrete numbers or results.`);
    if (st.iStartRatio > 0.4) c.warn(`${Math.round(st.iStartRatio * 100)}% of sentences start with "I". Vary the openings.`);
    if (st.paragraphs < 4) c.warn(`${st.paragraphs} paragraph(s) detected. Most strong SOPs use 4-6 (leave a blank line between paragraphs).`);
    if (/\b(gpa|cgpa)\b/.test(low) && /\b(ielts|toefl|gre)\b/.test(low)) c.warn('Test scores and GPA are already in your application. Use the space for research instead.');
  }

  function researchChecks(raw, low, st, c) {
    const parts = [
      ['Past research', /\b(previous|past|prior|during my (ms|master|bs|bachelor|undergrad)|thesis)\b/],
      ['Current work', /\b(currently|current|ongoing|now working)\b/],
      ['Future directions', /\b(future|next|plan to|will|propose|aim to)\b/],
      ['Research questions / aims', /\b(question|aim|objective|hypothes)/],
      ['Impact / applications', /\b(impact|application|benefit|practice|society|industry)\b/]
    ];
    const miss = parts.filter(([, re]) => !re.test(low)).map(([n]) => n);
    if (miss.length) c.warn(`Missing parts: ${miss.join(', ')}.`);
    else c.good('Covers past, current and future research, aims and impact.');
    const methods = M.detectMethods(raw);
    if (methods.length >= 2) c.good(`Names methods: ${methods.slice(0, 5).join(', ')}.`);
    else c.warn('Name your methods explicitly (e.g. mixed-integer programming, PPO, discrete-event simulation).');
    if (!/\b(published|journal|conference|preprint|under review|arxiv)\b/.test(low)) c.warn('Mention outputs: papers, preprints, talks or code.');
    if (st.paragraphs < 3) c.warn('Use headings or separate paragraphs for each research thread.');
  }

  function coverChecks(raw, low, st, ctx, c) {
    if (!/^\s*dear\b/m.test(low)) c.fix('Open with "Dear Dr. <Last name>" or "Dear Hiring Committee".');
    if (/dear (sir|madam)/.test(low)) c.fix('Avoid "Dear Sir/Madam". Use a name or the committee.');
    if (!/\b(sincerely|best regards|kind regards|regards)\b/.test(low)) c.warn('Close with "Sincerely," or "Best regards," and your name.');
    if (!/\b(position|role|assistantship|program|opening|job)\b/.test(low)) c.fix('Name the exact position or program you are applying for.');
    const uni = (ctx.targetUniversity || '').trim();
    if (uni && !low.includes(uni.toLowerCase())) c.warn(`Mention ${uni} by name.`);
    if (st.paragraphs < 3 || st.paragraphs > 6) c.warn(`${st.paragraphs} paragraph(s). Use 3-5: why this role, your evidence, fit, close.`);
    if (st.numbers < 1) c.warn('Add at least one concrete result (numbers make claims believable).');
  }

  function emailChecks(raw, low, st, ctx, c) {
    const f = ctx.faculty;
    const subj = raw.match(/^\s*subject\s*:\s*(.+)$/im);
    if (!subj) c.fix('Add a subject line ("Subject: Prospective PhD student, Fall 2027: <topic>").');
    else if (subj[1].length > 90) c.warn('Subject line is long. Keep it under ~80 characters.');
    else c.good('Has a clear subject line.');
    if (/dear (sir|madam)|to whom it may concern|respected sir/.test(low)) c.fix('Address the professor by name: "Dear Dr. <Last name>" or "Dear Professor <Last name>".');
    else if (f) {
      const ln = lastName(f.name);
      if (ln && !new RegExp('dear\\s+(dr\\.?|prof\\.?|professor)\\s+' + ln, 'i').test(raw)) c.warn(`Greeting should be "Dear Dr. ${ln}" (check the spelling).`);
      else if (ln) c.good(`Greeting uses Dr./Prof. ${ln}.`);
    }
    if (f) {
      const paper = mentionsPaper(raw, f);
      if (paper) c.good(`References a specific paper: "${paper.slice(0, 70)}${paper.length > 70 ? '…' : ''}".`);
      else c.fix('Mention one of their recent papers by title and say what connects it to your work.');
    }
    if (!/\?|would you|are you (accepting|taking|looking)|whether you|any openings?|possibility/.test(low)) c.fix('End with one clear question (e.g. "Are you taking new PhD students for Fall 2027?").');
    else c.good('Ends with a clear question or request.');
    if (!/\b(attached|attach|cv|resume|curriculum vitae)\b/.test(low)) c.warn('Say that your CV is attached.');
    const bodyParas = st.paragraphs - (subj ? 1 : 0) - (/^\s*(dear|hello|hi)\b[^\n]*,?\s*$/im.test(raw) ? 1 : 0) - (/\b(regards|sincerely|best),?\s*\n/i.test(raw) ? 1 : 0);
    if (bodyParas > 4) c.warn(`${bodyParas} body paragraphs. Keep an email to 3-4 short ones.`);
    if (/\b(gpa|cgpa)\b/.test(low) && /\b(ielts|toefl|gre)\b/.test(low) && st.words < 250) c.warn('Leave most scores for the CV; the email should be about research fit.');
    if (/\b(dear professors?|dear all)\b/.test(low)) c.fix('This looks like a mass email. Send one personal email per professor.');
  }

  // ---------- Drafts & outlines ----------
  function firstSentence(t) {
    const line = String(t || '').split(/\n/).find((l) => l.trim()) || '';
    return T.sentences(line)[0] || line;
  }

  function emailDrafts(profile, faculty, match) {
    const p = profile || {};
    const f = faculty || {};
    const ln = lastName(f.name) || '<Last name>';
    const edu = (p.education || [])[0] || {};
    const art = (w) => (/^[aeiou]|^(ms|mba|msc|mphil|mcs)\b/i.test(w) ? 'an' : 'a');
    const current = edu.degree ? `${edu.degree} student in ${edu.field || p.field || 'my field'} at ${edu.institution || '<institution>'}` : `applicant in ${p.field || '<field>'}`;
    const topics = (match && match.overlap && match.overlap.length) ? match.overlap.slice(0, 2) : T.splitList(p.interests).slice(0, 2);
    const topicStr = topics.join(' and ') || '<research area>';
    const paper = match && match.topPaper ? match.topPaper.text.replace(/\s*\(\d{4}\)\s*$/, '') : '<title of one of their recent papers>';
    const project = firstSentence(p.projects).replace(/[.:;]\s*$/, '') || '<your most relevant project, one line>';
    const term = p.targetTerm || '<term>';
    const deg = p.targetDegree || 'PhD';
    const subject = `Subject: Prospective ${deg} student, ${term}: ${T.titleCase(topics[0] || 'research fit')}`;
    const sign = `\n\nBest regards,\n${(p.name || '<Your name>').replace(/\s*\(sample\)/, '')}\n${current.charAt(0).toUpperCase() + current.slice(1)}\nCV attached`;
    const genuine = '[Write one sentence in your own words about what you found interesting in it, or a question it raised for you.]';

    const formal = `${subject}\n\nDear Dr. ${ln},\n\nI am ${art(current)} ${current}, and I plan to apply for ${deg} programs for ${term}. I recently read your paper "${paper}". ${genuine}\n\nMy related work: ${project}. I would like to continue working on ${topicStr} during my ${deg}.\n\nAre you planning to take new ${deg} students for ${term}? If so, I would be glad to share more about my work or talk briefly at your convenience. My CV is attached.${sign}`;

    const direct = `${subject}\n\nDear Dr. ${ln},\n\nYour paper "${paper}" is directly related to what I work on. ${genuine}\n\nIn my current project, ${project.charAt(0).toLowerCase() + project.slice(1)}. I want to build on this in a ${deg} focused on ${topicStr}, and your group looks like the right place for it.\n\nWill you be accepting ${deg} students for ${term}? My CV is attached, and I can send a short research summary if useful.${sign}`;

    const warm = `${subject}\n\nDear Dr. ${ln},\n\nI hope your semester is going well. I have been following your group's work on ${topicStr}, and your paper "${paper}" stood out to me. ${genuine}\n\nI am ${art(current)} ${current}. In my recent work: ${project}. I would really enjoy contributing to projects like this as a ${deg} student.\n\nWould you have room for a new ${deg} student in ${term}? I would be happy to set up a short call whenever it suits you. My CV is attached.${sign}`;

    return [
      { tone: 'Formal academic', text: formal },
      { tone: 'Confident & direct', text: direct },
      { tone: 'Warm & collaborative', text: warm }
    ];
  }

  function outline(type, profile, faculty, ctx) {
    const p = profile || {};
    const uni = (ctx && ctx.targetUniversity) || '<target university>';
    const interests = T.splitList(p.interests).slice(0, 3).join(', ') || '<your 2-3 research interests>';
    const proj = T.splitList(String(p.projects || '').replace(/\n/g, ';')).slice(0, 2);
    const prof = faculty ? faculty.name : '<1-3 faculty names>';
    const skills = T.splitList(p.skills).slice(0, 5).join(', ') || '<methods/tools>';
    if (type === 'sop') return [
      'STATEMENT OF PURPOSE: OUTLINE (fill each part in your own words)',
      '',
      '1. Opening: the research problem you care about (2-4 sentences)',
      `   Start with a concrete problem in ${interests}, not with childhood or passion.`,
      '',
      '2. Your research so far (1-2 paragraphs)',
      ...(proj.length ? proj.map((x) => `   - ${x.slice(0, 160)}`) : ['   - <project: question, method, result with a number>']),
      `   Name the methods you used: ${skills}.`,
      '',
      '3. What you learned and the gap you want to work on next (1 paragraph)',
      '',
      `4. Why ${uni} (1 paragraph)`,
      `   Faculty fit: ${prof}. Which paper or project connects to yours, and how?`,
      '   Courses, labs, centers or data you would use there.',
      '',
      '5. Goals after the degree (2-3 sentences)',
      '',
      '6. Close: one sentence tying it together (no "In conclusion").'
    ].join('\n');
    if (type === 'research') return [
      'RESEARCH STATEMENT: OUTLINE',
      '',
      '1. Research vision (3-4 sentences): the broad question and why it matters.',
      '2. Past work: for each project, the question, method, result, output (paper/code).',
      ...(proj.length ? proj.map((x) => `   - ${x.slice(0, 160)}`) : []),
      '3. Current work: what you are doing now and early results.',
      `4. Future directions (2-3 aims) in ${interests}. For each: aim, approach, expected contribution.`,
      `5. Fit: how these aims connect to ${prof} and resources at ${uni}.`,
      '6. Broader impact: who benefits and how you will share results.'
    ].join('\n');
    if (type === 'cover') return [
      'COVER LETTER: OUTLINE (assistantship / research position)',
      '',
      'Dear Dr. <Last name> / Hiring Committee,',
      '',
      '1. Which position, where you saw it, one-line summary of why you fit.',
      `2. Evidence: your strongest project (method + number). Tools: ${skills}.`,
      `3. Fit: what you would contribute to this lab/office at ${uni}.`,
      '4. Close: availability, thanks, what you attached.',
      '',
      'Sincerely,',
      p.name ? p.name.replace(/\s*\(sample\)/, '') : '<Your name>'
    ].join('\n');
    if (type === 'cv') return [
      'CV: SECTION ORDER FOR RESEARCH PROGRAMS',
      '',
      'Name | email | phone | LinkedIn/GitHub/Google Scholar',
      'Research interests (one line): ' + interests,
      'Education: degree, institution, dates, GPA/scale, thesis title and advisor',
      'Publications (journal, conference, under review, preprints)',
      'Research experience: role, lab, dates, 2-4 bullets each (action verb + method + number)',
      'Projects',
      'Teaching experience',
      'Skills: ' + skills,
      'Awards, scholarships, test scores (IELTS/TOEFL/GRE) if strong',
      'Service / reviewing / volunteering'
    ].join('\n');
    return '';
  }

  function aiPrompt(type, text, profile, faculty, ctx) {
    const cfg = TYPES[type] || TYPES.sop;
    const p = profile || {};
    const edu = (p.education || []).map((e) => `${e.degree} ${e.field}, ${e.institution}${e.gpa ? ` (GPA ${e.gpa}/${e.scale || '4.0'})` : ''}`).join('; ');
    const prof = faculty ? `\nTarget professor: ${faculty.name}, ${faculty.university || ''}\nTheir interests: ${faculty.interests}\nTheir recent papers:\n${faculty.papers}` : '';
    return [
      `You are an experienced graduate admissions reviewer. Review my ${cfg.label}${ctx && ctx.targetUniversity ? ' for ' + ctx.targetUniversity : ''}.`,
      'Give specific, numbered suggestions. Quote the sentence you are commenting on. Do not rewrite the whole document and do not invent achievements.',
      'Flag clichés, vague claims, missing evidence, and anything that sounds generic or AI-written. Keep my voice.',
      '',
      `About me: target ${p.targetDegree || ''} in ${p.field || ''} (${p.targetTerm || ''}). Education: ${edu || 'n/a'}.`,
      `Research interests: ${p.interests || 'n/a'}`,
      `Skills: ${p.skills || 'n/a'}`,
      prof,
      '',
      `My ${cfg.label}:`,
      '"""',
      text || '(paste text here)',
      '"""'
    ].join('\n');
  }

  root.SM = root.SM || {};
  root.SM.coach = { TYPES, analyze, emailDrafts, outline, aiPrompt, stats, lastName };
})(typeof self !== 'undefined' ? self : globalThis);
