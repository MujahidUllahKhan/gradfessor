# Sharing Gradfessor with friends (free)

Two things to share: the desktop app (a web address they install) and the extension (a zip they load, until it is on the Chrome Web Store).

## 1. Put the desktop app online (GitHub Pages, free)

Follow `docs/GO_LIVE.md` steps 3-14. Your app is then at `https://mujahidullahkhan.github.io/gradfessor/` (it forwards to `extension/app.html`).

## 2. Share the extension

Until it is published on the Chrome Web Store:

1. `npm run package` → `dist/gradfessor-extension-v0.3.0.zip`.
2. Send the zip (WhatsApp/Drive). Friends unzip it to a folder they will keep, e.g. `Documents\Gradfessor`.
3. Chrome → `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick the unzipped folder → pin the icon.

Chrome may show a "developer mode extensions" notice on start; that is expected for unpacked extensions and disappears once it is on the Web Store.

## 3. Friend's first 10 minutes

1. Open the app link in Chrome → click **Install desktop app**. It now opens from the Start menu / Dock.
2. **My profile**: fill education, GPA, IELTS/GRE, interests (5+ specific ones), skills, projects; paste CV text.
3. Open a department's *Faculty* page → click the Gradfessor icon → **Scan whole department** → allow access to that university's site.
4. Come back to the app: professors appear and get ranked as papers are found.
5. Pick the top 5. **Draft email** → write the one personal sentence → **Open in Gmail** → send → **Sent today** in the Tracker.
6. When a professor replies: open the reply in Gmail → Gradfessor icon → **Capture this email reply** → check the type → **Log reply**.
7. **AI prompt pack** → pick SOP / CV / proposal → copy → paste in ChatGPT, Claude or Gemini → download the PDF → check it in the Writing coach.

## Laptop requirements

Any laptop that runs current Chrome (Windows 10/11, macOS, Linux). Everything runs locally; data use is small (a department scan is a few MB). Microsoft Edge and Brave also run Chrome extensions.
