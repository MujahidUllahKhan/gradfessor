// Application + outreach tracker logic (pure functions).
(function (root) {
  const DAY = 86400000;

  const APP_STATUS = ['Not started', 'In progress', 'Submitted', 'Interview', 'Admitted', 'Rejected', 'Waitlisted', 'Withdrawn'];
  const DONE_STATUS = ['Submitted', 'Interview', 'Admitted', 'Rejected', 'Waitlisted', 'Withdrawn'];
  const FEE_WAIVER = ['Not available', 'Available', 'Requested', 'Granted', 'Denied'];
  const GRE = ['Required', 'Optional', 'Not accepted', 'Waived'];
  const DOC_STATUS = ['Not started', 'Draft', 'Final', 'Submitted', 'N/A'];
  const YES_NO = ['Yes', 'No'];
  const STAGES = ['Identified', 'Email drafted', 'Email sent', 'Follow-up sent', 'Replied', 'Interview scheduled', 'Confirmed support', 'Declined', 'No response'];
  const REPLY_TYPES = ['Enthusiastic', 'Positive but cautious', 'Generic / auto-reply', 'Redirect', 'Negative'];

  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function parse(s) { if (!s) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? null : d; }
  function iso(d) { if (!d) return ''; const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }

  function addBusinessDays(date, n) {
    const d = new Date(date);
    let added = 0;
    while (added < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) added++; }
    return d;
  }

  function daysLeft(dateStr) {
    const d = parse(dateStr);
    if (!d) return null;
    return Math.round((d - today()) / DAY);
  }

  function followUpDue(c, followDays) {
    if (c.followUpDate) return c.followUpDate;
    if (!c.sentDate || c.replyDate) return '';
    if (!['Email sent', 'Follow-up sent'].includes(c.stage)) return '';
    const base = c.stage === 'Follow-up sent' && c.lastFollowUp ? parse(c.lastFollowUp) : parse(c.sentDate);
    return base ? iso(addBusinessDays(base, followDays || 10)) : '';
  }

  function isFollowUpDue(c, followDays) {
    const due = followUpDue(c, followDays);
    if (!due || c.replyDate) return false;
    if (!['Email sent', 'Follow-up sent'].includes(c.stage)) return false;
    return parse(due) <= today();
  }

  function dashboard(state) {
    const apps = state.applications || [];
    const contacts = state.contacts || [];
    const fd = Number((state.settings || {}).followUpDays) || 10;
    const open = apps.filter((a) => !DONE_STATUS.includes(a.status));
    const upcoming = open
      .map((a) => ({ a, d: daysLeft(a.deadline) }))
      .filter((x) => x.d != null && x.d >= 0)
      .sort((x, y) => x.d - y.d);
    const sent = contacts.filter((c) => c.sentDate).length;
    const replied = contacts.filter((c) => c.replyDate).length;
    const fees = apps.reduce((s, a) => s + (Number(a.fee) || 0), 0);
    const waived = apps.filter((a) => a.feeWaiver === 'Granted').reduce((s, a) => s + (Number(a.fee) || 0), 0);
    return {
      apps: apps.length,
      submitted: apps.filter((a) => DONE_STATUS.includes(a.status) && a.status !== 'Withdrawn').length,
      admitted: apps.filter((a) => a.status === 'Admitted').length,
      nextDeadline: upcoming[0] ? { name: `${upcoming[0].a.university}`, days: upcoming[0].d } : null,
      dueSoon: upcoming.filter((x) => x.d <= 14).length,
      fees, waived,
      professors: contacts.length,
      sent, replied,
      replyRate: sent ? Math.round((replied / sent) * 100) : 0,
      followUps: contacts.filter((c) => isFollowUpDue(c, fd)).length,
      interviews: contacts.filter((c) => c.interviewDate).length + apps.filter((a) => a.status === 'Interview').length
    };
  }

  function alerts(state) {
    const fd = Number((state.settings || {}).followUpDays) || 10;
    const out = [];
    (state.contacts || []).forEach((c) => {
      if (isFollowUpDue(c, fd)) out.push({ kind: 'follow', text: `Follow up with ${c.name || 'professor'}: emailed ${c.sentDate}, no reply logged.` });
      const idays = daysLeft(c.interviewDate);
      if (idays != null && idays >= 0 && idays <= 3) out.push({ kind: 'interview', text: `Interview with ${c.name} ${idays === 0 ? 'today' : `in ${idays} day${idays > 1 ? 's' : ''}`} (${c.interviewDate}).` });
    });
    (state.applications || []).forEach((a) => {
      if (DONE_STATUS.includes(a.status)) return;
      const d = daysLeft(a.deadline);
      if (d != null && d >= 0 && d <= 10) out.push({ kind: 'deadline', text: `${a.university} ${a.program || ''}: deadline in ${d} day${d === 1 ? '' : 's'} (${a.deadline}).` });
      const fdl = daysLeft(a.fundingDeadline);
      if (fdl != null && fdl >= 0 && fdl <= 10) out.push({ kind: 'deadline', text: `${a.university}: funding/priority deadline in ${fdl} day${fdl === 1 ? '' : 's'}.` });
      if (a.feeWaiver === 'Available' && d != null && d >= 0) out.push({ kind: 'fee', text: `${a.university}: a fee waiver is available but not requested yet.` });
    });
    return out;
  }


  // Rough, transparent classifier for a professor's reply. The student can always change it.
  const REPLY_RULES = [
    ['Generic / auto-reply', /\b(out of (the )?office|automatic reply|auto-?reply|on leave until|limited access to email|away from (my )?email)\b/i],
    ['Negative', /\b(not (taking|accepting|recruiting|looking for)|no (open )?(positions?|openings|funding|space)|unable to (take|accept|supervise|support)|cannot (take|accept|supervise)|(lab|group) is full|not in a position to)\b/i],
    ['Redirect', /\b(you (may|might|could|should) (want to )?(contact|reach out|write to|email)|my colleague|better fit (for|with)|suggest (that )?you (contact|reach)|forward(ed)? your (email|cv))\b/i],
    ['Enthusiastic', /\b(schedule|set up|zoom|teams|skype|a (short |quick )?(call|chat|meeting)|meet (with )?you|talk (more|further)|interested in (your|having)|would (love|like) to (talk|chat|meet|discuss)|when are you (free|available)|send me your (transcripts?|writing sample|research statement))\b/i],
    ['Positive but cautious', /\b(encourage you to apply|please apply|apply (to|through) (the|our) (program|department)|funding (depends|is (not )?guaranteed|is limited)|cannot (promise|guarantee)|competitive|admissions committee decides|let me know (once|when) you (apply|have applied))\b/i]
  ];
  const NEXT_STEP = {
    'Enthusiastic': 'Reply within 24 hours. Offer 2-3 time slots in their time zone, confirm the platform, and prepare a 5-minute summary of your closest project.',
    'Positive but cautious': 'Thank them, apply by the deadline, mention their name in your SOP, and tell them once you have applied. Ask about TA/RA or fellowship options.',
    'Redirect': 'Thank them and email the person they suggested within a few days. Mention who referred you in the first line.',
    'Negative': 'Send a short thank-you. Ask if they know a colleague who is recruiting. Move on; this is common and not personal.',
    'Generic / auto-reply': 'No action yet. Check the return date and follow up a few days after it.'
  };
  function classifyReply(text) {
    const t = String(text || '');
    for (const [type, re] of REPLY_RULES) if (re.test(t)) return { type, next: NEXT_STEP[type] };
    return { type: 'Positive but cautious', next: NEXT_STEP['Positive but cautious'], unsure: true };
  }

  root.SM = root.SM || {};
  root.SM.tracker = { classifyReply, NEXT_STEP, APP_STATUS, DONE_STATUS, FEE_WAIVER, GRE, DOC_STATUS, YES_NO, STAGES, REPLY_TYPES, parse, iso, today, addBusinessDays, daysLeft, followUpDue, isFollowUpDue, dashboard, alerts };
})(typeof self !== 'undefined' ? self : globalThis);
