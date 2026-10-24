import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const controllersDir = path.join(root, 'backend', 'JournalBackend', 'Controllers');
const knownLegacy = new Set([
  'AuthController.cs',
  'HomeworkController.cs',
  'LeaderboardController.cs',
  'ScheduleController.cs',
]);
const findings = [];
for (const name of fs.readdirSync(controllersDir).filter(n => n.endsWith('.cs')).sort()) {
  const source = fs.readFileSync(path.join(controllersDir, name), 'utf8');
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/sessionToken|SessionToken/.test(lines[i])) continue;
    // Report public controller action declarations and body reads; private helpers are not endpoints.
    const line = lines[i].trim();
    if (/public\s+async\s+Task<IActionResult>|public\s+IActionResult|public\s+async\s+Task<ActionResult|public\s+Task<IActionResult>/.test(line)) {
      findings.push({ file: name, line: i + 1, declaration: line, legacyListed: knownLegacy.has(name) });
    }
  }
}
const unknown = findings.filter(x => !x.legacyListed);
console.log(`Legacy session-token action declarations: ${findings.length}`);
for (const f of findings) console.log(`${f.legacyListed ? 'KNOWN-LEGACY' : 'UNCLASSIFIED'} ${f.file}:${f.line} ${f.declaration}`);
if (unknown.length) {
  console.error(`FAIL: ${unknown.length} session-token action declarations are outside the explicit legacy inventory.`);
  process.exitCode = 1;
} else {
  console.log('PASS: all detected public session-token action declarations are explicitly inventoried.');
  console.log('SECURITY STATUS: BLOCKING — inventory is not proof of secure authorization; these endpoints still require migration or isolated legacy-token validation.');
}
