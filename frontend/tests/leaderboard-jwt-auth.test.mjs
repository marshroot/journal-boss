import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readRepoFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const controller = readRepoFile('backend/JournalBackend/Controllers/LeaderboardController.cs');
const leaderboard = readRepoFile('frontend/src/components/journal/LeaderboardWidget.tsx');
const averageGrade = readRepoFile('frontend/src/components/journal/AverageGradeWidget.tsx');

test('leaderboard endpoints require JWT and resolve current user from authenticated identity', () => {
  assert.match(controller, /using Microsoft\.AspNetCore\.Authorization;/);
  assert.match(controller, /\[Authorize\]\s*\[Route\("api\/\[controller\]"\)\]/);
  assert.match(controller, /FindFirstValue\(ClaimTypes\.NameIdentifier\)/);
  assert.match(controller, /GetCurrentUserAsync\(\)/);
  assert.doesNotMatch(controller, /sessionToken|RegistrationSessions|TelegramId/);
});

test('leaderboard frontend callers use the shared JWT API client without query tokens', () => {
  assert.match(leaderboard, /apiFetch\('\/api\/Leaderboard\/group'\)/);
  assert.match(leaderboard, /apiFetch\('\/api\/Leaderboard\/stream'\)/);
  assert.doesNotMatch(leaderboard, /sessionToken/);
  assert.match(averageGrade, /apiFetch\('\/api\/Leaderboard\/average-grade'\)/);
  assert.match(averageGrade, /apiFetch\('\/api\/Leaderboard\/visits'\)/);
  assert.doesNotMatch(averageGrade, /sessionToken/);
});
