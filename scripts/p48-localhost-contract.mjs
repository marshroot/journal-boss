import fs from 'node:fs';
import assert from 'node:assert/strict';

const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const env = fs.readFileSync('.env.example', 'utf8');
const upgrades = fs.readFileSync('backend/JournalBackend/Database/SqliteSchemaUpgrades.cs', 'utf8');
const adminUsers = fs.readFileSync('frontend/src/pages/AdminUsersPage.tsx', 'utf8');
const e2e = fs.readFileSync('frontend/e2e/business-workflow.spec.mjs', 'utf8');
const smoke = fs.readFileSync('scripts/compose-production-smoke.sh', 'utf8');

assert.ok(compose.includes('127.0.0.1:3000:80'), 'frontend should only bind localhost:3000');
assert.ok(compose.includes('Cors__Origins__0: ${CORS_ORIGIN:-http://localhost:3000}'), 'CORS default should be localhost');
assert.ok(!/^  proxy:/m.test(compose), 'public Caddy proxy must not be part of local default compose');
assert.ok(smoke.includes('http://127.0.0.1:3000/'), 'compose smoke test must probe localhost frontend');
assert.ok(e2e.includes("process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'"), 'E2E API must use the published frontend gateway rather than an unpublished backend port');
assert.ok(!/^  bot:/m.test(compose), 'Telegram registration bot must be removed');
assert.ok(env.includes('CORS_ORIGIN=http://localhost:3000'), 'env template should use local origin');
assert.ok(!env.includes('journalmod.dpdns.org'), 'env template must not use public domain');
assert.ok(upgrades.includes('EnsureAnnouncementColumns(conn)'), 'schema upgrade must invoke announcement migration');
assert.ok(upgrades.includes('ALTER TABLE announcements ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1'), 'migration should add is_published without dropping old rows');
assert.ok(adminUsers.includes('Родитель / куратор (одинаковые права)'), 'curator should be clearly documented as parent-equivalent');
assert.ok(!fs.existsSync('.env'), 'real .env must not be present in release source');
console.log('P48 localhost/migration/role contract: PASS');
