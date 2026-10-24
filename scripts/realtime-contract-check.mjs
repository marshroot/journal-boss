#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assert = (condition, message) => {
  if (!condition) failures.push(message);
  else console.log(`PASS ${message}`);
};

const collab = read('collab/server.js');
const compose = read('docker-compose.yml');
const caddy = read('Caddyfile');
const backup = read('backend/JournalBackend/Controllers/AdminBackupController.cs');
const program = read('backend/JournalBackend/Program.cs');
const protector = read('backend/JournalBackend/Services/Security/ExternalCredentialProtector.cs');

assert(collab.includes('p.aud !== \'JournalCollab\''), 'Hocuspocus requires the dedicated JournalCollab audience');
assert(collab.includes('claims.collab_room !== documentName'), 'Hocuspocus binds JWT to the requested document');
assert(collab.includes('p.exp < now'), 'Hocuspocus rejects expired collaboration tokens');
assert(collab.includes('p.nbf && p.nbf > now + 5'), 'Hocuspocus validates not-before with bounded clock skew');
assert(!/ports:\s*\n\s*-\s*["\']?1234/.test(compose), 'collaboration service is not published directly to the host');
assert(compose.includes('collab_data:/data'), 'collaboration persistence uses a named volume');
assert(caddy.includes('reverse_proxy frontend:80'), 'production TLS proxy forwards through the frontend gateway');
assert(backup.includes('collab/collab.sqlite'), 'backup includes collaboration SQLite storage');
assert(backup.includes('dataprotection/keys/'), 'backup includes Data Protection key ring');
assert(program.includes('PersistKeysToFileSystem'), 'Data Protection uses a persistent key ring');
assert(program.includes('ExternalCredentialProtector'), 'startup registers external credential protector');
assert(protector.includes('enc:v1:'), 'external credentials use an explicit encrypted-at-rest version prefix');
const versionFile = fs.existsSync(path.join(root, 'VERSION')) ? 'VERSION' : 'VERSION.txt';
const version = fs.readFileSync(path.join(root, versionFile), 'utf8').trim();
assert(backup.includes('ReadProjectVersion()') && backup.includes('JOURNAL_VERSION') && backup.includes('AppContext.BaseDirectory'), 'backup manifest resolves the release version in source and container layouts');
assert(compose.includes(`JOURNAL_VERSION: \${JOURNAL_VERSION:-${version}}`), 'compose supplies the current release version to backup manifests');
assert(/^v23-P\d+$/.test(version), `${versionFile} identifies the current v23 release`);

if (failures.length) {
  console.error(`\n${failures.length} realtime contract check(s) failed.`);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log('\nAll realtime contract checks passed.');
