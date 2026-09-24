# Security

Gradfessor by Afridi has no server and no accounts. Student data is stored only in the student's browser (chrome.storage for the extension, IndexedDB for the desktop app). There is no central database to breach.

## Reporting a problem

Please do not open a public issue for security problems. Email the maintainer (see the GitHub profile) or use GitHub's "Report a vulnerability" button on the Security tab. You should get a reply within 7 days.

## What we protect against

- **Other websites reading your data:** the extension only answers pages whose address is listed in `manifest.json` → `content_scripts[0].matches`, and the background checks the sender's address again before answering.
- **Malicious text from scanned pages:** everything shown in the app is HTML-escaped, and only `http(s)` links are rendered.
- **Remote code:** all scripts are bundled. The app page has a strict Content Security Policy (`script-src 'self'`).
- **Broad permissions:** access to a university's site is requested only when the student clicks *Scan whole department*, and only for that domain.
- **Supply chain:** one runtime library (ExcelJS 4.4.0, bundled and pinned). Dependabot and CI run on every change; only the maintainer can merge to `main`.

## Rules for contributors

- Never commit API keys, tokens, passwords or real student data. Use the fictional demo data.
- Do not add analytics, trackers, remote scripts or new third-party requests without discussion.
- New permissions need a written reason in the pull request.
