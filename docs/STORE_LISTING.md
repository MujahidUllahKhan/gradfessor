# Chrome Web Store listing: text to paste

## Store listing tab

**Name** (from manifest): Gradfessor by Afridi

**Summary** (from manifest, 132 characters max):
The right student for the right professor. Rank professors by research fit, improve your SOP and emails, track applications. Free.

**Category:** Education · **Language:** English

**Description:**

The right student for the right professor.

Gradfessor (grad student + professor) helps graduate applicants find professors whose research fits theirs, without opening dozens of faculty pages. Students save months of guesswork, and professors get fewer irrelevant emails.

What it does:
- Build your profile from your CV (PDF or Word, read on your computer): degrees and GPA, IELTS/TOEFL/GRE, skills, courses.
- Capture program requirements from any admissions page: deadlines, IELTS/TOEFL/Duolingo minimums, GRE policy, minimum GPA, fee and fee waiver, and see if you meet them.
- Download an Excel and Word report for every university.
- Scan a whole department: open a faculty list page, click Scan, and Gradfessor reads each public profile in the background and ranks every professor against your profile.
- Free paper lookup: recent papers, topics and open-access PDF links from OpenAlex.
- Clear match scores: topic fit, overlap with their papers, shared methods and research style, plus the keywords you share and the ones you are missing.
- Writing coach for your SOP, research statement, CV, cover letter and professor emails, with three email drafts per professor.
- Open drafts in Gmail or Outlook; capture a professor's reply with one click and get a suggested next step.
- Application tracker: deadlines, fees and fee waivers, GRE/English requirements, documents, follow-ups (in business days), interviews and reminders. Export to Excel.
- AI prompt pack: one complete prompt with your facts and plain-writing rules to use with ChatGPT, Claude or Gemini.

Private by design: there is no account and no Gradfessor server. Your profile, documents and tracker stay on your computer.

Scores are text-overlap guides, not admission predictions. Gradfessor never sends emails for you.

Built by Mujahid Ullah Khan Afridi. Free.

**Screenshots (1280×800):** Professors ranking · Department scan in progress · Writing coach on an email · Tracker · AI prompt pack. Use the demo data (fictional names).

**Official URL / homepage:** https://github.com/MujahidUllahKhan/gradfessor
**Support URL:** https://github.com/MujahidUllahKhan/gradfessor/issues

## Privacy practices tab

**Single purpose:**
Help graduate school applicants find professors whose research matches theirs, improve their application documents, and track their applications.

**Permission justifications:**

| Permission | Justification |
|---|---|
| storage | Saves the user's profile, professor list and application tracker on their own device. |
| unlimitedStorage | A department scan stores dozens of public faculty profiles; this avoids the default 10 MB limit. |
| activeTab | Reads the page the user is viewing, only when they click Capture or Scan in the popup. |
| scripting | Runs the one-time text capture or profile-link finder on the active tab after the user clicks. |
| alarms | Twice-daily local check for follow-ups and deadlines. |
| notifications | Shows a reminder when a follow-up or deadline is due. |
| Host permission api.openalex.org | Looks up professors' public publications in the OpenAlex database. |
| Optional host permissions (http/https) | Requested only when the user clicks "Scan whole department", and only for that university's domain, to read public faculty profile pages. |

**Remote code:** No. All JavaScript is included in the package.

**Data usage:** To be safe, tick *Personally identifiable information* (profile the user types), *Personal communications* (a professor reply the user captures) and *Website content* (faculty pages they scan). Then tick all three certifications: not sold to third parties; not used for purposes unrelated to the single purpose; not used for creditworthiness or lending. State: data is stored only on the user's device and is not transmitted to the developer.

**Privacy policy URL:** https://github.com/MujahidUllahKhan/gradfessor/blob/main/docs/PRIVACY.md

## Distribution tab

Visibility: **Unlisted** for the beta. Switch to Public after 2-3 weeks of feedback.
