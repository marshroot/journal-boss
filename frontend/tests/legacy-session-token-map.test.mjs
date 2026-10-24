import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

test('Historical P56 migration map accounts for all 18 remaining legacy sessionToken actions', () => {
  const report = fs.readFileSync(path.join(root, 'docs/LEGACY_SESSION_TOKEN_ACTION_MAP_P56.md'), 'utf8');
  assert.match(report, /Detected actions: 18/);
  for (const controller of ['HomeworkController.cs', 'ScheduleController.cs']) {
    assert.match(report, new RegExp(`## ${controller.replace('.', '\\.')} \\(\\d+\\)`));
  }
  assert.match(report, /This is an inventory, not a security fix/);
});
