import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const launcher = fs.readFileSync(new URL('../../run.bat', import.meta.url), 'utf8');
const installGuide = fs.readFileSync(new URL('../../docs/INSTALLATION.md', import.meta.url), 'utf8');

test('Windows launcher checks Node.js and .NET SDK 9 before starting services', () => {
  assert.match(launcher, /where node/i);
  assert.match(launcher, /where dotnet/i);
  assert.match(launcher, /HAS_NET9/);
});

test('Windows launcher installs locked frontend dependencies and checks backend health', () => {
  assert.match(launcher, /npm ci/i);
  assert.match(launcher, /localhost:5000\/health/i);
  assert.match(launcher, /localhost:3000/i);
});

test('Windows launcher does not start the removed Telegram bot', () => {
  assert.doesNotMatch(launcher, /bot\.py|Starting Telegram Bot/i);
  assert.match(launcher, /does not start the removed Telegram login\/bot flow/i);
});

test('installation guide documents local-only credentials and their limitation', () => {
  assert.match(installGuide, /ChangeThisLocalPassword123!/);
  assert.match(installGuide, /local development only/i);
});
