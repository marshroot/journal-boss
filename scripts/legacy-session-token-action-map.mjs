import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const controllersDir = path.join(root, 'backend', 'JournalBackend', 'Controllers');
const files = ['HomeworkController.cs', 'LeaderboardController.cs', 'ScheduleController.cs'];
const results = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(controllersDir, file), 'utf8');
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!/public\s+(?:async\s+)?Task<IActionResult>/.test(line) || !/sessionToken/i.test(line)) continue;
    const method = line.match(/Task<IActionResult>\s+(\w+)\s*\(/)?.[1] ?? 'UNKNOWN';
    const http = lines.slice(Math.max(0, i - 4), i).reverse().find(x => /^\s*\[Http(?:Get|Post|Put|Delete|Patch)\(/.test(x));
    results.push({ file, line: i + 1, method, route: http?.trim() ?? 'HTTP VERB/ROUTE NEEDS REVIEW', declaration: line });
  }
}
const counts = Object.groupBy(results, x => x.file);
console.log('# Legacy sessionToken action map (P63)\n');
console.log(`Detected actions: ${results.length}\n`);
for (const file of files) {
  console.log(`## ${file} (${counts[file]?.length ?? 0})`);
  for (const item of results.filter(x => x.file === file)) console.log(`- ${item.method} — ${item.route} — line ${item.line}: \`${item.declaration}\``);
  console.log('');
}
console.log('Remaining legacy declarations are an inventory, not a security fix.');
