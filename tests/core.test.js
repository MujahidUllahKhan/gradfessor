// Unit tests for the pure modules: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
globalThis.self = globalThis;
['storage', 'textkit', 'matcher', 'coach', 'tracker', 'sample-data', 'scan-utils', 'openalex', 'links', 'prompts', 'requirements', 'cvimport', 'reports'].forEach((f) => require(path.join(__dirname, '..', 'extension', 'js', f + '.js')));
const { matcher: M, coach: C, tracker: TR, sample: S, text: T, scan: SC, openalex: OA, links: L, prompts: P, requirements: RQ, cvimport: CVI, reports: REP } = globalThis.SM;

test('matching ranks the aligned professor first', () => {
  const scores = S.faculty.map((f) => M.score(S.profile, f).overall);
  assert.ok(scores[0] > scores[1] && scores[1] > scores[2], `got ${scores}`);
  assert.equal(M.score(S.profile, S.faculty[0]).verdict, 'Strong');
});

test('scores stay within 0-100 and axes are explainable', () => {
  const r = M.score(S.profile, S.faculty[1]);
  Object.values(r.axes).forEach((v) => assert.ok(v == null || (v >= 0 && v <= 100)));
  assert.ok(r.gaps.length > 0);
  assert.ok(r.rationale.length > 0);
});

test('empty profile does not crash and scores low', () => {
  const r = M.score({ education: [], tests: {} }, S.faculty[0]);
  assert.ok(r.overall < 30);
});

test('parses Google Scholar-style pasted text', () => {
  const txt = [
    'Jane Doe', 'Professor, Example University', 'Verified email at example.edu', 'Research interests: supply chain, optimization',
    'Deep reinforcement learning for inventory control in multi-echelon networks', 'J Doe, A Smith, B Lee', 'Operations Research 71 (2), 2023', '120', '2023',
    'Robust optimization of hospital supply replenishment under uncertainty', 'J Doe, C Park', 'Management Science, 2021', '45', '2021',
    'Contact: jdoe@example.edu'
  ].join('\n');
  const p = M.parseFacultyText(txt, { heading: 'Jane Doe' });
  assert.equal(p.email, 'jdoe@example.edu');
  assert.match(p.papers, /Deep reinforcement learning.*\(2023\)/);
  assert.match(p.papers, /Robust optimization.*\(2021\)/);
  assert.ok(!/J Doe, A Smith/.test(p.papers), 'author lines should be skipped');
  assert.match(p.interests, /supply chain/);
});

test('coach flags cliches and missing structure in an SOP', () => {
  const r = C.analyze('sop', 'Since my childhood I have always been passionate about AI. I want to delve into this realm.', { targetUniversity: 'NMSU' });
  const txt = r.checks.map((c) => c.text).join(' ');
  assert.match(txt, /since my childhood/);
  assert.match(txt, /delve/);
  assert.ok(r.score < 50);
});

test('email drafts reference a real paper and pass most checks once personalised', () => {
  const f = S.faculty[0];
  const d = C.emailDrafts(S.profile, f, M.score(S.profile, f));
  assert.equal(d.length, 3);
  const filled = d[0].text.replace(/\[.*?\]/, 'Your treatment of lead-time uncertainty matches a problem in my pharmacy model.');
  const r = C.analyze('email', filled, { profile: S.profile, faculty: f });
  assert.ok(!r.checks.some((c) => c.level === 'fix'), JSON.stringify(r.checks));
});

test('CV checks catch personal info and weak bullets', () => {
  const cv = 'Name\nme@x.com\nDate of birth: 1999\nEducation\n- Responsible for data\n- Worked on models\n- Helped team';
  const r = C.analyze('cv', cv, {});
  const txt = r.checks.map((c) => c.text).join(' ');
  assert.match(txt, /date of birth/);
  assert.match(txt, /action verb/);
});

test('follow-up due date skips weekends', () => {
  const d = TR.addBusinessDays(new Date('2026-09-18T00:00:00'), 10); // Friday
  assert.equal(TR.iso(d), '2026-10-02');
  const c = { stage: 'Email sent', sentDate: '2026-09-18' };
  assert.equal(TR.followUpDue(c, 10), '2026-10-02');
  assert.equal(TR.followUpDue({ ...c, replyDate: '2026-09-20' }, 10), '');
});

