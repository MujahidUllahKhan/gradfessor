# Gradfessor by Afridi

**The right student for the right professor.**

Gradfessor (grad student + professor) is a free Chrome extension that helps graduate applicants find professors whose research really fits theirs, check program requirements against their own scores, and keep every application organised. Students stop wasting months on the wrong emails, and professors stop receiving irrelevant ones.

Everything is free. There is no account, no server and no paid API. Student data stays on the student's computer.

> Built by Mujahid Ullah Khan Afridi (NMSU). v0.4, free version.

## What it does

1. **Profile from your CV.** Upload a PDF or Word CV. Gradfessor suggests degrees with GPA, IELTS bands, TOEFL, GRE, skills, courses, publications and awards; the student approves each one. Add coursework with grades, research/work/teaching experience, Duolingo, PTE, GRE Subject, GMAT, links, target countries and funding needs.
2. **Rank a whole department in one click.** On a department's faculty page, click the extension → *Scan whole department*. It reads every profile politely in the background, finds each professor's recent papers for free (OpenAlex), and ranks everyone with transparent scores, shared keywords and gap keywords.
3. **Capture program requirements.** On a program's admissions page, click → *Capture program requirements*. Deadlines, funding deadline, application fee, fee waiver, IELTS/TOEFL/Duolingo/PTE minimums, GRE policy, minimum GPA, letters and documents are pulled out with the sentence they came from, then compared with the student's scores ("✓ your IELTS 7.5 meets 6.5", "✗ one band below 6.0").
4. **Write to the right professors.** Three email drafts per professor, a writing coach for SOP/CV/research statement/cover letter, *Open in Gmail/Outlook*, reply capture with next steps, and an AI prompt pack (free ChatGPT/Claude/Gemini) with plain-writing rules.
5. **A report for every university.** One click gives an **Excel workbook** (summary, programs & requirements with eligibility, ranked professors, checklist, profile) and a **Word report** (requirements, "you vs. requirements", best-fit professors with papers to read, outreach, next steps). Also one Excel file for all universities.

The profile is saved automatically and stays for every future application. Students lock it when done and edit only when they choose; an optional copy in their own Chrome account restores it on a new computer, and the app reminds them to back up every two weeks.

Plus a tracker for deadlines, fees and waivers, documents, professor outreach, business-day follow-ups, interviews (calendar files) and reminders.

## Install (for students)

Until it is on the Chrome Web Store:

1. Download `gradfessor-extension-v0.4.2.zip` and unzip it to a folder you keep (e.g. `Documents\Gradfessor`).
2. Chrome → `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → choose the unzipped folder.
3. Pin the **G✓** icon. Click it → **Open Gradfessor** → follow **Start here**.

Full walkthrough for students and workshops: [docs/STUDENT_GUIDE.md](docs/STUDENT_GUIDE.md).

## Why it stays free

| Feature | How |
|---|---|
| CV reading | pdf.js and mammoth run inside the extension; the file never leaves the computer |
| Department scan | The student's own browser, one page every 2.5 s, robots.txt respected |
| Papers and topics | OpenAlex from the student's browser (each student has their own free daily allowance) |
| Requirements capture | Reads the page the student has open, when they click |
| Email | Opens Gmail/Outlook with the draft; the student presses Send |
| AI writing | Prompt pack for the student's own free AI chat |
| Excel and Word reports | ExcelJS and docx, generated in the browser |

## Repository layout

```
extension/            Chrome extension (Manifest V3), the whole product
  manifest.json
  app.html            Start here · Profile · Professors · Writing coach · AI prompt pack · Tracker · University reports
  popup.html          Scan department · Capture program requirements · Capture professor page · Capture email reply
  background.js       Scan queue, robots.txt, inbox, reminders
  js/                 matcher, requirements, cvimport, reports, coach, prompts, tracker, openalex, export, app …
  lib/                ExcelJS (MIT), docx (MIT), pdf.js (Apache-2.0), mammoth (BSD-2) bundled locally
templates/            Blank Excel tracker
tests/                Unit tests, browser tests, fixtures (fake university site, sample CV, sample admissions page)
tools/                setup.js, package-extension.js, build-template.js
docs/                 Student guide, go-live checklist, store listing, privacy, terms, roadmap, pitch demo
```

## Development

```bash
npm install
npm test                               # 23 unit tests
npx playwright install chromium        # once (or set CHROME_PATH)
node tests/v04.playwright.js           # CV upload, requirements capture, reports inside the real extension
node tests/scan.playwright.js          # department scan on a fake university site
node tests/extension.playwright.js     # extension loads under MV3 rules
npm run package                        # dist/gradfessor-extension-v<version>.zip (for friends)
npm run package:store                  # Chrome Web Store build
```

## License

MIT. See [LICENSE](LICENSE). Third-party: ExcelJS (MIT), docx (MIT), pdf.js (Apache-2.0), mammoth (BSD-2-Clause); licence files are in `extension/lib/`. Paper data from [OpenAlex](https://openalex.org) (CC0).
