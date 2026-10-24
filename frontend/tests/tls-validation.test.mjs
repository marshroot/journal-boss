import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const controllersDir = new URL('../../backend/JournalBackend/Controllers/', import.meta.url);
const controllers = ['AuthController.cs', 'HomeworkController.cs', 'LeaderboardController.cs', 'ScheduleController.cs'];

test('HTTP clients do not disable TLS certificate validation', () => {
  for (const file of controllers) {
    const source = fs.readFileSync(new URL(file, controllersDir), 'utf8');
    assert.equal(source.includes('ServerCertificateCustomValidationCallback'), false, `${file} must use default TLS certificate validation`);
    assert.equal(source.includes('DangerousAcceptAnyServerCertificateValidator'), false, `${file} must not accept arbitrary certificates`);
  }
});

test('schedule proxy does not forward sessionToken query parameters upstream', () => {
  const source = fs.readFileSync(new URL('ScheduleController.cs', controllersDir), 'utf8');
  assert.match(source, /Where\(q => !string\.Equals\(q\.Key, "sessionToken", StringComparison\.OrdinalIgnoreCase\)\)/);
  assert.match(source, /\[Authorize\]/);
  assert.match(source, /User\.FindFirstValue\(ClaimTypes\.NameIdentifier\)/);
});
