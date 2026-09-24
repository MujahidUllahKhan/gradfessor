# Gradfessor by Afridi privacy policy (v0.3)

Last updated: September 2026

**Short version:** your data stays in your browser. We do not have a server, and we cannot see your profile, documents or tracker.

## What the extension stores

Your profile (education, test scores, interests, skills, projects, CV text), the professors you add, your drafts, and your tracker rows. All of it is saved with `chrome.storage.local` on your computer. When `app.html` is opened as a normal web page instead of an extension, it uses the browser's `localStorage` for the same site.

## What leaves your computer

Nothing the extension collects goes to us; there is no Gradfessor server.

- **Department scan:** when you click *Scan whole department*, your browser downloads the public profile pages of that department, the same pages you could open yourself. It reads robots.txt first and waits about 2.5 seconds between pages.
- **Paper lookup:** your browser sends professor names to OpenAlex (api.openalex.org) to find their papers. Your own profile is never sent. If you add an OpenAlex key, it is sent with those requests.
- **Chrome account copy (optional, off by default):** if you tick "Keep a copy in my Chrome account", your profile is stored with Chrome sync in your own Google account so it can be restored on another computer. Gradfessor never sees it. Untick the box or click *Delete my data* to remove it.
- **CV upload:** your PDF or Word CV is read inside the extension (pdf.js / mammoth). The file is never uploaded.
- **Program requirements:** *Capture program requirements* reads only the admissions page you have open, when you click.
- **Email:** *Open in Gmail/Outlook* opens your own email with the draft filled in; nothing is sent until you press Send. *Capture this email reply* reads only the email you have open, when you click. The dashboard loads a font stylesheet from Google Fonts; that request contains no personal data, and the app works without it. Files you export (Excel, CSV, JSON backup) are saved to your own downloads folder.

## Permissions and why

| Permission | Used for |
|---|---|
| `storage` | Saving your data locally |
| `activeTab` + `scripting` | Reading the tab you are on, only when you click a capture or scan button |
| Optional access to a university's site | Asked when you click *Scan whole department*, only for that university's domain |
| `api.openalex.org` | Free paper lookup |
| `unlimitedStorage` | Department scans can be larger than the default 10 MB |
| `alarms` + `notifications` | Twice-daily reminder when a follow-up or deadline is due |

The extension does not run on pages automatically and does not read your browsing history.

## Deleting your data

Click **Delete my data** in the dashboard, or remove the extension. Both erase everything stored by Gradfessor by Afridi.

## Contact

Mujahid Ullah Khan Afridi, New Mexico State University. mujahida@nmsu.edu
