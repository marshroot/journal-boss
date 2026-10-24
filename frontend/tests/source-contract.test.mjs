import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'src');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('frontend keeps JWT auth and does not embed API secrets', () => {
  const auth = read('lib/auth.ts');
  const api = read('lib/api.ts');
  assert.match(auth, /localStorage/);
  assert.match(auth, /Authorization/);
  assert.match(api, /Authorization/);
  assert.doesNotMatch(auth, /OPENROUTER_API_KEY|LIVEKIT_API_SECRET|JUDGE0/);
  assert.doesNotMatch(api, /OPENROUTER_API_KEY|LIVEKIT_API_SECRET|JUDGE0/);
});

test('role-sensitive pages use the canonical current-user role', () => {
  const source = fs.readdirSync(path.join(root, 'pages')).filter(x => x.endsWith('.tsx'))
    .map(x => read(`pages/${x}`)).join('\n');
  assert.match(source, /getCurrentUser/);
  assert.match(source, /role/);
});

test('curator is the canonical parent role, with no elevated or separate role', () => {
  const roles = read('lib/auth.ts');
  const adminUsers = fs.readFileSync(path.join(root, 'pages/AdminUsersPage.tsx'), 'utf8');
  assert.match(roles, /Parent/);
  assert.match(adminUsers, /Родитель \/ куратор \(одинаковые права\)/);
  assert.doesNotMatch(roles, /['"]Curator['"]/);
});

test('AI homework completion feature is removed from the product', () => {
  const landing = read('pages/LandingPage.tsx');
  const widget = read('components/journal/HomeworkWidget.tsx');
  for (const name of ['components/AIDemo.tsx', 'components/AIHomeworkLab.tsx', 'components/AIHomeworkSimulator.tsx']) {
    assert.equal(fs.existsSync(path.join(root, name)), false, `${name} must be removed`);
  }
  assert.doesNotMatch(landing, /AIHomeworkLab|AIHomeworkSimulator/);
  assert.doesNotMatch(widget, /api\/AiHomework/);
  assert.equal(fs.existsSync(path.resolve(root, '../../backend/JournalBackend/Controllers/AiHomeworkController.cs')), false);
});


test('external profile endpoint uses authenticated JWT identity instead of sessionToken query', () => {
  const controller = fs.readFileSync(path.resolve(root, '../../backend/JournalBackend/Controllers/AuthController.cs'), 'utf8');
  const layout = read('components/journal/JournalLayout.tsx');
  assert.match(controller, /\[Authorize\][\s\S]*?\[HttpGet\("profile"\)\][\s\S]*?GetProfile\(\)/);
  assert.match(controller, /User\.FindFirstValue\(ClaimTypes\.NameIdentifier\)/);
  assert.doesNotMatch(controller, /GetProfile\(\[FromQuery\] string sessionToken\)/);
  assert.match(layout, /fetch\(\`\$\{API_BASE\}\/api\/Auth\/profile\`, \{[\s\S]*?Authorization: \`Bearer \$\{profileToken\}\`/);
  assert.doesNotMatch(layout, /api\/Auth\/profile\?sessionToken=/);
});
