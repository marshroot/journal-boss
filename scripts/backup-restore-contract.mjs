import fs from 'node:fs';
import assert from 'node:assert/strict';

const controller = fs.readFileSync('backend/JournalBackend/Controllers/AdminBackupController.cs', 'utf8');
const smoke = fs.readFileSync('scripts/backup-restore-smoke.mjs', 'utf8');
const compose = fs.readFileSync('docker-compose.yml', 'utf8');

assert.match(controller, /\[HttpPost\]\s*public async Task<IActionResult> Create/,
  'backup creation must use POST');
assert.match(controller, /\[HttpPost\("restore"\)\]/,
  'restore endpoint must be POST /restore');
assert.match(controller, /PRAGMA integrity_check;/,
  'restore must validate the SQLite database before replacing the live file');
assert.match(controller, /\.before-restore-/,
  'restore must create a pre-restore database safety copy');
assert.match(controller, /manifest\.txt/,
  'backup and restore must validate a manifest');
assert.match(smoke, /method: 'POST'[\s\S]*api\/admin\/backups/,
  'smoke test must call backup creation with POST');
assert.match(smoke, /api\/admin\/backups\/restore/,
  'smoke test must exercise the restore endpoint');
assert.match(smoke, /I_UNDERSTAND_THIS_IS_A_TEST_INSTANCE/,
  'destructive restore smoke must require explicit disposable-instance confirmation');
assert.match(compose, /JOURNAL_VERSION: \$\{JOURNAL_VERSION:-v23-P50\}/,
  'compose must provide a release version for backup manifests');

console.log('Backup/restore static contract: PASS');
