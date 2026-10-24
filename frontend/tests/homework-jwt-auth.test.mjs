import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readRepoFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const controller = readRepoFile('backend/JournalBackend/Controllers/HomeworkController.cs');
const tracker = readRepoFile('frontend/src/components/journal/HomeworkTracker.tsx');

test('HomeworkController requires JWT and resolves identity from NameIdentifier', () => {
  assert.match(controller, /\[Authorize\]\s*\[Route\("api\/\[controller\]"\)\]/);
  assert.match(controller, /FindFirstValue\(ClaimTypes\.NameIdentifier\)/);
  assert.doesNotMatch(controller, /RegistrationSessions|s => s\.SessionToken|u => u\.TelegramId/);
});

test('HomeworkController endpoints no longer accept sessionToken arguments', () => {
  const actionDeclarations = controller.split(/\r?\n/).filter(line => /public\s+async\s+Task<IActionResult>/.test(line));
  assert.equal(actionDeclarations.length, 9);
  assert.ok(actionDeclarations.every(line => !/sessionToken/i.test(line)));
});

test('HomeworkTracker uses JWT API client and does not put sessionToken in Homework list URLs', () => {
  assert.match(tracker, /import \{ apiFetch \} from '\.\.\/\.\.\/lib\/api'/);
  assert.match(tracker, /localStorage\.getItem\('accessToken'\)/);
  assert.match(tracker, /apiFetch\(url\.replace\(API_BASE, ''\)\)/);
  assert.doesNotMatch(tracker, /api\/Homework\/list\?sessionToken=/);
});
