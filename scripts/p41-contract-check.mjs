import fs from 'node:fs';
import assert from 'node:assert/strict';

const program = fs.readFileSync('backend/JournalBackend/Program.cs', 'utf8');
const matrix = fs.readFileSync('docs/FINAL_REQUIREMENTS_MATRIX_P50.md', 'utf8');
const security = fs.readFileSync('docs/SECURITY.md', 'utf8');

// Preserve the historical legacy API inventory, but don't claim it is secure:
// P50 explicitly tracks these session-token endpoints as a blocking migration.
const legacy = ['/api/Auth','/api/Schedule','/api/Homework','/api/Leaderboard'];
for (const route of legacy) assert.ok(program.includes(route), `legacy route boundary missing: ${route}`);
assert.ok(matrix.includes('Legacy controllers still use `sessionToken`'), 'security matrix must call out legacy session-token endpoints');
assert.ok(security.toLowerCase().includes('sessiontoken'), 'security documentation must mention session-token auth');
console.log('Legacy API security inventory: PASS (migration remains a release blocker)');
