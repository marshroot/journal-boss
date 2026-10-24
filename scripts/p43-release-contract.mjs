import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const version = read('VERSION').trim();
const matrix = read('docs/FINAL_REQUIREMENTS_MATRIX_P50.md');
const changelog = read('CHANGELOG_P50.md');
const checks = [
  ['current release version is identified', /^v23-P\d+$/.test(version)],
  ['collaboration URL template is empty for same-origin fallback', read('.env.example').includes('VITE_COLLAB_URL=\n')],
  ['frontend supports same-origin collaboration fallback', read('frontend/src/lib/collab.ts').includes("window.location.protocol === 'https:' ? 'wss:' : 'ws:'")],
  ['current requirements matrix exists', fs.existsSync('docs/FINAL_REQUIREMENTS_MATRIX_P50.md')],
  ['current changelog exists', fs.existsSync('CHANGELOG_P50.md')],
  ['incomplete legacy auth is not misrepresented as complete', matrix.includes('Legacy controllers still use') && changelog.includes('does not claim that the whole product is production-complete')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
process.exitCode = failed ? 1 : 0;
