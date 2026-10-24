import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const attendance = fs.readFileSync(new URL('../src/components/journal/AttendanceWidget.tsx', import.meta.url), 'utf8');
const awards = fs.readFileSync(new URL('../src/components/journal/AwardsWidget.tsx', import.meta.url), 'utf8');

test('AttendanceWidget uses the shared JWT API client without sessionToken URLs', () => {
  assert.match(attendance, /import \{ apiFetch \} from '\.\.\/\.\.\/lib\/api'/);
  assert.match(attendance, /apiFetch\('\/api\/Leaderboard\/visits'\)/);
  assert.doesNotMatch(attendance, /sessionToken|API_BASE/);
});

test('AwardsWidget uses the shared JWT API client without sessionToken URLs', () => {
  assert.match(awards, /import \{ apiFetch \} from '\.\.\/\.\.\/lib\/api'/);
  assert.match(awards, /apiFetch\('\/api\/Leaderboard\/activity'\)/);
  assert.doesNotMatch(awards, /sessionToken|API_BASE/);
});
