import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const frontendRoot = path.join(root, 'frontend', 'src');
const findings = [];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name))) {
      const source = fs.readFileSync(full, 'utf8');
      const lines = source.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (/sessionToken|session_token/i.test(lines[i])) {
          findings.push({
            file: path.relative(root, full).replaceAll(path.sep, '/'),
            line: i + 1,
            source: lines[i].trim().slice(0, 240)
          });
        }
      }
    }
  }
}

walk(frontendRoot);
const grouped = new Map();
for (const item of findings) {
  if (!grouped.has(item.file)) grouped.set(item.file, []);
  grouped.get(item.file).push(item);
}

console.log(`# Frontend legacy sessionToken caller inventory\n`);
console.log(`Generated from \`frontend/src\`. Matching source lines: ${findings.length}; files: ${grouped.size}.\n`);
console.log(`This is an inventory, not proof that every match is an active API call. Inspect each call site before migration.\n`);
for (const [file, entries] of grouped) {
  console.log(`## ${file}`);
  for (const item of entries) console.log(`- L${item.line}: \`${item.source.replaceAll('`', '\\`')}\``);
  console.log('');
}
if (!fs.existsSync(frontendRoot)) {
  console.error('FAIL: frontend/src directory was not found.');
  process.exitCode = 1;
} else {
  console.log('PASS: frontend caller inventory completed.');
}
