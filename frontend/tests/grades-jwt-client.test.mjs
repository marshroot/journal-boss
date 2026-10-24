import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const grades = fs.readFileSync(new URL('../src/components/journal/GradesWidget.tsx', import.meta.url), 'utf8');

test('GradesWidget uses shared JWT API client for all leaderboard requests', () => {
  assert.match(grades, /import \{ apiFetch \} from '\.\.\/\.\.\/lib\/api'/);
  assert.match(grades, /apiFetch\('\/api\/Leaderboard\/visits\?bypassCache=true'\)/);
  assert.match(grades, /apiFetch\('\/api\/Leaderboard\/exams\?bypassCache=true'\)/);
  assert.match(grades, /apiFetch\('\/api\/Leaderboard\/future-exams\?bypassCache=true'\)/);
  assert.doesNotMatch(grades, /sessionToken|API_BASE/);
});

test('GradesWidget keeps its cache names independent from bearer-token values', () => {
  assert.match(grades, /visits_data_jwt/);
  assert.match(grades, /exams_data_jwt/);
  assert.match(grades, /future_exams_data_jwt/);
  assert.doesNotMatch(grades, /sessionStorage\.(?:getItem|setItem)\(`[^`]*\$\{/);
});
