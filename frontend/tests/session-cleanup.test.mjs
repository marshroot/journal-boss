import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const topBar = fs.readFileSync(new URL('../src/components/journal/JournalTopBar.tsx', import.meta.url), 'utf8');
const schedulePage = fs.readFileSync(new URL('../src/pages/JournalSchedule.tsx', import.meta.url), 'utf8');

 test('JournalTopBar logout clears JWT credentials and routes to login', () => {
  assert.match(topBar, /import \{ logout \} from '\.\.\/\.\.\/lib\/auth'/);
  assert.match(topBar, /logout\(\);\s*localStorage\.removeItem\('sessionToken'\);\s*window\.location\.href = '\/login';/);
});

test('student legacy schedule widget no longer depends on the removed Telegram session token', () => {
  assert.match(schedulePage, /user\?\.role === 'Student' && \(/);
  assert.doesNotMatch(schedulePage, /localStorage\.getItem\('sessionToken'\)/);
});
