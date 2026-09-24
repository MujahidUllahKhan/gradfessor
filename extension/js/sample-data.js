// Demo data for the pitch. Every person, paper and university here is fictional.
(function (root) {
  const Y = new Date().getFullYear();

  const profile = {
    name: 'Sara Khan (sample)',
    email: 'sara.sample@example.com',
    targetDegree: 'PhD',
    targetTerm: `Fall ${Y + 1}`,
    field: 'Industrial Engineering / Operations Research',
    education: [
      { degree: 'MS', field: 'Industrial Engineering', institution: 'Example State University', gpa: '3.86', scale: '4.0', year: String(Y) },
      { degree: 'BS', field: 'Mathematics', institution: 'Sample Institute of Science', gpa: '3.52', scale: '4.0', year: String(Y - 2) }
    ],
    tests: { ielts: { overall: '7.5', l: '8.0', r: '7.5', w: '6.5', s: '7.0' }, toefl: {}, duolingo: '', gre: { v: '152', q: '166', aw: '3.5' }, gmat: '' },
    interests: 'supply chain optimization, inventory management, machine learning for demand forecasting, reinforcement learning, stochastic optimization, simulation',
    skills: 'Python, Gurobi, Pyomo, PyTorch, scikit-learn, discrete-event simulation, SQL, MATLAB, Excel modeling',
    coursework: '',
    courses: [
      { name: 'Nonlinear Programming', grade: 'A', level: 'Graduate' }, { name: 'Stochastic Processes', grade: 'A-', level: 'Graduate' },
      { name: 'Simulation Modeling', grade: 'A', level: 'Graduate' }, { name: 'Machine Learning I', grade: 'A', level: 'Graduate' },
      { name: 'Linear Programming', grade: 'A', level: 'Graduate' }
    ],
    experience: [
      { role: 'Graduate Research Assistant', org: 'Example State University, Supply Chain Lab', start: '2025', end: 'Present', desc: 'Built reinforcement learning and simulation models for pharmacy inventory; co-wrote one paper under review.' },
      { role: 'Teaching Assistant, Operations Research', org: 'Example State University', start: '2025', end: 'Present', desc: 'Led weekly labs for 40 students on linear programming in Python.' }
    ],
    links: { linkedin: 'linkedin.com/in/sara-sample', scholar: '', github: 'github.com/sarasample', website: '' },
    awards: 'Graduate Merit Scholarship (2025)',
    targetCountries: 'USA, Canada',
    publications: 'Demand forecasting with gradient boosting for regional pharmacy inventory (under review, ' + Y + ')',
    projects:
      'Multi-echelon inventory replenishment with reinforcement learning: built a PyTorch PPO agent and a discrete-event simulation of a 3-tier pharmacy supply chain; cut stockouts 18% versus a base-stock policy.\n' +
      'Predict-then-optimize for hospital supplies: gradient boosting forecasts fed a mixed-integer programming model in Gurobi to set order quantities under budget limits.',
    cvText: ''
  };

  const faculty = [
    {
      id: 'demo-chen', name: 'Dr. Mei Chen (sample)', title: 'Associate Professor', university: 'Sample State University',
      department: 'Industrial & Systems Engineering', email: 'mchen@sample.edu', url: '',
      interests: 'data-driven inventory optimization, reinforcement learning for supply chains, stochastic optimization, healthcare logistics',
      papers:
        `Deep reinforcement learning for multi-echelon inventory control under demand uncertainty (${Y})\n` +
        `Predict-then-optimize models for hospital supply replenishment (${Y})\n` +
        `Distributionally robust inventory policies with machine learning forecasts (${Y - 1})\n` +
        `Simulation-based evaluation of pharmacy supply chain resilience (${Y - 2})\n` +
        `Stochastic programming for blood product allocation (${Y - 4})`,
      bio: '', notes: ''
    },
    {
      id: 'demo-rivera', name: 'Dr. Luis Rivera (sample)', title: 'Assistant Professor', university: 'Sample State University',
      department: 'Industrial & Systems Engineering', email: 'lrivera@sample.edu', url: '',
      interests: 'discrete-event simulation, digital twins for manufacturing, scheduling, production systems',
      papers:
        `Digital twin framework for real-time job shop scheduling (${Y})\n` +
        `Discrete-event simulation of semiconductor production lines with machine learning surrogates (${Y - 1})\n` +
        `Heuristics for flexible flow shop scheduling with setup times (${Y - 2})\n` +
        `Simulation optimization for warehouse order picking (${Y - 3})`,
      bio: '', notes: ''
    },
    {
      id: 'demo-patel', name: 'Dr. Anika Patel (sample)', title: 'Professor', university: 'Sample State University',
      department: 'Industrial & Systems Engineering', email: 'apatel@sample.edu', url: '',
      interests: 'human factors, ergonomics, eye tracking, workload assessment, user studies',
      papers:
        `Eye tracking measures of operator workload in control rooms (${Y})\n` +
        `A survey study of fatigue among warehouse workers (${Y - 1})\n` +
        `Ergonomic risk assessment with wearable sensors and EEG (${Y - 3})`,
      bio: '', notes: ''
    }
  ];

  const applications = [
    { id: 'demo-app1', university: 'Sample State University', program: 'PhD Industrial Engineering', degree: 'PhD', term: `Fall ${Y + 1}`,
      deadline: `${Y}-12-15`, fundingDeadline: `${Y}-12-01`, fee: '75', feeWaiver: 'Requested', greReq: 'Optional', englishMin: 'IELTS 6.5 / TOEFL 80',
      sopStatus: 'Draft', rsStatus: 'Not started', lorsRequired: '3', lorsSubmitted: '1', transcripts: 'No', scoresSent: 'No',
      ieltsMin: '6.5', toeflMin: '80', duolingoMin: '110', minGpa: '3.0', docsRequired: 'Statement of purpose, CV / resume, Transcripts',
      portal: '', status: 'In progress', notes: 'Mention Dr. Chen in SOP (sample row)' }
  ];

  const contacts = [
    { id: 'demo-c1', facultyId: 'demo-chen', name: 'Dr. Mei Chen (sample)', university: 'Sample State University', email: 'mchen@sample.edu',
      matchScore: '', stage: 'Email sent', sentDate: '', followUpDate: '', replyDate: '', replyType: '', interviewDate: '', notes: 'Sample row' }
  ];

  root.SM = root.SM || {};
  root.SM.sample = { profile, faculty, applications, contacts };
})(typeof self !== 'undefined' ? self : globalThis);
