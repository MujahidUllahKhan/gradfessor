# Roadmap

The plan is to ship a small free version that students actually use, learn from them, then add paid features that cost us money to run (servers, LLM calls, scraping proxies).

## v0.1: Free basic version (this repo)

- One academic profile: education + GPA/scale, IELTS (all bands), TOEFL, Duolingo, GRE, GMAT, interests, skills, coursework (optional), projects, publications, CV text
- Profile strength score with specific tips
- Professor entry by paste-assist (faculty page or Google Scholar text) or one-click capture of the current tab
- Transparent 4-axis match score, shared keywords, gap keywords, methods to add, plain-language rationale
- Writing coach for SOP, research statement, CV, cover letter and professor emails (rule-based, runs offline)
- Three email drafts per professor (formal, direct, warm) that force a personal sentence
- Outlines for SOP, research statement, cover letter and CV
- "Copy prompt for ChatGPT / Claude" so students can use any AI they already have
- Tracker: deadlines, funding deadlines, fees, fee waivers, GRE/English requirements, SOP/RS/LOR/transcript/score status, application status
- Outreach CRM: 9 stages, email sent date, follow-up due in business days, replies with type, interviews
- Desktop notifications for due follow-ups and deadlines within 7 days
- Excel export (Dashboard, Applications, Professor Outreach, Match Results, My Profile) with live formulas, dropdowns and colour coding; CSV export; JSON backup/restore

## v0.2: Desktop app + department scan (free) — done

- Installable desktop app (web app) with offline support, talking to the extension through a bridge, Zotero-style
- One-click department scan: finds every profile link on a faculty page, reads profiles in the background (robots.txt, 2.5 s between pages), imports and ranks them
- Free paper lookup through OpenAlex (titles, years, venues, abstracts, topics, open-access PDF links, h-index)
- Search shortcuts: profile, Google, Scholar, LinkedIn, openings
- Open in Gmail / Outlook with the draft filled in; capture a reply from the open email; reply classifier with next steps
- Interview calendar files (.ics)
- AI prompt pack with the student's facts, the professor's papers and keywords, document rules and humanizer rules, asking for PDF + Word output

## v0.3: Launch prep — done

- Renamed to Gradfessor by Afridi, new icon, credit line
- Security hardening (sender allowlist, safe links, CSP), CI, Dependabot, contributor and security policies
- One-command setup (`node tools/setup.js <username>`) and Chrome Web Store build (`npm run package:store`)

## v0.4: Extension-only free version — done

- Extension is the whole product (desktop web app optional, bridge removed from the store build)
- CV upload (PDF/Word) with reviewable suggestions; richer profile: coursework with grades, experience, TOEFL sections, PTE, GRE Subject, links, preferences
- Capture program requirements: deadlines, fee, fee waiver, IELTS/TOEFL/Duolingo/PTE, GRE policy, minimum GPA, letters, documents, with source sentences
- Eligibility check against the student's scores
- University reports: Excel and Word per university, one Excel for all
- Start here guide inside the app; student/workshop guide

## v0.5: Next free improvements

- Pick a university and field, and list researchers from OpenAlex before scanning
- Shared community list of faculty-page and admissions-page links (GitHub)
- Opt-in anonymous feedback button (testimonials, usage evidence)

- PDF and DOCX CV upload (pdf.js and mammoth.js bundled locally)
- Bundle fonts locally so the extension makes zero external requests
- Semantic Scholar as a second paper source when OpenAlex has no match
- Radar chart per professor; compare two professors side by side
- Chrome side panel mode so the dashboard can sit next to a faculty page
- On-device AI rewrite with Chrome's built-in Gemini Nano (free, on laptops that support it)
- Local folder of PDFs (read with pdf.js) linked to each professor
- Import programs from a CSV

## v1.0: Paid tier (Gradfessor Pro)

Features that need a backend, so they are paid:

| Feature | Why paid |
|---|---|
| Faculty discovery without visiting the page: type "University X, Department Y" | Needs a search API and a server |
| Automatic Google Scholar / lab page retrieval | Proxy costs and legal care; opt-in, rate-limited, clearly labelled |
| Department batch ranking | Many LLM/embedding calls |
| LLM feedback and rewrites in the student's voice (Claude API) | Per-token cost |
| Embedding-based matching (all-MiniLM-L6-v2 via transformers.js) | Heavier download; could stay local |
| Offer comparison and negotiation/extension email drafts | Premium workflow |
| Sync across devices | Needs accounts and storage |

Suggested pricing to test: Free, Student $9/month, Pro $19/month, University licence $2,000-8,000/year.

## Guardrails that stay in every version

- No one-click sending of emails. Drafts always contain a sentence the student must write.
- Daily cap on email drafts in the paid tier to avoid flooding professors.
- Scores are labelled as text-overlap guides, never admission predictions.
- Gap keyword advice says: add it only if it is true.
