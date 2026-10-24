import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  ['Backend project', 'backend/JournalBackend/JournalBackend.csproj'],
  ['Backend tests', 'backend/JournalBackend.Tests/JournalBackend.Tests.csproj'],
  ['Frontend package lock', 'frontend/package-lock.json'],
  ['Playwright business E2E', 'frontend/e2e/business-workflow.spec.mjs'],
  ['Production compose smoke', 'scripts/compose-production-smoke.sh'],
  ['Backup restore smoke', 'scripts/backup-restore-smoke.mjs'],
  ['Backup restore contract', 'scripts/backup-restore-contract.mjs'],
  ['Realtime two-client harness', 'scripts/realtime-two-client.mjs'],
  ['Integration contracts', 'scripts/realtime-contract-check.mjs'],
  ['External service contracts', 'scripts/external-service-contract-check.mjs'],
  ['Security documentation', 'docs/SECURITY.md'],
  ['Testing documentation', 'docs/TESTING.md'],
  ['Deployment documentation', 'docs/DEPLOYMENT.md'],
  ['Architecture documentation', 'docs/ARCHITECTURE.md'],
  ['Backup documentation', 'docs/BACKUPS.md'],
  ['Diagrams', 'docs/DIAGRAMS.md'],
  ['External credential protector', 'backend/JournalBackend/Services/Security/ExternalCredentialProtector.cs'],
  ['P52 changelog', 'CHANGELOG_P52.md'],
  ['P53 changelog', 'CHANGELOG_P53.md'],
  ['P54 changelog', 'CHANGELOG_P54.md'],
  ['P55 changelog', 'CHANGELOG_P55.md'],
  ['P56 changelog', 'CHANGELOG_P56.md'],
  ['P57 changelog', 'CHANGELOG_P57.md'],
  ['P58 changelog', 'CHANGELOG_P58.md'],
  ['P59 changelog', 'CHANGELOG_P59.md'],
  ['P60 changelog', 'CHANGELOG_P60.md'],
  ['P61 changelog', 'CHANGELOG_P61.md'],
  ['P62 changelog', 'CHANGELOG_P62.md'],
  ['P63 changelog', 'CHANGELOG_P63.md'],
  ['P64 changelog', 'CHANGELOG_P64.md'],
  ['P65 changelog', 'CHANGELOG_P65.md'],
  ['P66 changelog', 'CHANGELOG_P66.md'],
  ['P67 changelog', 'CHANGELOG_P67.md'],
  ['P68 changelog', 'CHANGELOG_P68.md'],
  ['P69 changelog', 'CHANGELOG_P69.md'],
  ['P70 changelog', 'CHANGELOG_P70.md'],
  ['P71 changelog', 'CHANGELOG_P71.md'],
  ['P72 changelog', 'CHANGELOG_P72.md'],
  ['P73 changelog', 'CHANGELOG_P73.md'],
  ['P74 changelog', 'CHANGELOG_P74.md'],
  ['P75 changelog', 'CHANGELOG_P75.md'],
  ['Local Windows launcher contract', 'frontend/tests/local-launcher-contract.test.mjs'],
  ['P52 requirements matrix', 'docs/FINAL_REQUIREMENTS_MATRIX_P52.md'],
  ['Historical P45 contract updated for localhost', 'scripts/p45-compose-contract.mjs'],
  ['Historical P46 contract updated for localhost', 'scripts/p46-compose-contract.mjs'],
  ['P48 localhost contract', 'scripts/p48-localhost-contract.mjs'],
  ['Legacy session-token audit', 'scripts/legacy-session-token-audit.mjs'],
  ['Legacy session-token audit report', 'docs/LEGACY_SESSION_TOKEN_AUDIT_P52.md'],
  ['Legacy session-token client audit', 'scripts/legacy-session-token-client-audit.mjs'],
  ['Legacy session-token client audit report', 'docs/LEGACY_SESSION_TOKEN_CLIENT_AUDIT_P53.md'],
  ['Legacy session-token action map', 'docs/LEGACY_SESSION_TOKEN_ACTION_MAP_P56.md']
];

const failures = [];
for (const [label, rel] of required) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`${label}: missing ${rel}`);
}

