#!/usr/bin/env node
/**
 * Operational backup + restore smoke test.
 *
 * WARNING: restore replaces the configured database and attachments. This test
 * is intentionally disabled unless the operator explicitly confirms a disposable
 * test instance. Never point it at a real or shared installation.
 */
import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.BACKUP_SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const login = process.env.BACKUP_SMOKE_ADMIN_LOGIN;
const password = process.env.BACKUP_SMOKE_ADMIN_PASSWORD;
const archive = process.env.BACKUP_SMOKE_ARCHIVE;

if (process.env.BACKUP_SMOKE_CONFIRM !== 'I_UNDERSTAND_THIS_IS_A_TEST_INSTANCE') {
  console.error('Refusing to run: set BACKUP_SMOKE_CONFIRM to the exact test-instance confirmation.');
  process.exit(2);
}
if (!login || !password || !archive) {
  console.error('Required: BACKUP_SMOKE_ADMIN_LOGIN, BACKUP_SMOKE_ADMIN_PASSWORD, BACKUP_SMOKE_ARCHIVE');
  process.exit(2);
}

const loginForToken = async () => {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login, password })
  });
  if (!response.ok) throw new Error(`login failed: ${response.status}`);
  const body = await response.json();
  const token = body.token || body.accessToken;
  if (!token) throw new Error('login response did not contain token/accessToken');
  return token;
};

const token = await loginForToken();
const backupResponse = await fetch(`${base}/api/admin/backups`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
if (!backupResponse.ok) throw new Error(`backup failed: ${backupResponse.status}`);
const bytes = Buffer.from(await backupResponse.arrayBuffer());
if (bytes.length < 100) throw new Error(`backup is suspiciously small: ${bytes.length} bytes`);
fs.mkdirSync(path.dirname(path.resolve(archive)), { recursive: true });
fs.writeFileSync(archive, bytes);
console.log(`PASS backup created (${bytes.length} bytes): ${archive}`);

// The restore is deliberately part of this test now, but only after the explicit
// destructive-test opt-in above. It restores the exact snapshot just created.
const form = new FormData();
form.set('archive', new Blob([bytes], { type: 'application/zip' }), path.basename(archive));
const restoreResponse = await fetch(`${base}/api/admin/backups/restore`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form
});
const restoreText = await restoreResponse.text();
if (!restoreResponse.ok) throw new Error(`restore failed: ${restoreResponse.status}: ${restoreText.slice(0, 1000)}`);
console.log('PASS backup restore endpoint accepted and restored the generated archive.');

// The endpoint recommends a service restart after replacing SQLite. Verify the
// application remains reachable and credentials still work before declaring smoke pass.
const health = await fetch(`${base}/health`);
if (!health.ok) throw new Error(`post-restore health failed: ${health.status}`);
await loginForToken();
console.log('PASS post-restore health and administrator login.');
