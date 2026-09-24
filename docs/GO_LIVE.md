# Gradfessor by Afridi: going live, line by line

Tick each box as you go. About 2-3 hours in total, spread over a few days (the email to Arrowhead and the Chrome Web Store review take time).

**Already done for you in this repository:** renamed to Gradfessor by Afridi, new icon, security hardening, contributor/security files, tests, a setup script that fills in your GitHub username, a store build command, the Arrowhead email draft (`docs/EMAIL_ARROWHEAD.md`) and all Chrome Web Store texts (`docs/STORE_LISTING.md`).

**Only you can do:** anything that needs your accounts, your signature or a payment. Those are the steps below.

---

## Day 1: protect yourself (45 min)

- [ ] **1. Send the ownership email.** Open `docs/EMAIL_ARROWHEAD.md`, fill the [brackets], send it. You can keep working while you wait; just don't make the repository public or publish to the store until they reply. (NMSU policy ARP 11.05: IP made while a student is paid by the university can be university IP, so get this in writing.)
- [ ] **2. Check the name.** Search "Gradfessor" on: tmsearch.uspto.gov, the Chrome Web Store, Google, and github.com. If something close exists in education software, tell me and I'll rename again (it's a one-command change now).
- [ ] **3. GitHub account.** Sign in or sign up at github.com with your personal email. Pick a username you'll keep (for example `mujahid-afridi`). Settings → Password and authentication → turn on **two-factor authentication** with an authenticator app. Save the recovery codes somewhere offline.
- [ ] **4. Student Pack.** education.github.com/pack → apply with your NMSU email (free GitHub Pro while you're a student).
- [ ] **5. Google account for the store.** Use a personal Google account and turn on **2-Step Verification** (Google requires it for publishing).

## Day 1: put the code on GitHub (30 min)

- [ ] **6. Install GitHub Desktop** (desktop.github.com) and sign in. (Node.js from nodejs.org is only needed later, to build the Chrome Web Store zip yourself.)
- [ ] **7. Unzip the project** to a folder you'll keep, e.g. `Documents\gradfessor`.
- [x] **8. Fill in your username.** Done for you (`MujahidUllahKhan`): the extension only talks to `https://mujahidullahkhan.github.io/gradfessor/`. If you ever change username or repo name, run `npm install` then `node tools/setup.js <username> <repo>`.
- [ ] **9. Publish privately.** GitHub Desktop → File → Add local repository → choose the folder (it's already a git repository) → **Publish repository** → name `gradfessor`, keep **"Keep this code private" ticked**.
- [ ] **10. Protect `main`.** On github.com → your repo → Settings:
  - Branches → Add branch ruleset for `main`: require a pull request before merging (1 approval), require status checks (CI), block force pushes. Tick "allow bypass" for yourself only if you work alone for now.
  - Code security: turn on Dependabot alerts, Dependabot security updates, secret scanning and push protection, and CodeQL default setup.
  - Actions → General: "Read repository contents" permission for workflows.

## Day 2: put the app online (15 min)

- [ ] **11. GitHub Pages.** Repo → Settings → Pages → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → Save. (Private repo Pages works with GitHub Pro from the Student Pack.)
- [ ] **12. Wait 1-2 minutes**, then open `https://mujahidullahkhan.github.io/gradfessor/`. It forwards to the app.
- [ ] **13. Load the extension.** Chrome → `chrome://extensions` → Developer mode ON → **Load unpacked** → choose the `extension` folder inside your project → pin the Gradfessor icon.
- [ ] **14. Check the connection.** Reload the app page. The left sidebar should say **Extension connected (v0.3.0)**. Click **Install desktop app** in the app.

## Days 2-8: use it yourself

- [ ] **15.** Fill **My profile** with your real data.
- [ ] **16.** Scan 3-4 real departments you're targeting (faculty page → Gradfessor icon → Scan whole department). Note any university where it finds nothing; send me the page address and I'll adapt the scanner.
- [ ] **17.** Use the tracker, email drafts and prompt pack for your own Fall 2027 applications. Write down what annoys you.

## Day 9: small beta (5-10 friends)

- [ ] **18.** Run `npm run package` → send `dist/gradfessor-extension-v0.3.0.zip`, the app link, and `docs/SHARE_WITH_FRIENDS.md`.
- [ ] **19.** Make a short Google Form for feedback (what worked, what broke, would you recommend it). Don't ask for their CVs or scores.
- [ ] **20.** Remind them to click **Backup** weekly.

## After Arrowhead replies: go public

- [ ] **21. Licence.** Decide: MIT (simplest, anyone may reuse) or AGPL-3.0 (copies must stay open). Tell me and I'll switch the files.
- [ ] **22. Make the repository public** (Settings → General → Danger zone → Change visibility). Pages keeps working.
- [ ] **23. Chrome Web Store.** chrome.google.com/webstore/devconsole → register (one-time fee, about US$5) → verify your contact email.
- [ ] **24. Store build:** `npm run package:store` → upload `dist/gradfessor-extension-v0.3.0-store.zip`. (This build only talks to your GitHub Pages address; localhost is removed.)
- [ ] **25. Fill the listing** by copying from `docs/STORE_LISTING.md` (store listing, privacy practices, permission justifications). Add 3-5 screenshots made with the demo data.
- [ ] **26. Visibility: Unlisted** → Submit for review. Reviews usually take a few days.
- [ ] **27. When approved,** send friends the store link instead of the zip (no more developer mode). After 2-3 weeks, switch to **Public**.

## Every update after that

1. Change code on a branch → pull request → CI must pass → merge.
2. Bump the version in `extension/manifest.json`, `package.json`, `extension/sw.js` (cache name) and `extension/app.html` (`app-version`).
3. The web app updates on merge. For the extension: `npm run package:store` → upload in the developer console.
4. Tag the release on GitHub (`v0.3.1`) with 2-3 lines of what changed.

## Contributors

- They fork, branch, and open a pull request; they never push to `main`.
- `CONTRIBUTING.md` asks them to sign off commits (`git commit -s`). If you plan a paid version that uses their code, switch to a CLA (the free "CLA Assistant" app) before accepting outside code; ask Arrowhead to check the CLA text.
- Review each pull request for: new permissions, new network requests, API keys, real personal data.

## Why there is no login (and when to add one)

- No accounts means no user database: nothing to breach, no passwords to protect, no server bills.
- The extension and the app connect on the same computer through the bridge, which only answers your app's exact address.
- Add login only for a feature that needs it (sync across devices, paid plans). Then use a managed sign-in (Google sign-in via Supabase or Firebase Auth), never store passwords yourself, and encrypt student data on the device before upload.

## Risks and how Gradfessor avoids them

| Risk | What the project does |
|---|---|
| Data breach | No server or database; data lives in each student's browser |
| Another site reading students' data | Extension answers only your app's exact address and re-checks the sender |
| Scraping complaints | Only public faculty pages the student picks, robots.txt respected, 2.5 s between pages; no Google Scholar, LinkedIn or inbox scraping |
| Spam complaints from professors | No auto-sending; every draft needs a personal sentence; the student presses Send |
| Misleading claims | Scores are labelled guides; gap keywords "only if true"; terms say no admission prediction |
| Leaked keys | No keys in the code; secret scanning and push protection on; the OpenAlex key stays in the user's browser and is removed from backups |
| Ownership disputes | Written answer from Arrowhead, checked name, clear licence, contributor sign-offs |

This is practical guidance, not legal advice. Arrowhead Center can review the ownership, licence and terms questions for free.