const program = fs.readFileSync(path.join(root, 'backend/JournalBackend/Program.cs'), 'utf8');
if (program.includes('MapControllers().RequireRateLimiting("api")')) {
  failures.push('Backend still references undefined named rate-limit policy "api".');
}
if (!program.includes('options.GlobalLimiter = PartitionedRateLimiter.Create')) {
  failures.push('Global rate limiter is missing.');
}

const tests = fs.readFileSync(path.join(root, 'backend/JournalBackend.Tests/SecurityTests.cs'), 'utf8');
if (!tests.includes('SqliteSchemaUpgrade_AddsAnnouncementPublicationFlagWithoutLosingRows')) failures.push('SQLite legacy announcement migration regression test is missing.');

const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
if (compose.includes('"3000:80"')) failures.push('Frontend port 3000 is exposed on all interfaces; production should keep it loopback-only.');
if (!compose.includes('"127.0.0.1:3000:80"')) failures.push('Expected loopback-only frontend debug port mapping is missing.');

const controllers = fs.readdirSync(path.join(root, 'backend/JournalBackend/Controllers'));
if (controllers.includes('CodeLabController.cs.tmp')) failures.push('Empty temporary CodeLabController.cs.tmp remains in source tree.');

const versionFile = fs.existsSync(path.join(root, 'VERSION')) ? 'VERSION' : 'VERSION.txt';
const version = fs.readFileSync(path.join(root, versionFile), 'utf8').trim();
// Supported versions run from the P52 audit baseline up to the newest phase; a phase
// newer than the script simply needs its changelog listed below (see required[]).
const phaseMatch = /^v23-P(\d{2,})$/.exec(version);
if (!phaseMatch || Number(phaseMatch[1]) < 52) failures.push(`${versionFile} is ${version}, expected v23-P52 or newer.`);
if (fs.existsSync(path.join(root, '.env'))) failures.push('A real .env file must not be included in the release archive.');
if (!compose.includes('http://localhost:3000')) failures.push('Localhost CORS default is missing.');
const p45Contract = fs.readFileSync(path.join(root, 'scripts/p45-compose-contract.mjs'), 'utf8');
const p46Contract = fs.readFileSync(path.join(root, 'scripts/p46-compose-contract.mjs'), 'utf8');
if (p45Contract.includes('DOMAIN=journalmod.dpdns.org') || p45Contract.includes('CORS_ORIGIN=https://journalmod.dpdns.org')) failures.push('Historical P45 contract still requires the retired public domain.');
if (p46Contract.includes('DOMAIN=journalmod.dpdns.org') || p46Contract.includes('CORS_ORIGIN=https://journalmod.dpdns.org')) failures.push('Historical P46 contract still requires the retired public domain.');
const matrix = fs.readFileSync(path.join(root, 'docs/FINAL_REQUIREMENTS_MATRIX_P52.md'), 'utf8');
if (!matrix.includes('Legacy controllers still use')) failures.push('Security matrix must explicitly record the legacy session-token acceptance blocker.');
if (!matrix.includes('Curator is exactly the Parent role')) failures.push('P52 matrix must preserve the agreed curator/parent permission equivalence.');
if (/^  proxy:/m.test(compose)) failures.push('Public proxy service should not be in the default local compose.');
if (/^  bot:/m.test(compose) || compose.includes('profiles: ["telegram"]')) failures.push('Dedicated Telegram registration bot must be removed from Compose.');
const authController = fs.readFileSync(path.join(root, 'backend/JournalBackend/Controllers/AuthController.cs'), 'utf8');
for (const route of ['register-session', 'complete-registration', 'registration-status', 'submit-journal-credentials']) { if (authController.includes(route)) failures.push(`Telegram registration route remains: ${route}`); }
const landing = fs.readFileSync(path.join(root, 'frontend/src/pages/LandingPage.tsx'), 'utf8');
if (landing.includes('TelegramAuthModal') || landing.includes('sessionToken')) failures.push('Landing page still contains Telegram login flow.');
if (fs.existsSync(path.join(root, 'frontend/src/components/Modals.tsx'))) failures.push('Legacy Telegram auth modals file remains.');

if (failures.length) {
  console.error(`FINAL AUDIT FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`FINAL AUDIT PASS: ${required.length} required release artifacts + security/production contracts`);
