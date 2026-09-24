// Free "do it in the student's own browser" helpers: search tabs, email compose links, calendar files.
(function (root) {
  const enc = encodeURIComponent;
  const clean = (n) => String(n || '').replace(/\(.*?\)/g, '').replace(/\b(dr|prof)\.?\s+/gi, '').trim();

  function searches(f) {
    const n = clean(f.name);
    const u = f.university || '';
    const out = [
      { label: 'Google', url: `https://www.google.com/search?q=${enc(`"${n}" ${u}`)}` },
      { label: 'Scholar', url: `https://scholar.google.com/citations?view_op=search_authors&mauthors=${enc(`${n} ${u}`)}` },
      { label: 'LinkedIn', url: `https://www.linkedin.com/search/results/people/?keywords=${enc(`${n} ${u}`)}` },
      { label: 'Openings', url: `https://www.google.com/search?q=${enc(`"${n}" (PhD OR "graduate students" OR "research assistant" OR "prospective students") funded`)}` }
    ];
    if (f.openalex && f.openalex.id) out.push({ label: 'OpenAlex', url: String(f.openalex.id).replace('https://openalex.org/', 'https://openalex.org/authors/') });
    if (f.url) out.unshift({ label: 'Profile', url: f.url });
    return out;
  }

  function splitEmail(text) {
    const m = String(text || '').match(/^\s*subject\s*:\s*(.+)$/im);
    const subject = m ? m[1].trim() : '';
    const body = String(text || '').replace(/^\s*subject\s*:.*$/im, '').replace(/^\s*\n/, '').trim();
    return { subject, body };
  }

  function compose(provider, to, text) {
    const { subject, body } = splitEmail(text);
    if (provider === 'gmail') return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to || '')}&su=${enc(subject)}&body=${enc(body)}`;
    if (provider === 'outlook') return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to || '')}&subject=${enc(subject)}&body=${enc(body)}`;
    return `mailto:${enc(to || '')}?subject=${enc(subject)}&body=${enc(body)}`;
  }

  // All-day calendar event (.ics) for an interview or deadline
  function ics({ title, date, description, uid }) {
    const d = String(date || '').replace(/-/g, '');
    const next = new Date(date + 'T00:00:00'); next.setDate(next.getDate() + 1);
    const d2 = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const escT = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gradfessor by Afridi//EN', 'BEGIN:VEVENT',
      `UID:${uid || Date.now()}@gradfessor`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d2}`,
      `SUMMARY:${escT(title)}`, `DESCRIPTION:${escT(description)}`,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${escT(title)}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }

  root.SM = root.SM || {};
  root.SM.links = { searches, compose, splitEmail, ics };
})(typeof self !== 'undefined' ? self : globalThis);
