import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync(new URL('../../backend/JournalBackend/Controllers/ScheduleController.cs', import.meta.url), 'utf8');
const widget = fs.readFileSync(new URL('../src/components/journal/ScheduleWidget.tsx', import.meta.url), 'utf8');

test('ScheduleController requires JWT authorization and reads user id from claims', () => {
  assert.match(controller, /\[Authorize\]/);
  assert.match(controller, /User\.FindFirstValue\(ClaimTypes\.NameIdentifier\)/);
  assert.doesNotMatch(controller, /RegistrationSessions|TelegramId/);
  assert.match(controller, /Where\(q => !string\.Equals\(q\.Key, "sessionToken", StringComparison\.OrdinalIgnoreCase\)\)/);
});

test('Schedule proxy restricts operation names to the expected read-only allowlist', () => {
  assert.match(controller, /get-by-date.*get-month.*get-by-date-range.*month-events/);
  assert.match(controller, /Недопустимая операция расписания/);
});

test('ScheduleWidget uses apiFetch and does not put bearer credentials in URLs', () => {
  assert.match(widget, /import \{ apiFetch \} from '\.\.\/\.\.\/lib\/api'/);
  assert.match(widget, /apiFetch\(`\/api\/Schedule\/operations\/get-by-date-range/);
  assert.doesNotMatch(widget, /sessionToken/);
});
