import fs from 'node:fs';
import assert from 'node:assert/strict';

// Historical release checks are retained for traceability, but must validate
// the current localhost-only contract rather than resurrecting the old domain.
const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const env = fs.readFileSync('.env.example', 'utf8');

for (const token of [
  'MYSTAT_RATE_LIMIT_MS: ${MYSTAT_RATE_LIMIT_MS:-0}',
  'Judge0__Url: ${JUDGE0_URL:-}',
  '127.0.0.1:3000:80',
  'Cors__Origins__0: ${CORS_ORIGIN:-http://localhost:3000}',
]) assert.ok(compose.includes(token), `missing compose contract: ${token}`);

for (const token of [
  'CORS_ORIGIN=http://localhost:3000',
  'MYSTAT_RATE_LIMIT_MS=0',
  'JUDGE0_URL=http://host.docker.internal:2358',
  'VITE_COLLAB_URL=',
]) assert.ok(env.includes(token), `missing local env contract: ${token}`);

assert.ok(!env.includes('journalmod.dpdns.org'), 'release env template must not point at public domain');
assert.ok(!/^  bot:/m.test(compose), 'Telegram registration bot must be removed');

console.log('P45 compatibility contract: PASS');
