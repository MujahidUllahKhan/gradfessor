// Zips extension/ into dist/.
//   npm run package        -> test build (keeps localhost so the local desktop app can connect)
//   npm run package:store  -> Chrome Web Store build (removes localhost, fails if setup.js was not run)
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const store = process.argv.includes('--store');
const root = path.join(__dirname, '..');
const src = path.join(root, 'extension');
const man = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gradfessor-pkg-'));
fs.cpSync(src, tmp, { recursive: true });

if (store && man.content_scripts && man.content_scripts[0]) {
  const matches = man.content_scripts[0].matches;
  if (matches.some((m) => m.includes('*.github.io'))) {
    console.error('Run `node tools/setup.js <your-github-username>` first, so only YOUR app address can talk to the extension.');
    process.exit(1);
  }
  man.content_scripts[0].matches = matches.filter((m) => !/localhost|127\.0\.0\.1/.test(m));
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(man, null, 2));
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', `gradfessor-extension-v${man.version}${store ? '-store' : ''}.zip`);
if (fs.existsSync(out)) fs.unlinkSync(out);
execSync(`zip -r -q "${out}" . -x "*.DS_Store"`, { cwd: tmp, stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Wrote', out);
