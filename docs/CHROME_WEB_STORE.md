# Publishing to the Chrome Web Store (free listing)

1. Register a developer account at https://chrome.google.com/webstore/devconsole (one-time fee, currently USD 5; check the current amount).
2. `npm run package` to create `dist/gradfessor-extension-v<version>.zip`.
3. New item, upload the zip.
4. **Store listing:** name, short description (from `manifest.json`), 1280x800 screenshots of each tab (use `node tests/smoke.playwright.js`, then resize), the 128 px icon, category "Education".
5. **Privacy practices tab:**
   - Single purpose: "Help graduate applicants match with professors, improve application documents and track applications."
   - Justify each permission with the table in `docs/PRIVACY.md`.
   - Data usage: tick "Personally identifiable information" and "Website content" as *collected but stored only locally*; declare that data is not sold or transferred.
   - Privacy policy URL: publish `docs/PRIVACY.md` (GitHub Pages or the repo link).
6. Remote code: the extension bundles all JavaScript. Before submitting, consider bundling the fonts locally too (v0.2 item) to avoid questions.
7. Set the content script match in `manifest.json` to your exact app address before packaging (see README).
8. Explain optional host permissions: "Requested only when the user clicks Scan whole department, for that university's domain, to read public faculty profile pages."
9. Submit for review. Reviews usually take a few days.

Bump `version` in `manifest.json` and `package.json` for every update.