test('dashboard counts', () => {
  const state = { applications: S.applications, contacts: [{ sentDate: '2026-01-01', replyDate: '2026-01-05', stage: 'Replied' }, { sentDate: '2026-01-01', stage: 'Email sent' }], settings: { followUpDays: 10 } };
  const d = TR.dashboard(state);
  assert.equal(d.sent, 2);
  assert.equal(d.replyRate, 50);
  assert.equal(d.followUps, 1);
});

test('text helpers', () => {
  assert.equal(T.wordCount('one two  three'), 3);
  assert.ok(T.terms('Supply chains and inventory optimization').includes('supply chain'));
});

test('site base handles country domains', () => {
  assert.equal(SC.siteBase('ie.nmsu.edu'), 'nmsu.edu');
  assert.equal(SC.siteBase('www.nust.edu.pk'), 'nust.edu.pk');
  assert.equal(SC.siteBase('eng.ox.ac.uk'), 'ox.ac.uk');
});

test('robots.txt rules are respected', () => {
  const rules = SC.parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /people/private\nAllow: /people/private/ok\n');
  assert.equal(SC.robotsAllowed(rules, '/people/jane.html'), true);
  assert.equal(SC.robotsAllowed(rules, '/people/private/x'), false);
  assert.equal(SC.robotsAllowed(rules, '/people/private/ok/1'), true);
});

test('html to text keeps structure and drops scripts', () => {
  const t = SC.htmlToText('<html><script>var a=1</script><nav>Home</nav><main><h1>Dr. Jane Doe</h1><p>Research Interests</p><ul><li>Paper one title here (2024)</li></ul><p>Email &amp; more</p></main></html>');
  assert.match(t, /Dr\. Jane Doe\nResearch Interests\nPaper one/);
  assert.ok(!/var a/.test(t));
  assert.match(t, /Email & more/);
});

test('OpenAlex author choice prefers the right university', () => {
  const res = [
    { display_name: 'Mei Chen', works_count: 300, last_known_institutions: [{ display_name: 'Other University' }] },
    { display_name: 'Mei Chen', works_count: 20, last_known_institutions: [{ display_name: 'Example State University' }] }
  ];
  assert.equal(OA.pickAuthor(res, 'Dr. Mei Chen', 'Example State University').works_count, 20);
  assert.equal(OA.pickAuthor([{ display_name: 'Someone Else', works_count: 5, last_known_institutions: [{ display_name: 'X' }] }], 'Mei Chen', 'Example State University'), null);
  assert.equal(OA.abstractFrom({ world: [1], Hello: [0] }), 'Hello world');
});

test('OpenAlex enrich with mocked fetch', async () => {
  const fake = async (url) => ({ ok: true, status: 200, json: async () => (url.includes('/authors')
    ? { results: [{ id: 'https://openalex.org/A9', display_name: 'Mei Chen', works_count: 10, last_known_institutions: [{ display_name: 'Example State University' }], topics: [{ display_name: 'Inventory' }] }] }
    : { results: [{ display_name: 'RL for inventory', publication_year: 2026, abstract_inverted_index: { RL: [0] }, open_access: { oa_url: 'u.pdf' } }] }) });
  const r = await OA.enrich({ name: 'Mei Chen', university: 'Example State University' }, { fetch: fake });
  assert.equal(r.found, true);
  assert.match(r.papers, /RL for inventory \(2026\)/);
  assert.equal(r.paperLinks[0].pdf, 'u.pdf');
});

test('reply classifier', () => {
  assert.equal(TR.classifyReply('Could we set up a Zoom call?').type, 'Enthusiastic');
  assert.equal(TR.classifyReply('Unfortunately I am not taking new students.').type, 'Negative');
  assert.equal(TR.classifyReply('You may want to contact my colleague').type, 'Redirect');
  assert.equal(TR.classifyReply('Automatic reply: I am out of the office').type, 'Generic / auto-reply');
});

test('compose links and calendar file', () => {
  const g = L.compose('gmail', 'a@b.edu', 'Subject: Hello there\n\nDear Dr. X,\nBody');
  assert.match(g, /su=Hello%20there/);
  assert.ok(!/Subject/.test(decodeURIComponent(g.split('body=')[1])));
  const ics = L.ics({ title: 'Interview', date: '2026-10-05' });
  assert.match(ics, /DTSTART;VALUE=DATE:20261005/);
  assert.match(ics, /DTEND;VALUE=DATE:20261006/);
});

