// One-time setup: puts your GitHub username (and repo name) into every file that needs it.
// Usage:  node tools/setup.js <github-username> [repo-name]
// Example: node tools/setup.js mujahid-afridi gradfessor
const fs = require('fs');
const path = require('path');

const [user, repo = 'gradfessor'] = process.argv.slice(2);
if (!user || !/^[A-Za-z0-9-]{1,39}$/.test(user)) {
  console.error('Usage: node tools/setup.js <github-username> [repo-name]');
  process.exit(1);
}
const root = path.join(__dirname, '..');
const appUrl = `https://${user.toLowerCase()}.github.io/${repo}/`;

// 1) manifest: which web address may talk to the extension
const manPath = path.join(root, 'extension', 'manifest.json');
const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
if (man.content_scripts && man.content_scripts[0]) man.content_scripts[0].matches = [`${appUrl}*`, 'http://localhost/*', 'http://127.0.0.1/*'];
man.homepage_url = `https://github.com/${user}/${repo}`;
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');

// 2) placeholders in other files
const files = ['extension/js/config.js', '.github/CODEOWNERS', 'README.md', 'docs/GO_LIVE.md', 'docs/SHARE_WITH_FRIENDS.md', 'docs/STORE_LISTING.md', 'docs/PRIVACY.md'];
files.forEach((rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return;
  const before = fs.readFileSync(p, 'utf8');
  const after = before
    .replace(/YOUR-USERNAME\.github\.io\/<repo-name>/g, `${user.toLowerCase()}.github.io/${repo}`)
    .replace(/YOUR-USERNAME\.github\.io\/gradfessor/g, `${user.toLowerCase()}.github.io/${repo}`)
    .replace(/github\.com\/YOUR-USERNAME\/gradfessor/g, `github.com/${user}/${repo}`)
    .replace(/YOUR-USERNAME/g, user);
  if (after !== before) { fs.writeFileSync(p, after); console.log('updated', rel); }
});

console.log(`\nDone. Your app address will be: ${appUrl}`);
console.log(`Your repository: https://github.com/${user}/${repo}`);
