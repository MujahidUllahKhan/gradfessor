// Builds templates/Gradfessor_Application_Tracker.xlsx with the same code the extension uses.
// Usage: node tools/build-template.js
const path = require('path');
const ext = path.join(__dirname, '..', 'extension');
globalThis.self = globalThis;
const ExcelJS = require('exceljs'); // Node build of the same library bundled in extension/lib
['storage', 'textkit', 'matcher', 'tracker', 'export'].forEach((f) => require(path.join(ext, 'js', f + '.js')));
const { store, exporter } = globalThis.SM;

const Y = new Date().getFullYear();
const state = store.emptyState();
// One example row per sheet so the expected format is clear. Delete them when you start.
state.applications.push({
  university: 'Example University (delete this row)', program: 'PhD Industrial Engineering', degree: 'PhD', term: `Fall ${Y + 1}`,
  deadline: `${Y}-12-15`, fundingDeadline: `${Y}-12-01`, fee: '90', feeWaiver: 'Available', greReq: 'Optional', englishMin: 'IELTS 6.5 / TOEFL 80',
  sopStatus: 'Draft', rsStatus: 'Not started', lorsRequired: '3', lorsSubmitted: '1', transcripts: 'No', scoresSent: 'No', status: 'In progress',
  portal: '', notes: 'Ask grad school about fee waiver before paying'
});
state.contacts.push({
  name: 'Dr. Example Name (delete this row)', university: 'Example University', email: 'name@example.edu', matchScore: '78',
  stage: 'Email sent', sentDate: `${Y}-09-15`, replyDate: '', replyType: '', interviewDate: '', notes: 'Mentioned their 2025 paper on ...'
});
const wb = exporter.buildWorkbook(ExcelJS, state, { template: true, matches: [] });
const out = path.join(__dirname, '..', 'templates', 'Gradfessor_Application_Tracker.xlsx');
wb.xlsx.writeFile(out).then(() => console.log('Wrote', out));
