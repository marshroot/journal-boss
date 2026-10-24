import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Telegram sign-in is absent from frontend and backend auth routes', () => {
  const landing = fs.readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  const auth = fs.readFileSync(new URL('../../backend/JournalBackend/Controllers/AuthController.cs', import.meta.url), 'utf8');
  const compose = fs.readFileSync(new URL('../../docker-compose.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(landing, /TelegramAuthModal|sessionToken|Вход через Telegram|Открыть Telegram-бот/);
  assert.doesNotMatch(auth, /register-session|complete-registration|registration-status|submit-journal-credentials/);
  assert.doesNotMatch(compose, /^  bot:|profiles: \["telegram"\]/m);
  assert.equal(fs.existsSync(new URL('../src/components/Modals.tsx', import.meta.url)), false);
});