test('prompt pack carries facts, papers, humanizer rules and PDF request', () => {
  const f = S.faculty[0];
  const p = P.build('sop', { profile: S.profile, faculty: f, match: M.score(S.profile, f), wordLimit: 1000 });
  assert.match(p, /Deep reinforcement learning for multi-echelon/);
  assert.match(p, /humanizer rules/);
  assert.match(p, /delve/);
  assert.match(p, /\.pdf/);
  assert.match(p, /1000 words/);
  assert.match(p, /Never invent/);
  assert.ok(!/sara\.sample@example\.com/.test(p), 'SOP prompt should not include contact details by default');
});

const fs = require('fs');
const fx = (p) => fs.readFileSync(path.join(__dirname, 'fixtures', p), 'utf8');

test('requirements parser reads a typical admissions page', () => {
  const r = RQ.parse(fx('program/requirements.txt'), { title: 'PhD in Industrial Engineering | Graduate School | Example State University', heading: 'PhD in Industrial Engineering', today: new Date('2026-09-24') });
  assert.equal(r.deadline, '2026-12-15');
  assert.equal(r.fundingDeadline, '2026-12-01');
  assert.equal(r.fee, 75);
  assert.equal(r.feeWaiver, 'Available');
  assert.equal(r.ieltsMin, 6.5);
  assert.equal(r.ieltsBand, 6);
  assert.equal(r.toeflMin, 80);
  assert.equal(r.duolingoMin, 110);
  assert.equal(r.greReq, 'Optional');
  assert.equal(r.minGpa, 3);
  assert.equal(r.lorsRequired, 3);
  assert.equal(r.university, 'Example State University');
  assert.equal(r.degree, 'PhD');
});

test('requirements parser: negative fee waiver, GRE not considered, day-month dates', () => {
  const r = RQ.parse('Fall 2027 deadline - 1 February 2027 (international). GRE scores will not be considered. Application fee: USD 90. We do not offer application fee waivers. Two letters of recommendation.', { today: new Date('2026-09-24') });
  assert.equal(r.deadline, '2027-02-01');
  assert.equal(r.greReq, 'Not accepted');
  assert.equal(r.fee, 90);
  assert.equal(r.feeWaiver, 'Not available');
  assert.equal(r.lorsRequired, 2);
});

test('eligibility compares scores with minimums', () => {
  const app = { ieltsMin: '7', greReq: 'Required', minGpa: '3.5' };
  const el = RQ.eligibility(app, { tests: { ielts: { overall: '6.5' }, gre: {} }, education: [{ gpa: '3.2', scale: '4.0' }] });
  assert.equal(el.filter((c) => c.level === 'bad').length, 3);
  const ok = RQ.eligibility(app, { tests: { ielts: { overall: '7.5' }, gre: { q: '165', v: '155' } }, education: [{ gpa: '4.5', scale: '5' }] });
  assert.equal(ok.filter((c) => c.level === 'bad').length, 0);
});

test('CV extraction finds degrees, GPA, tests, skills and courses', () => {
  const s = CVI.extract(fx('cv/sample_cv.txt'));
  assert.equal(s.email, 'sara.sample@example.com');
  assert.equal(s.education.length, 2);
  assert.equal(s.education[0].gpa, '3.86');
  assert.equal(s.ielts, '7.5');
  assert.equal(s.ieltsBands.w, '6.5');
  assert.equal(s.gre.q, '166');
  assert.match(s.skills, /Gurobi/);
  assert.match(s.coursework, /Nonlinear Programming/);
});

test('university grouping and report workbooks', async () => {
  const ExcelJS = require('exceljs');
  const st = JSON.parse(JSON.stringify({ profile: S.profile, faculty: S.faculty, applications: S.applications, contacts: S.contacts }));
  const unis = REP.group(st);
  assert.equal(unis.length, 1);
  assert.equal(unis[0].professors[0].f.id, 'demo-chen');
  const wb = REP.universityWorkbook(ExcelJS, unis[0], st);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['Summary', 'Programs & requirements', 'Professors', 'Checklist', 'My profile']);
  const all = REP.allWorkbook(ExcelJS, unis, st);
  assert.ok(all.getWorksheet('Overview'));
  const buf = await wb.xlsx.writeBuffer();
  assert.ok(buf.byteLength > 5000);
});
