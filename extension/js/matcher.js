// Transparent profile-to-professor matcher (free version, fully local).
// No black box: every axis is a simple, explainable ratio that the UI shows.
(function (root) {
  const T = root.SM.text;

  // ---------- Method / tool dictionary (label -> regex) ----------
  const METHODS = [
    ['Python', /\bpython\b/], ['R', /\b(r programming|rstudio|tidyverse|ggplot2?|in r\b)/], ['MATLAB', /\bmatlab\b/],
    ['Julia', /\bjulia\b/], ['C/C++', /\b(c\+\+|cpp)\b/], ['Java', /\bjava\b/], ['SQL', /\b(sql|mysql|postgres(ql)?)\b/],
    ['PyTorch', /\bpytorch\b/], ['TensorFlow/Keras', /\b(tensorflow|keras)\b/], ['scikit-learn', /\b(scikit-learn|sklearn)\b/],
    ['LLMs', /\b(llms?|large language models?|gpt-?\d?|transformer models?)\b/], ['RAG', /\b(rag|retrieval[- ]augmented)\b/],
    ['LangChain/agents', /\b(langchain|langgraph|agentic|ai agents?|multi-agent|multiagent)\b/],
    ['Machine learning', /\bmachine learning\b/], ['Deep learning', /\b(deep learning|neural networks?|cnns?|lstm)\b/],
    ['Reinforcement learning', /\b(reinforcement learning|marl|q-learning|policy gradient)\b/],
    ['Computer vision', /\b(computer vision|image (processing|segmentation|classification)|object detection)\b/],
    ['NLP', /\b(nlp|natural language processing|text mining)\b/], ['Graph neural networks', /\b(graph neural|gnn)\b/],
    ['Explainable AI', /\b(explainable ai|xai|shap|interpretab)/], ['Federated learning', /\bfederated learning\b/],
    ['Bayesian methods', /\bbayesian\b/], ['Gaussian processes', /\bgaussian process/], ['Time series / forecasting', /\b(time[- ]series|forecasting|arima)\b/],
    ['Statistics', /\b(statistic(s|al)|hypothesis test|anova|regression)\b/], ['Survival analysis', /\bsurvival analysis\b/],
    ['Causal inference', /\bcausal (inference|effect)/], ['Optimization', /\boptimi[sz]ation\b/],
    ['Linear/integer programming', /\b(linear programming|integer programming|milp|mixed[- ]integer|lp model)\b/],
    ['Stochastic/robust optimization', /\b(stochastic programming|stochastic optimi[sz]ation|robust optimi[sz]ation|chance[- ]constrained)\b/],
    ['Nonlinear programming', /\b(nonlinear programming|convex optimi[sz]ation|kkt)\b/], ['Dynamic programming / MDP', /\b(dynamic programming|markov decision)\b/],
    ['Heuristics / metaheuristics', /\b(heuristics?|metaheuristics?|genetic algorithms?|simulated annealing|tabu search)\b/],
    ['Simulation', /\bsimulation\b/], ['Discrete-event simulation', /\b(discrete[- ]event|arena|simio|anylogic)\b/],
    ['Agent-based modeling', /\bagent[- ]based\b/], ['Monte Carlo', /\bmonte carlo\b/], ['Digital twins', /\bdigital twins?\b/],
    ['Gurobi/CPLEX/Pyomo', /\b(gurobi|cplex|pyomo|ampl|gams)\b/], ['Queueing theory', /\bqueu(e)?ing\b/], ['Game theory', /\bgame theor/],
    ['Supply chain', /\bsupply chains?\b/], ['Inventory management', /\binventory\b/], ['Logistics', /\blogistics\b/], ['Scheduling', /\bscheduling\b/],
    ['Lean / Six Sigma', /\b(lean|six sigma|dmaic)\b/], ['Quality / SPC', /\b(quality control|statistical process control|spc)\b/],
    ['Reliability', /\breliability\b/], ['Human factors', /\b(human factors|ergonomic)/], ['Healthcare systems', /\b(healthcare|clinical|hospital|patient)\b/],
    ['Data mining', /\bdata mining\b/], ['Big data / Spark', /\b(big data|spark|hadoop)\b/], ['Cloud / Docker', /\b(aws|azure|gcp|docker|kubernetes)\b/],
    ['Blockchain', /\b(blockchain|smart contracts?|ethereum|hyperledger)\b/], ['IoT / sensors', /\b(iot|internet of things|sensor networks?)\b/],
    ['Embedded / FPGA', /\b(embedded systems?|fpga|microcontroller|arduino)\b/], ['Signal processing', /\bsignal processing\b/],
    ['Control systems', /\b(control systems?|model predictive control|mpc|pid)\b/], ['Robotics / ROS', /\b(robotics?|ros)\b/],
    ['CAD', /\b(cad|solidworks|autocad)\b/], ['FEA', /\b(finite element|fea|ansys|abaqus)\b/], ['COMSOL', /\bcomsol\b/], ['CFD', /\b(cfd|computational fluid)\b/],
    ['DFT', /\b(dft|density functional)\b/], ['Molecular dynamics', /\bmolecular dynamics\b/], ['GIS / remote sensing', /\b(gis|arcgis|remote sensing|satellite)\b/],
    ['Life cycle assessment', /\b(life[- ]cycle assessment|lca)\b/], ['SPSS/Stata', /\b(spss|stata|sas)\b/],
    ['Qualitative methods', /\b(qualitative|thematic analysis|grounded theory)\b/], ['Surveys / interviews', /\b(surveys?|questionnaires?|interviews)\b/],
    ['Eye tracking / EEG', /\b(eye[- ]tracking|eeg|fmri)\b/], ['Wet lab', /\b(cell culture|pcr|crispr|western blot)\b/],
    ['Microscopy / spectroscopy', /\b(microscopy|spectroscopy|xrd|sem imaging)\b/], ['Additive manufacturing', /\b(additive manufacturing|3d printing)\b/],
    ['Materials synthesis', /\b(synthesis|nanomaterials?|thin films?)\b/], ['Batteries / electrochemistry', /\b(batter(y|ies)|electrochemi)/],
    ['Renewable energy', /\b(photovoltaic|solar|wind energy|renewable)\b/], ['Power systems', /\b(power systems?|smart grid|microgrid)\b/],
    ['Wireless / 5G', /\b(wireless|5g|6g)\b/], ['Cybersecurity', /\b(cyber ?security|intrusion detection|malware|anomaly detection)\b/],
    ['Cryptography / privacy', /\b(cryptograph|privacy[- ]preserving|differential privacy)/], ['Knowledge graphs', /\bknowledge graphs?\b/],
    ['Emissions / sustainability', /\b(emissions?|carbon|greenhouse|sustainab)/], ['Tableau / Power BI', /\b(tableau|power ?bi)\b/], ['Excel modeling', /\bexcel\b/]
  ];

  const PARADIGMS = [
    ['Computational / modeling', /\b(simulat|computational|numerical|modell?ing|algorithm)/g],
    ['Data-driven / ML', /\b(machine learning|deep learning|data[- ]driven|neural|predictive|learning[- ]based|forecast)/g],
    ['Optimization / OR', /\b(optimi[sz]|linear programming|integer programming|scheduling|heuristic|operations research)/g],
    ['Experimental / lab', /\b(experiment|laborator|fabricat|synthesi|prototyp|testbed|measurement|specimen)/g],
    ['Theoretical / mathematical', /\b(theorem|proof|theoretical|analytical|convergence|bounds?\b|graph theor|algebraic)/g],
    ['Human-centered / empirical', /\b(survey|interview|user study|qualitative|case study|field study|participants|stakeholder)/g],
    ['Systems / design & build', /\b(architecture|implementation|platform|deploy|prototype system|software system|end-to-end)/g]
  ];

  const WEIGHTS = { topic: 0.30, evidence: 0.30, methods: 0.25, style: 0.15 };
  const THIS_YEAR = new Date().getFullYear();

  function yearOf(line) {
    const m = String(line).match(/\b(19[89]\d|20[0-4]\d)\b/g);
    if (!m) return null;
    const ys = m.map(Number).filter((y) => y <= THIS_YEAR + 1);
    return ys.length ? Math.max(...ys) : null;
  }

  function recencyWeight(year) {
    if (!year) return 0.6;
    const age = THIS_YEAR - year;
    if (age <= 1) return 1.0;
    if (age <= 3) return 0.7;
    return 0.4;
  }

  function detectMethods(text) {
    const low = ' ' + String(text || '').toLowerCase() + ' ';
    const found = [];
    for (const [label, re] of METHODS) if (re.test(low)) found.push(label);
    return found;
  }

  function detectParadigms(text) {
    const low = String(text || '').toLowerCase();
    const counts = [];
    for (const [label, re] of PARADIGMS) {
      const m = low.match(re);
      if (m && m.length) counts.push({ label, n: m.length });
    }
    return counts.sort((a, b) => b.n - a.n);
  }

  // ---------- Profile / faculty text assembly ----------
  function studentTexts(p) {
    const edu = (p.education || []).map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(' ')).join('. ');
    const interests = [p.field, p.interests].filter(Boolean).join('. ');
    const exp = (p.experience || []).map((x) => [x.role, x.org, x.desc].filter(Boolean).join(' ')).join('\n');
    const evidence = [p.projects, p.publications, exp, p.cvText].filter(Boolean).join('\n');
    const courses = (p.courses || []).map((c) => c.name).filter(Boolean).join(', ');
    const skills = [p.skills, p.coursework, courses].filter(Boolean).join(', ');
    const all = [interests, skills, evidence, edu].join('\n');
    return { interests, evidence, skills, all };
  }

  function facultyPapers(f) {
    return String(f.papers || '')
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 8)
      .map((l) => ({ text: l, year: yearOf(l) }));
  }

  function facultyVector(f) {
    const v = T.tf(f.interests, 1.2);
    T.addInto(v, T.tf(f.topics, 1.0));
    T.addInto(v, T.tf(f.abstracts, 0.35));
    T.addInto(v, T.tf(f.bio, f.papers ? 0.3 : 0.6));
    const papers = facultyPapers(f);
    papers.forEach((p) => T.addInto(v, T.tf(p.text, recencyWeight(p.year))));
    return { vec: v, papers };
  }

  function facultyText(f) {
    return [f.interests, f.topics, f.bio, f.papers, f.abstracts].filter(Boolean).join('\n');
  }

  // ---------- Core scoring ----------
  function clamp(x) { return Math.max(0, Math.min(100, Math.round(x))); }

  function score(profile, faculty) {
    const S = studentTexts(profile);
    const sSet = T.termSet(S.all);
    const sWords = new Set(T.words(S.all).map(T.stem));
    const { vec: fVec, papers } = facultyVector(faculty);

    // Axis 1: topic fit = weighted share of the professor's top topics that appear in the student's profile
    const top = T.topTerms(fVec, 15);
    let have = 0, total = 0;
    const overlap = [], gaps = [];
    top.forEach(({ term, weight }) => {
      total += weight;
      if (sSet.has(term)) { have += weight; overlap.push(term); return; }
      if (term.includes(' ')) {
        const parts = term.split(' ');
        if (parts.every((p) => sWords.has(p))) { have += weight * 0.5; overlap.push(term); return; }
      }
      gaps.push(term);
    });
    const coverage = total ? have / total : 0;
    const topic = top.length ? clamp((coverage / 0.8) * 100) : null;

    // Axis 2: evidence overlap = cosine between your projects/papers and their recency-weighted papers
    const sEvid = T.tf(S.evidence);
    T.addInto(sEvid, T.tf(S.interests, 0.5));
    const fPaperVec = new Map();
    papers.forEach((p) => T.addInto(fPaperVec, T.tf(p.text, recencyWeight(p.year))));
    if (faculty.abstracts) T.addInto(fPaperVec, T.tf(faculty.abstracts, 0.5));
    if (!papers.length) T.addInto(fPaperVec, T.tf([faculty.interests, faculty.topics, faculty.bio].filter(Boolean).join(' ')));
    const cos = T.cosine(sEvid, fPaperVec);
    const evidence = S.evidence.trim() || S.interests.trim() ? clamp((cos / 0.5) * 100) : null;

    // Axis 3: methods = share of the professor's methods/tools you list
    const fMethods = detectMethods(facultyText(faculty));
    const sMethods = detectMethods(S.all);
    const sharedMethods = fMethods.filter((m) => sMethods.includes(m));
    const missingMethods = fMethods.filter((m) => !sMethods.includes(m));
    const methods = fMethods.length ? clamp((sharedMethods.length / Math.min(fMethods.length, 8)) * 100) : null;

    // Axis 4: research style = share of the professor's top 3 paradigms you also show
    const fPar = detectParadigms(facultyText(faculty)).slice(0, 3).map((x) => x.label);
    const sPar = detectParadigms(S.all).map((x) => x.label);
    const sharedPar = fPar.filter((x) => sPar.includes(x));
    const style = fPar.length ? clamp((sharedPar.length / fPar.length) * 100) : null;

    const axes = { topic, evidence, methods, style };
    let wsum = 0, acc = 0;
    Object.entries(axes).forEach(([k, v]) => { if (v != null) { acc += v * WEIGHTS[k]; wsum += WEIGHTS[k]; } });
    const overall = wsum ? clamp(acc / wsum) : 0;
    const verdict = overall >= 75 ? 'Strong' : overall >= 50 ? 'Moderate' : 'Weak';

    // Gap keywords with paper counts
    const gapInfo = gaps.slice(0, 6).map((term) => {
      const n = papers.filter((p) => T.termSet(p.text).has(term)).length;
      return { term, papers: n, of: papers.length };
    });

    const recent = papers.filter((p) => p.year && THIS_YEAR - p.year <= 1).length;

    const result = {
      overall, verdict, axes, weights: WEIGHTS,
      overlap: overlap.slice(0, 8), gaps: gapInfo,
      sharedMethods, missingMethods: missingMethods.slice(0, 6),
      paradigms: { faculty: fPar, shared: sharedPar },
      coverage, cosine: cos, paperCount: papers.length, recentPapers: recent,
      topPaper: pickPaper(papers, overlap)
    };
    result.rationale = rationale(result, faculty);
    return result;
  }

  function pickPaper(papers, overlap) {
    if (!papers.length) return null;
    let best = null, bestScore = -1;
    papers.forEach((p) => {
      const set = T.termSet(p.text);
      let s = overlap.filter((t) => set.has(t)).length + recencyWeight(p.year);
      if (s > bestScore) { bestScore = s; best = p; }
    });
    return best;
  }

  function rationale(r, f) {
    const name = f.name || 'This professor';
    const out = [];
    if (r.overlap.length) out.push(`Your profile already covers ${r.overlap.length} of ${name}'s main topics, including ${r.overlap.slice(0, 3).map((t) => `"${t}"`).join(', ')}.`);
    else out.push(`Very few of ${name}'s main topics appear in your profile yet.`);
    if (r.sharedMethods.length) out.push(`You share these methods/tools: ${r.sharedMethods.slice(0, 4).join(', ')}.`);
    if (r.missingMethods.length) out.push(`Their work also uses ${r.missingMethods.slice(0, 3).join(', ')}, which your profile does not mention.`);
    if (r.paradigms.faculty.length) out.push(`Their research style: ${r.paradigms.faculty.slice(0, 2).join(' + ')}${r.paradigms.shared.length ? '. You overlap on ' + r.paradigms.shared.join(', ') : '. Your profile shows a different style'}.`);
    if (r.recentPapers) out.push(`${r.recentPapers} listed paper${r.recentPapers === 1 ? ' is' : 's are'} from the last two years, so this area looks active.`);
    if (!r.paperCount) out.push('No papers yet, so the score leans on their profile page. Click "Find papers" to pull their recent papers for free.');
    return out;
  }

  // ---------- Faculty page / Google Scholar text parser ----------
  function parseFacultyText(text, meta) {
    const raw = String(text || '');
    const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const email = (raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [''])[0];

    // interests: text after a "Research interests/areas" header, or a Scholar-style comma list
    let interests = '';
    const idx = lines.findIndex((l) => /^(research )?(interests|areas|focus)\b|research (interests|areas)/i.test(l));
    if (idx >= 0) {
      const same = lines[idx].split(/:\s*/)[1];
      interests = (same && same.length > 5 ? same : lines.slice(idx + 1, idx + 4).join('; ')).slice(0, 400);
    }

    // paper titles: title-like line, with a year on the same line or in the next 3 lines
    const papers = [];
    const seen = new Set();
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const wordsN = l.split(' ').length;
      const looksAuthors = (l.match(/,/g) || []).length >= 2 && wordsN < 3 * ((l.match(/,/g) || []).length + 1);
      if (l.length < 25 || l.length > 260 || wordsN < 4 || /@|http|cited by|copyright|©/i.test(l) || looksAuthors) continue;
      let year = yearOf(l);
      if (!year) for (let j = 1; j <= 3 && i + j < lines.length; j++) { const y = yearOf(lines[i + j]); if (y) { year = y; break; } }
      if (!year) continue;
      const title = l.replace(/\s*[,(]?\b(19|20)\d{2}\)?\s*$/, '').trim();
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      papers.push(`${title} (${year})`);
      if (papers.length >= 30) break;
    }

    let name = (meta && meta.heading) || '';
    if (!name && meta && meta.title) name = meta.title.split(/[-|–—]/)[0].trim();
    name = name.replace(/\s*-\s*Google Scholar.*$/i, '').slice(0, 80);

    return { name, email, interests, papers: papers.join('\n'), bio: raw.slice(0, 6000), url: (meta && meta.url) || '' };
  }

  // ---------- Profile strength ----------
  function profileStrength(p) {
    const tips = [];
    let s = 0;
    const add = (ok, pts, tip) => { if (ok) s += pts; else if (tip) tips.push(tip); };
    const interestList = T.splitList(p.interests);
    add((p.education || []).length > 0, 12, 'Add at least one degree with GPA and scale.');
    add((p.education || []).some((e) => e.gpa), 6, 'Add your GPA (and scale) — many programs filter on it.');
    add(interestList.length >= 5, 16, `Research interests: ${interestList.length} listed. Add at least 5 specific ones (e.g. "stochastic inventory optimization", not just "AI").`);
    add(T.splitList(p.skills).length >= 6, 12, 'List at least 6 skills/tools (languages, solvers, lab techniques).');
    add(T.wordCount(p.projects) >= 40, 14, 'Describe 2-3 research projects: question, method, result.');
    add(T.wordCount(p.publications) >= 5, 8, 'Add publications, preprints or theses under review (titles are enough).');
    add(T.wordCount(p.cvText) >= 150, 14, 'Paste your CV text so matching can use all of it.');
    add(!!(p.tests && (p.tests.ielts.overall || p.tests.toefl.total || p.tests.duolingo)), 6, 'Add your English test score (IELTS / TOEFL / Duolingo) or note a waiver.');
    add(!!(p.tests && (p.tests.gre.q || p.tests.gre.v)), 4, null);
    add(T.wordCount(p.coursework) >= 4 || (p.courses || []).length >= 3, 4, 'Add 3+ advanced courses with grades (e.g. Nonlinear Programming, A).');
    add((p.experience || []).length > 0, 4, 'Add research, work or teaching experience (role, place, dates, what you did).');
    add(!!(p.links && (p.links.linkedin || p.links.scholar || p.links.github)), 2, 'Add your LinkedIn, Google Scholar or GitHub link.');
    add(!!p.field, 4, 'Set your target field.');
    return { score: Math.min(100, Math.round((s / 110) * 100)), tips };
  }

  root.SM = root.SM || {};
  root.SM.matcher = { score, parseFacultyText, profileStrength, detectMethods, detectParadigms, studentTexts, facultyPapers, yearOf, recencyWeight, WEIGHTS };
})(typeof self !== 'undefined' ? self : globalThis);
